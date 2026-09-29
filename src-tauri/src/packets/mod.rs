use crate::{domain::*,storage::Database};
use serde::Serialize;
use std::{fs,io::{BufRead,BufReader},path::PathBuf,process::{Child,Command,Stdio},sync::Mutex};

const PER_FILE_KIB:u32=10_240;
const RING_FILES:u32=5;
const MAX_TOTAL:u64=200*1024*1024;
const MAX_KEYLOG:u64=1024*1024;

#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct PacketInterface {pub index:u32,pub label:String}
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct PacketFile {pub name:String,pub bytes:u64}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct PacketStatus {pub capture_available:bool,pub analyzer_available:bool,pub running:bool,pub interface:Option<u32>,pub files:Vec<PacketFile>,pub total_bytes:u64,pub keylog_loaded:bool,pub keylog_entries:usize,pub message:String}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct PacketRow {pub number:String,pub time:String,pub source:String,pub destination:String,pub protocol:String,pub length:String,pub http_method:String,pub http_status:String}

struct Running {child:Child,interface:u32,_job:crate::platform::job::ChildJob}
#[derive(Default)]
pub struct PacketRuntime {running:Mutex<Option<Running>>,keylog:Mutex<Option<(PathBuf,usize)>>}

fn find_tool(name:&str)->Option<PathBuf>{
 let executable=format!("{name}.exe");
 let mut dirs=Vec::new();
 for env in ["ProgramFiles","ProgramFiles(x86)"] {if let Some(root)=std::env::var_os(env){dirs.push(PathBuf::from(root).join("Wireshark"));}}
 if let Some(path)=std::env::var_os("PATH"){dirs.extend(std::env::split_paths(&path));}
 dirs.into_iter().map(|dir|dir.join(&executable)).find(|path|path.is_file())
}
fn folder(db:&Database)->PathBuf{db.root.join("packets")}
fn files(db:&Database)->ApiResult<(Vec<PacketFile>,u64)>{
 let mut rows=Vec::new();let mut total=0u64;
 let root=folder(db);if !root.exists(){return Ok((rows,0))}
 for item in fs::read_dir(root)?{let item=item?;let name=item.file_name().to_string_lossy().to_string();if !item.file_type()?.is_file()||!name.starts_with("packets_")||!name.ends_with(".pcapng"){continue}let bytes=item.metadata()?.len();total=total.saturating_add(bytes);rows.push(PacketFile{name,bytes});}
 rows.sort_by(|a,b|b.name.cmp(&a.name));rows.truncate(100);Ok((rows,total))
}
impl PacketRuntime{
 fn stored_file(db:&Database,name:&str)->ApiResult<PathBuf>{if name.len()>100||!name.starts_with("packets_")||!name.ends_with(".pcapng")||name.contains(['/', '\\']){return Err(ApiError::new("validation","Select a stored packet capture file."));}let file=folder(db).join(name);if !file.is_file(){return Err(ApiError::new("not_found","Packet capture file was removed."));}Ok(file)}
 pub fn status(&self,db:&Database)->ApiResult<PacketStatus>{
  let mut guard=self.running.lock().map_err(|_|ApiError::new("runtime","Packet worker unavailable."))?;
  let mut message=String::new();
  if let Some(run)=guard.as_mut(){if run.child.try_wait()?.is_some(){*guard=None;message="Packet capture exited. Inspect driver permissions and retained files.".into();}}
  let (found,total)=files(db)?;
  let keylog=self.keylog.lock().map_err(|_|ApiError::new("runtime","Key log state unavailable."))?;
  let available=find_tool("dumpcap").is_some();
  if message.is_empty(){message=if !available{"Wireshark dumpcap is not installed or discoverable. No packet listener is running."}else if guard.is_some(){"Recording encrypted packets; TLS contents need matching session keys."}else{"Ready for an explicit packet capture. HTTP proxy flows remain separate."}.into();}
  Ok(PacketStatus{capture_available:available,analyzer_available:find_tool("tshark").is_some(),running:guard.is_some(),interface:guard.as_ref().map(|v|v.interface),files:found,total_bytes:total,keylog_loaded:keylog.is_some(),keylog_entries:keylog.as_ref().map(|v|v.1).unwrap_or(0),message})
 }
 pub fn interfaces(&self)->ApiResult<Vec<PacketInterface>>{
  let tool=find_tool("dumpcap").ok_or_else(||ApiError::new("unsupported","Install Wireshark with dumpcap/Npcap to list capture interfaces."))?;
  let output=Command::new(tool).arg("-D").output()?;
  if !output.status.success()||output.stdout.len()>65536{return Err(ApiError::new("runtime","Could not list packet interfaces. Check Npcap installation and permissions."));}
  let text=String::from_utf8_lossy(&output.stdout);
  Ok(text.lines().filter_map(|line|{let(index,label)=line.split_once('.')?;let index=index.trim().parse::<u32>().ok()?;if index==0||label.trim().is_empty(){return None}Some(PacketInterface{index,label:label.trim().chars().take(180).collect()})}).take(64).collect())
 }
 pub fn start(&self,db:&Database,interface:u32,acknowledged:bool)->ApiResult<PacketStatus>{
  if !acknowledged{return Err(ApiError::new("permission","Confirm local packet capture and storage."));}
  if !self.interfaces()?.iter().any(|value|value.index==interface){return Err(ApiError::new("validation","Select a currently available capture interface."));}
  let mut guard=self.running.lock().map_err(|_|ApiError::new("runtime","Packet worker unavailable."))?;
  if guard.is_some(){return Err(ApiError::new("conflict","Stop the current packet capture first."));}
  let (_,total)=files(db)?;if total>MAX_TOTAL-50*1024*1024{return Err(ApiError::new("quota","Packet storage would exceed 200 MiB. Export or clear old captures first."));}
  let root=folder(db);fs::create_dir_all(&root)?;
  let output=root.join(format!("packets_{}.pcapng",uuid::Uuid::new_v4().simple()));
  let tool=find_tool("dumpcap").ok_or_else(||ApiError::new("unsupported","Wireshark dumpcap is unavailable."))?;
  let mut command=Command::new(tool);command.args(["-q","-i",&interface.to_string(),"-w"]).arg(&output).args(["-b",&format!("filesize:{PER_FILE_KIB}"),"-b",&format!("files:{RING_FILES}")]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
  #[cfg(windows)]{use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
  let mut child=command.spawn()?;
  let job=match crate::platform::job::ChildJob::attach(&child){Ok(job)=>job,Err(error)=>{let _=child.kill();let _=child.wait();return Err(error)}};
  *guard=Some(Running{child,interface,_job:job});drop(guard);
  self.status(db)
 }
 pub fn stop(&self,db:&Database)->ApiResult<PacketStatus>{if let Some(mut run)=self.running.lock().map_err(|_|ApiError::new("runtime","Packet worker unavailable."))?.take(){let _=run.child.kill();let _=run.child.wait();}self.status(db)}
 pub fn clear(&self,db:&Database,acknowledged:bool)->ApiResult<PacketStatus>{
  if !acknowledged{return Err(ApiError::new("permission","Confirm removal of stored packet captures."));}
  if self.running.lock().map_err(|_|ApiError::new("runtime","Packet worker unavailable."))?.is_some(){return Err(ApiError::new("conflict","Stop packet capture before clearing files."));}
  let root=folder(db);if root.exists(){for item in fs::read_dir(root)?{let item=item?;let path=item.path();let name=item.file_name().to_string_lossy().to_string();if item.file_type()?.is_file()&&name.starts_with("packets_")&&name.ends_with(".pcapng"){fs::remove_file(path)?;}}}
  self.status(db)
 }
 pub fn keylog_select(&self,db:&Database)->ApiResult<PacketStatus>{
  #[cfg(windows)]{
   let Some(path)=rfd::FileDialog::new().add_filter("TLS key log",&["log","txt"]).pick_file()else{return self.status(db)};
   let file=fs::File::open(&path)?;if file.metadata()?.len()>MAX_KEYLOG{return Err(ApiError::new("quota","TLS key log must be at most 1 MiB."));}
   let mut count=0usize;
   for line in BufReader::new(file).lines(){let line=line?;let line=line.trim();if line.is_empty()||line.starts_with('#'){continue}let fields=line.split_whitespace().collect::<Vec<_>>();if fields.len()!=3||!matches!(fields[0],"CLIENT_RANDOM"|"CLIENT_HANDSHAKE_TRAFFIC_SECRET"|"SERVER_HANDSHAKE_TRAFFIC_SECRET"|"CLIENT_TRAFFIC_SECRET_0"|"SERVER_TRAFFIC_SECRET_0"|"EXPORTER_SECRET"|"EARLY_EXPORTER_SECRET")||fields[1].len()!=64||!fields[1].bytes().all(|b|b.is_ascii_hexdigit())||fields[2].len()>256||fields[2].len()%2!=0||!fields[2].bytes().all(|b|b.is_ascii_hexdigit()){return Err(ApiError::new("validation","Invalid TLS key log format."));}count+=1;if count>4096{return Err(ApiError::new("quota","TLS key log has too many entries."));}}
   if count==0{return Err(ApiError::new("validation","TLS key log is empty."));}
   *self.keylog.lock().map_err(|_|ApiError::new("runtime","Key log state unavailable."))?=Some((path,count));self.status(db)
  }
  #[cfg(not(windows))]{let _=db;Err(ApiError::new("unsupported","Native TLS key-log picker is Windows-only."))}
 }
 pub fn keylog_clear(&self,db:&Database)->ApiResult<PacketStatus>{*self.keylog.lock().map_err(|_|ApiError::new("runtime","Key log state unavailable."))?=None;self.status(db)}
 pub fn inspect(&self,db:&Database,name:&str)->ApiResult<Vec<PacketRow>>{
  let file=Self::stored_file(db,name)?;
  let tool=find_tool("tshark").ok_or_else(||ApiError::new("unsupported","Install Wireshark tshark to inspect packets and use TLS key logs."))?;
  let mut command=Command::new(tool);command.args(["-n","-r"]).arg(file).args(["-c","300","-T","fields","-E","separator=/t","-e","frame.number","-e","frame.time_epoch","-e","ip.src","-e","ipv6.src","-e","ip.dst","-e","ipv6.dst","-e","_ws.col.Protocol","-e","frame.len","-e","http.request.method","-e","http.response.code"]);
  if let Some((path,_))=self.keylog.lock().map_err(|_|ApiError::new("runtime","Key log state unavailable."))?.as_ref(){if !path.is_file(){return Err(ApiError::new("not_found","Selected TLS key log was moved."));}command.args(["-o",&format!("tls.keylog_file:{}",path.display())]);}
  let output=command.output()?;if !output.status.success()||output.stdout.len()>1024*1024{return Err(ApiError::new("runtime","Packet analysis failed or exceeded the bounded output limit."));}
  let text=String::from_utf8_lossy(&output.stdout);
  Ok(text.lines().take(300).map(|line|{let cols=line.split('\t').collect::<Vec<_>>();let at=|n|cols.get(n).copied().unwrap_or("").chars().take(120).collect::<String>();PacketRow{number:at(0),time:at(1),source:if cols.get(2).is_some_and(|v|!v.is_empty()){at(2)}else{at(3)},destination:if cols.get(4).is_some_and(|v|!v.is_empty()){at(4)}else{at(5)},protocol:at(6),length:at(7),http_method:at(8),http_status:at(9)}}).collect())
 }
 pub fn export(&self,db:&Database,name:&str)->ApiResult<bool>{
  let source=Self::stored_file(db,name)?;
  #[cfg(windows)]{
   let Some(destination)=rfd::FileDialog::new().add_filter("PCAPNG",&["pcapng"]).set_file_name(name).save_file()else{return Ok(false)};
   let parent=destination.parent().ok_or_else(||ApiError::new("validation","Invalid export destination."))?.canonicalize()?;
   if parent.starts_with(db.root.canonicalize()?){return Err(ApiError::new("permission","Export packet captures outside app-private storage."));}
   let mut temporary=tempfile::NamedTempFile::new_in(parent)?;std::io::copy(&mut fs::File::open(source)?,&mut temporary)?;temporary.as_file().sync_all()?;temporary.persist(destination).map_err(|_|ApiError::new("storage","Packet export could not be committed."))?;Ok(true)
  }
  #[cfg(not(windows))]{let _=source;Err(ApiError::new("unsupported","Native packet export picker is Windows-only."))}
 }
}
impl Drop for PacketRuntime{fn drop(&mut self){if let Ok(mut guard)=self.running.lock(){if let Some(mut run)=guard.take(){let _=run.child.kill();let _=run.child.wait();}}}}
