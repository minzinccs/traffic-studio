use crate::domain::*;
use serde::Serialize;
use std::{process::{Command,Child,Stdio},sync::{Arc,Mutex},io::Read,collections::VecDeque};
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct TerminalStatus {pub running:bool,pub output:String,pub truncated:bool,pub exit_code:Option<i32>}
struct Execution {child:Child,job:crate::platform::job::ChildJob,output:Arc<Mutex<VecDeque<u8>>>}
#[derive(Default)]pub struct TerminalRuntime {execution:Mutex<Option<Execution>>}
impl TerminalRuntime {
 pub fn start(&self,command:&str,port:u16,acknowledged:bool)->ApiResult<()>{
  if !acknowledged||command.trim().is_empty()||command.len()>8192||port==0{return Err(ApiError::new("permission","Review the command and acknowledge local shell execution."));}
  let mut guard=self.execution.lock().map_err(|_|ApiError::new("runtime","Terminal worker unavailable"))?;if let Some(prior)=guard.as_mut(){if prior.child.try_wait()?.is_none(){return Err(ApiError::new("conflict","Stop or finish the existing command."));}}
  let mut cmd=Command::new("powershell.exe");cmd.args(["-NoLogo","-NoProfile","-NonInteractive","-Command",command]).env("HTTP_PROXY",format!("http://127.0.0.1:{port}")).env("HTTPS_PROXY",format!("http://127.0.0.1:{port}")).env("ALL_PROXY",format!("http://127.0.0.1:{port}")).env("NO_PROXY","").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
  #[cfg(windows)]{use std::os::windows::process::CommandExt;cmd.creation_flags(0x08000000);}
  let mut child=cmd.spawn()?;let job=match crate::platform::job::ChildJob::attach(&child){Ok(job)=>job,Err(e)=>{let _=child.kill();let _=child.wait();return Err(e);}};let output=Arc::new(Mutex::new(VecDeque::new()));
  fn consume(mut reader:impl Read+Send+'static,output:Arc<Mutex<VecDeque<u8>>>){std::thread::spawn(move||{let mut bytes=[0u8;8192];while let Ok(n)=reader.read(&mut bytes){if n==0{break;}if let Ok(mut target)=output.lock(){target.extend(&bytes[..n]);while target.len()>256*1024{target.pop_front();}}else{break;}}});}
  consume(child.stdout.take().unwrap(),output.clone());consume(child.stderr.take().unwrap(),output.clone());*guard=Some(Execution{child,job,output});Ok(())
 }
 pub fn status(&self)->ApiResult<TerminalStatus>{let mut guard=self.execution.lock().map_err(|_|ApiError::new("runtime","Terminal worker unavailable"))?;let Some(run)=guard.as_mut()else{return Ok(TerminalStatus{running:false,output:String::new(),truncated:false,exit_code:None})};let exit=run.child.try_wait()?;let bytes=run.output.lock().map_err(|_|ApiError::new("runtime","Terminal output unavailable"))?.iter().copied().collect::<Vec<_>>();Ok(TerminalStatus{running:exit.is_none(),output:String::from_utf8_lossy(&bytes).to_string(),truncated:bytes.len()==256*1024,exit_code:exit.and_then(|v|v.code())})}
 pub fn stop(&self)->ApiResult<()>{if let Some(mut run)=self.execution.lock().map_err(|_|ApiError::new("runtime","Terminal worker unavailable"))?.take(){drop(run.job);let _=run.child.kill();let _=run.child.wait();}Ok(())}
}
impl Drop for TerminalRuntime{fn drop(&mut self){let _=self.stop();}}
