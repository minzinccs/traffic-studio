use crate::{domain::*, storage::Database};
use rcgen::{CertificateParams, SanType, KeyPair};
use rustls::{pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer}, ServerConfig};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{net::{IpAddr, Ipv4Addr}, sync::{Arc, Mutex}, time::{Duration, Instant}};
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::{TcpListener, TcpStream}, sync::{oneshot, Semaphore}};
use tokio_rustls::{server::TlsStream, TlsAcceptor};

#[derive(Clone, Serialize)]
#[serde(rename_all="camelCase")]
pub struct LanStatus { pub running:bool, pub workspace_id:Option<String>, pub host:Option<String>, pub port:Option<u16>, pub fingerprint:Option<String>, pub token:Option<String> }
struct Listener { workspace:String, host:Ipv4Addr, port:u16, fingerprint:String, stop:oneshot::Sender<()> }
#[derive(Default)]
pub struct LanReadRuntime { listener:Mutex<Option<Listener>> }
struct Rate { since:Instant, count:u32 }
impl Rate { fn allow(&mut self)->bool { if self.since.elapsed()>=Duration::from_secs(60) { self.since=Instant::now(); self.count=0; } if self.count>=60{return false} self.count+=1; true } }

impl LanReadRuntime {
 pub fn status(&self)->ApiResult<LanStatus> {
  let guard=self.listener.lock().map_err(|_|ApiError::new("runtime","LAN reader unavailable"))?;
  Ok(match guard.as_ref(){Some(value)=>LanStatus{running:true,workspace_id:Some(value.workspace.clone()),host:Some(value.host.to_string()),port:Some(value.port),fingerprint:Some(value.fingerprint.clone()),token:None},None=>LanStatus{running:false,workspace_id:None,host:None,port:None,fingerprint:None,token:None}})
 }
 pub async fn start(&self,db:&Database,workspace_id:String,host:String,port:u16,acknowledged:bool)->ApiResult<LanStatus> {
  if !acknowledged{return Err(ApiError::new("permission","Confirm read-only LAN sharing for this workspace."));}
  let address:Ipv4Addr=host.parse().map_err(|_|ApiError::new("validation","Enter this PC's private Wi-Fi IPv4 address."))?;
  if !address.is_private() || address.is_loopback() || port==0 {return Err(ApiError::new("validation","Use a private LAN IPv4 address and nonzero port."));}
  {let connection=db.lock()?;Database::require_workspace(&connection,&workspace_id)?;}
  let socket=TcpListener::bind((address,port)).await.map_err(|_|ApiError::new("network","LAN address or port is unavailable on this PC."))?;
  let mut guard=self.listener.lock().map_err(|_|ApiError::new("runtime","LAN reader unavailable"))?;
  if guard.is_some(){return Err(ApiError::new("conflict","Stop the current LAN reader first."));}
  let mut params=CertificateParams::new(vec![]).map_err(|_|ApiError::new("certificate","Could not configure LAN certificate."))?;
  params.subject_alt_names.push(SanType::IpAddress(IpAddr::V4(address)));
  let key=KeyPair::generate().map_err(|_|ApiError::new("certificate","Could not generate LAN key."))?;
  let cert=params.self_signed(&key).map_err(|_|ApiError::new("certificate","Could not generate LAN certificate."))?;
  let fingerprint=format!("{:x}",Sha256::digest(cert.der().as_ref()));
  let private=PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.serialize_der()));
  let config=ServerConfig::builder().with_no_client_auth().with_single_cert(vec![CertificateDer::from(cert.der().to_vec())],private).map_err(|_|ApiError::new("certificate","Could not configure LAN TLS."))?;
  let acceptor=TlsAcceptor::from(Arc::new(config));
  let token=format!("{}{}",uuid::Uuid::new_v4().simple(),uuid::Uuid::new_v4().simple());
  let (stop,mut stopped)=oneshot::channel();
  *guard=Some(Listener{workspace:workspace_id.clone(),host:address,port,fingerprint:fingerprint.clone(),stop});drop(guard);
  let database=db.clone();let scope=workspace_id.clone();let secret=token.clone();
  tauri::async_runtime::spawn(async move {
   let semaphore=Arc::new(Semaphore::new(4));let rate=Arc::new(Mutex::new(Rate{since:Instant::now(),count:0}));let mut tasks=tokio::task::JoinSet::new();
   loop {tokio::select!{
    _=&mut stopped=>{tasks.abort_all();break},
    incoming=socket.accept()=>{let Ok((stream,peer))=incoming else{break};if !peer.ip().is_ipv4() || !peer.ip().to_string().parse::<Ipv4Addr>().is_ok_and(|ip|ip.is_private()){continue}let Ok(permit)=semaphore.clone().try_acquire_owned()else{continue};let acceptor=acceptor.clone();let db=database.clone();let workspace=scope.clone();let token=secret.clone();let rate=rate.clone();tasks.spawn(async move{let _permit=permit;let _=tokio::time::timeout(Duration::from_secs(10),serve(stream,acceptor,&db,&workspace,address,port,&token,&rate)).await;});},
    _=tasks.join_next(),if !tasks.is_empty()=>{}
   }}
  });
  Ok(LanStatus{running:true,workspace_id:Some(workspace_id),host:Some(address.to_string()),port:Some(port),fingerprint:Some(fingerprint),token:Some(token)})
 }
 pub fn stop(&self)->ApiResult<()> { if let Some(listener)=self.listener.lock().map_err(|_|ApiError::new("runtime","LAN reader unavailable"))?.take(){let _=listener.stop.send(());}Ok(()) }
}
impl Drop for LanReadRuntime {fn drop(&mut self){let _=self.stop();}}

async fn reply(stream:&mut TlsStream<TcpStream>,status:&str,value:Value)->ApiResult<()> {
 let bytes=serde_json::to_vec(&value)?;let header=format!("HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n",bytes.len());stream.write_all(header.as_bytes()).await?;stream.write_all(&bytes).await?;Ok(())
}
async fn serve(stream:TcpStream,acceptor:TlsAcceptor,db:&Database,workspace:&str,host:Ipv4Addr,port:u16,secret:&str,rate:&Mutex<Rate>)->ApiResult<()> {
 let mut stream=acceptor.accept(stream).await.map_err(|_|ApiError::new("network","LAN TLS handshake failed."))?;
 let mut bytes=Vec::with_capacity(1024);let mut one=[0u8;1];
 while !bytes.ends_with(b"\r\n\r\n") {if bytes.len()>=8192{return reply(&mut stream,"431 Request Header Fields Too Large",json!({"error":"Headers too large"})).await}if stream.read(&mut one).await?==0{return Ok(())}bytes.push(one[0]);}
 let Ok(header)=std::str::from_utf8(&bytes)else{return reply(&mut stream,"400 Bad Request",json!({"error":"Invalid headers"})).await};
 let mut lines=header.split("\r\n");let request=lines.next().unwrap_or("");
 let kind=match request {"GET /v1/sessions HTTP/1.1"=>"session","GET /v1/flows HTTP/1.1"=>"flow","GET /v1/collections HTTP/1.1"=>"collection",_=>return reply(&mut stream,"404 Not Found",json!({"error":"Unknown read-only endpoint"})).await};
 let mut headers=std::collections::HashMap::new();for line in lines.filter(|line|!line.is_empty()){let Some((key,value))=line.split_once(':')else{return reply(&mut stream,"400 Bad Request",json!({"error":"Invalid headers"})).await};if headers.insert(key.trim().to_ascii_lowercase(),value.trim().to_string()).is_some(){return reply(&mut stream,"400 Bad Request",json!({"error":"Duplicate headers"})).await}}
 if headers.contains_key("origin")||headers.get("host")!=Some(&format!("{host}:{port}"))||headers.contains_key("transfer-encoding")||headers.get("content-length").is_some_and(|v|v!="0"){return reply(&mut stream,"403 Forbidden",json!({"error":"Request rejected"})).await}
 let expected=format!("Bearer {secret}");let actual=headers.get("authorization").map(String::as_bytes).unwrap_or_default();
 if actual.len()!=expected.len()||actual.iter().zip(expected.bytes()).fold(0u8,|diff,(a,b)|diff|(*a^b))!=0{return reply(&mut stream,"401 Unauthorized",json!({"error":"Pairing token required"})).await}
 if !rate.lock().map_err(|_|ApiError::new("runtime","LAN limiter unavailable"))?.allow(){return reply(&mut stream,"429 Too Many Requests",json!({"error":"Rate limit reached"})).await}
 let rows=db.query(workspace,kind,50,0)?;
 let items=rows.into_iter().map(|row|json!({"id":row.id,"name":row.name,"kind":row.kind,"updatedAt":row.updated_at,"method":row.payload["method"],"status":row.payload["status"],"source":row.payload["source"]})).collect::<Vec<_>>();
 reply(&mut stream,"200 OK",json!({"schemaVersion":1,"workspaceId":workspace,"items":items,"limit":50,"readOnly":true})).await
}
