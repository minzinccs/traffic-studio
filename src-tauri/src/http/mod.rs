use crate::{domain::*, storage::{Database, blobs::BodyRef}};
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{header::{HeaderName, HeaderValue}, redirect::Policy, Method};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs::{File, OpenOptions}, io::Write, path::PathBuf, sync::{Arc,Mutex}, time::{Duration, Instant}};
use tokio::sync::oneshot;

const MAX_RESPONSE:u64=64*1024*1024;
pub mod oauth;
const PREVIEW:usize=64*1024;
#[derive(Clone, Serialize, Deserialize)]
pub struct Header { pub key:String, pub value:String }
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct MultipartFile {pub key:String,pub filename:String,pub mime_type:String,pub body_ref:String}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DigestCredentials {pub username:String,pub password:String}
impl Drop for DigestCredentials {fn drop(&mut self){unsafe {self.password.as_bytes_mut().fill(0);}}}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct HttpInput {pub workspace_id:String,pub run_id:String,pub method:String,pub url:String,pub headers:Vec<Header>,pub body:String,pub body_ref:Option<String>,pub multipart:Option<Vec<Header>>,#[serde(default)]pub multipart_files:Vec<MultipartFile>,pub timeout_ms:u64,pub follow_redirects:bool,pub protocol:String,#[serde(default)]pub proxy_url:Option<String>,#[serde(default)]pub custom_ca_pem:Option<String>,#[serde(default="verify_tls")]pub tls_verify:bool,#[serde(default)]pub cookies_enabled:bool,#[serde(default)]pub digest:Option<DigestCredentials>}
fn verify_tls()->bool{true}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct HttpTimings {pub headers_ms:u64,pub body_ms:u64}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct HttpResult {pub run_id:String,pub status:u16,pub status_text:String,pub headers:Vec<Header>,pub final_url:String,pub protocol:String,pub duration_ms:u64,pub size:u64,pub preview_base64:String,pub preview_truncated:bool,pub body:BodyRef,pub timings:HttpTimings}
#[derive(Default)]
pub struct HttpRuntime {active:Mutex<HashMap<(String,String),Option<oneshot::Sender<()>>>>,jars:Mutex<HashMap<String,Arc<reqwest::cookie::Jar>>>}
struct RunGuard<'a> {runtime:&'a HttpRuntime,key:(String,String)}
impl Drop for RunGuard<'_> {fn drop(&mut self){if let Ok(mut active)=self.runtime.active.lock(){active.remove(&self.key);}}}
struct PendingFile {file:Option<File>,path:PathBuf}
impl Drop for PendingFile {fn drop(&mut self){drop(self.file.take());let _=std::fs::remove_file(&self.path);}}
impl HttpRuntime {
    pub fn clear_cookies(&self,workspace_id:&str)->ApiResult<()> {valid_id(workspace_id)?;let active=self.active.lock().map_err(|_|ApiError::new("runtime","HTTP worker unavailable."))?;if active.keys().any(|(owner,_)|owner==workspace_id){return Err(ApiError::new("busy","Finish or cancel active workspace runs before clearing cookies."));}self.jars.lock().map_err(|_|ApiError::new("runtime","Cookie jar unavailable."))?.remove(workspace_id);Ok(())}
    pub fn cancel(&self,workspace_id:&str,run_id:&str)->ApiResult<()> {
        valid_id(workspace_id)?;valid_id(run_id)?;
        let sender=self.active.lock().map_err(|_|ApiError::new("runtime","HTTP worker unavailable."))?.get_mut(&(workspace_id.into(),run_id.into())).and_then(Option::take);
        if let Some(sender)=sender {let _=sender.send(());Ok(())}else{Err(ApiError::new("not_found","HTTP run is no longer active."))}
    }
    pub async fn send(&self,db:&Database,input:HttpInput)->ApiResult<HttpResult> {
        valid_id(&input.run_id)?;{let connection=db.lock()?;Database::require_workspace(&connection,&input.workspace_id)?;if connection.query_row("SELECT EXISTS(SELECT 1 FROM entities WHERE workspace_id=?1 AND id=?2)",params![input.workspace_id,input.run_id],|row|row.get::<_,bool>(0))?{return Err(ApiError::new("conflict","Run ID is already committed. Use a new run ID; requests are not retried automatically."));}}
        let key=(input.workspace_id.clone(),input.run_id.clone());let (sender,receiver)=oneshot::channel();
        {let mut active=self.active.lock().map_err(|_|ApiError::new("runtime","HTTP worker unavailable."))?;if active.len()>=4||active.contains_key(&key){return Err(ApiError::new("busy","Four runs are already active or this run ID is in use."));}active.insert(key.clone(),Some(sender));}
        let _guard=RunGuard{runtime:self,key};
        if input.headers.iter().map(|header|header.key.len()+header.value.len()).sum::<usize>()>128*1024{return Err(ApiError::new("validation","Request headers exceed 128 KiB."));}
        if !(100..=120000).contains(&input.timeout_ms)||input.body.len()>1024*1024||input.headers.len()>1000||input.url.len()>16384 {return Err(ApiError::new("validation","Invalid timeout or oversized request metadata. Use a body file for large payloads."));}
        let url=reqwest::Url::parse(&input.url).map_err(|_|ApiError::new("validation","Invalid HTTP URL."))?;
        if !["http","https"].contains(&url.scheme())||!url.username().is_empty()||url.password().is_some(){return Err(ApiError::new("validation","Use an HTTP(S) URL without embedded credentials."));}
        let mut builder=reqwest::Client::builder().no_proxy().timeout(Duration::from_millis(input.timeout_ms)).redirect(if input.follow_redirects{Policy::custom(|attempt| {if attempt.previous().len()>=10{return attempt.error("Redirect limit exceeded");}if let Some(first)=attempt.previous().first(){if !attempt.url().username().is_empty()||attempt.url().password().is_some()||attempt.url().origin()!=first.origin(){return attempt.stop();}}attempt.follow()})}else{Policy::none()});
        if let Some(proxy)=input.proxy_url.as_ref().filter(|value|!value.trim().is_empty()) {
            let endpoint=reqwest::Url::parse(proxy).map_err(|_|ApiError::new("validation","Invalid per-request proxy URL."))?;
            if !["http","https"].contains(&endpoint.scheme())||!endpoint.username().is_empty()||endpoint.password().is_some()||endpoint.path()!="/"||endpoint.query().is_some()||endpoint.fragment().is_some(){return Err(ApiError::new("validation","Proxy must be http(s)://host:port without credentials/path/query."));}
            builder=builder.proxy(reqwest::Proxy::all(endpoint.as_str()).map_err(|_|ApiError::new("validation","Unsupported proxy endpoint."))?);
        }
        if let Some(pem)=input.custom_ca_pem.as_ref().filter(|value|!value.trim().is_empty()){if pem.len()>65536{return Err(ApiError::new("validation","Custom CA exceeds 64 KiB."));}builder=builder.add_root_certificate(reqwest::Certificate::from_pem(pem.as_bytes()).map_err(|_|ApiError::new("validation","Custom CA must be a valid PEM certificate."))?);}
        if !input.tls_verify {builder=builder.danger_accept_invalid_certs(true).danger_accept_invalid_hostnames(true);}
        if input.cookies_enabled {let mut jars=self.jars.lock().map_err(|_|ApiError::new("runtime","Cookie jar unavailable."))?;if jars.len()>=32&&!jars.contains_key(&input.workspace_id){return Err(ApiError::new("quota","Session cookie jars are limited to 32 workspaces. Clear an unused jar."));}let jar=jars.entry(input.workspace_id.clone()).or_insert_with(||Arc::new(reqwest::cookie::Jar::default())).clone();builder=builder.cookie_provider(jar);}
        match input.protocol.as_str(){"Automatic"=>{},"HTTP/1.1"=>{builder=builder.http1_only();},"HTTP/2"=>{builder=builder.http2_prior_knowledge();},_=>return Err(ApiError::new("unsupported","HTTP/3 requires a separate transport; it is not silently downgraded."))}
        if let Some(credentials)=&input.digest {if credentials.username.len()>8192||credentials.password.len()>8192||input.headers.iter().any(|h|h.key.eq_ignore_ascii_case("authorization")){return Err(ApiError::new("validation","Digest requires bounded credentials and no explicit Authorization header."));}builder=builder.redirect(Policy::none());}
        let client=builder.build().map_err(|_|ApiError::new("runtime","HTTP TLS transport could not initialize."))?;
        let request=build_request(db,&input,&client).await?;

        db.http_begin_run(&input)?;
        let result=tokio::select! { biased; _=receiver=>Err(ApiError::new("cancelled","HTTP run cancelled.")), result=tokio::time::timeout(Duration::from_millis(input.timeout_ms),execute(db,&input,&client,request))=>result.map_err(|_|ApiError::new("timeout","HTTP run exceeded its timeout.")).and_then(|value|value) };
        if let Err(error)=&result {db.http_end_failed(&input,error)?;}result
    }
}
async fn build_request(db:&Database,input:&HttpInput,client:&reqwest::Client)->ApiResult<reqwest::RequestBuilder>{
    let method=Method::from_bytes(input.method.as_bytes()).map_err(|_|ApiError::new("validation","Invalid HTTP method."))?;
    let url=reqwest::Url::parse(&input.url).map_err(|_|ApiError::new("validation","Invalid HTTP URL."))?;
        let mut request=client.request(method,url);
        for header in &input.headers {
            if header.value.len()>65536{return Err(ApiError::new("validation","Header value too large."));}
            let name=HeaderName::from_bytes(header.key.as_bytes()).map_err(|_|ApiError::new("validation","Invalid header name."))?;
            if ["content-length","transfer-encoding","host"].contains(&name.as_str()){return Err(ApiError::new("validation","Host and body framing headers are managed by the transport."));}
            let value=HeaderValue::from_str(&header.value).map_err(|_|ApiError::new("validation","Invalid header value."))?;
            request=request.header(name,value);
        }
        if input.multipart.is_none()&&!input.multipart_files.is_empty(){return Err(ApiError::new("validation","File fields require multipart body mode."));}
        if let Some(fields)=&input.multipart {
            if input.body_ref.is_some()||!input.body.is_empty()||fields.len()>1000||input.multipart_files.len()>16{return Err(ApiError::new("validation","Choose one body source; multipart supports up to 1000 fields."));}
            if input.headers.iter().any(|h|h.key.eq_ignore_ascii_case("content-type")){return Err(ApiError::new("validation","Remove Content-Type for multipart; the transport generates its boundary."));}
            let mut form=reqwest::multipart::Form::new();let mut size=0usize;
            for field in fields {size+=field.key.len()+field.value.len();if size>1024*1024{return Err(ApiError::new("validation","Multipart fields exceed 1 MB."));}form=form.text(field.key.clone(),field.value.clone());}
            for attachment in &input.multipart_files {
                if attachment.key.is_empty()||attachment.key.len()>1024||attachment.filename.len()>1024||attachment.filename.contains(['\r','\n']){return Err(ApiError::new("validation","Invalid multipart file field or filename."));}
                let (path,size)=db.http_body_path(&input.workspace_id,&attachment.body_ref)?;
                let file=tokio::fs::File::open(path).await.map_err(|_|ApiError::new("storage","Multipart file unavailable."))?;
                let part=reqwest::multipart::Part::stream_with_length(reqwest::Body::wrap_stream(tokio_util::io::ReaderStream::new(file)),size).file_name(attachment.filename.clone()).mime_str(&attachment.mime_type).map_err(|_|ApiError::new("validation","Invalid multipart MIME type."))?;
                form=form.part(attachment.key.clone(),part);
            }
            request=request.multipart(form);
        }else if let Some(body_id)=&input.body_ref {
            if !input.body.is_empty(){return Err(ApiError::new("validation","Choose text or file body, not both."));}
            let (path,size)=db.http_body_path(&input.workspace_id,body_id)?;
            let file=tokio::fs::File::open(path).await.map_err(|_|ApiError::new("storage","Request body file unavailable."))?;
            request=request.header(reqwest::header::CONTENT_LENGTH,size).body(reqwest::Body::wrap_stream(tokio_util::io::ReaderStream::new(file)));
        }else {request=request.body(input.body.clone());}


    Ok(request)
}
fn network(error:reqwest::Error)->ApiError {if error.is_timeout(){ApiError::new("timeout","HTTP request timed out.")}else{ApiError::new("network","HTTP transport failed. Check DNS, connectivity, certificate trust and protocol settings.")}}
async fn execute(db:&Database,input:&HttpInput,client:&reqwest::Client,request:reqwest::RequestBuilder)->ApiResult<HttpResult> {
    let start=Instant::now();
    let mut response=request.send().await.map_err(network)?;
    if response.status()==reqwest::StatusCode::UNAUTHORIZED {
        if let Some(credentials)=&input.digest {
            let challenge=response.headers().get_all(reqwest::header::WWW_AUTHENTICATE).iter().filter_map(|value|value.to_str().ok()).find(|value|value.get(..7).is_some_and(|prefix|prefix.eq_ignore_ascii_case("Digest "))).ok_or_else(||ApiError::new("auth","Server did not return a supported Digest challenge."))?;
            if challenge.len()>16384{return Err(ApiError::new("auth","Digest challenge exceeds 16 KiB."));}
            let mut prompt=digest_auth::parse(challenge).map_err(|_|ApiError::new("auth","Unsupported Digest challenge."))?;
            let url=reqwest::Url::parse(&input.url).map_err(|_|ApiError::new("validation","Invalid Digest URL."))?;
            let uri=match url.query(){Some(query)=>format!("{}?{}",url.path(),query),None=>url.path().to_string()};
            let stream_body=input.body_ref.is_some()||input.multipart.is_some();if stream_body {if let Some(qop)=&prompt.qop {if qop.contains(&digest_auth::Qop::AUTH){prompt.qop=Some(vec![digest_auth::Qop::AUTH]);}else{return Err(ApiError::new("unsupported","Digest auth-int-only challenges require a buffered body; streamed files/multipart support qop=auth."));}}}
            let context=digest_auth::AuthContext::new_with_method(credentials.username.as_str(),credentials.password.as_str(),uri.as_str(),if stream_body{None}else{Some(input.body.as_bytes())},digest_auth::HttpMethod(input.method.as_str().into()));
            let authorization=prompt.respond(&context).map_err(|_|ApiError::new("auth","Unsupported Digest algorithm or qop."))?.to_header_string();
            // Exactly one challenge retry within the original timeout/cancel
            // scope. No nonce caching, automatic stale retry, or redirects.
            drop(response);
            response=build_request(db,input,client).await?.header(reqwest::header::AUTHORIZATION,authorization).send().await.map_err(network)?;
        }
    }
    let headers_ms=start.elapsed().as_millis() as u64;
    if response.content_length().is_some_and(|size|size>MAX_RESPONSE){return Err(ApiError::new("quota","Response exceeds the current 64 MiB limit."));}
    let status=response.status();let headers=response.headers().iter().map(|(k,v)|Header{key:k.to_string(),value:v.to_str().unwrap_or("[non-UTF8 header]").into()}).collect::<Vec<_>>();
    let final_url=response.url().to_string();let protocol=format!("{:?}",response.version());let mime=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v|v.to_str().ok()).unwrap_or("application/octet-stream").to_string();
    let id=uuid::Uuid::new_v4().to_string();let path=db.root.join("staging").join(format!("{id}.http-partial"));
    let mut pending=PendingFile{file:Some(OpenOptions::new().write(true).create_new(true).open(&path)?),path};
    let mut digest=Sha256::new();let mut size=0u64;let mut preview=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(network)? {
        size+=chunk.len() as u64;if size>MAX_RESPONSE{return Err(ApiError::new("quota","Response exceeds the current 64 MiB limit."));}
        preview.extend_from_slice(&chunk[..chunk.len().min(PREVIEW-preview.len())]);digest.update(&chunk);
        pending.file.as_mut().ok_or_else(||ApiError::new("storage","Response file closed."))?.write_all(&chunk)?;
    }
    let file=pending.file.take().ok_or_else(||ApiError::new("storage","Response file closed."))?;file.sync_all()?;drop(file);
    let _content=crate::platform::content_lock::ContentLock::enter(&db.root)?;let sha256=format!("{:x}",digest.finalize());let directory=db.root.join("bodies").join(&input.workspace_id);std::fs::create_dir_all(&directory)?;let destination=directory.join(&sha256);
    if !destination.exists(){std::fs::rename(&pending.path,&destination)?;}
    let body=BodyRef{workspace_id:input.workspace_id.clone(),id:id.clone(),sha256:sha256.clone(),size,mime_type:mime.clone()};
    let result=HttpResult{run_id:input.run_id.clone(),status:status.as_u16(),status_text:status.canonical_reason().unwrap_or("").into(),headers,final_url,protocol,duration_ms:start.elapsed().as_millis() as u64,size,preview_base64:STANDARD.encode(&preview),preview_truncated:size>PREVIEW as u64,body,timings:HttpTimings{headers_ms,body_ms:(start.elapsed().as_millis() as u64).saturating_sub(headers_ms)}};
    let mut snapshot=serde_json::json!({"source":"native_http","state":"completed","request":{"method":input.method,"url":input.url,"headers":input.headers,"bodyRef":input.body_ref},"response":{"status":result.status,"statusText":result.status_text,"headers":result.headers,"finalUrl":result.final_url,"protocol":result.protocol,"durationMs":result.duration_ms,"timings":result.timings,"body":result.body}});sanitize(&mut snapshot);
    let mut connection=db.lock()?;let tx=connection.transaction()?;
    let existing:String=tx.query_row("SELECT payload FROM entities WHERE workspace_id=?1 AND id=?2",params![input.workspace_id,input.run_id],|row|row.get(0))?;
    let envelope:serde_json::Value=serde_json::from_str(&existing)?;snapshot["request"]=envelope["request"].clone();
    tx.execute("INSERT INTO blobs(workspace_id,id,sha256,size,mime_type,created_at) VALUES(?1,?2,?3,?4,?5,?6)",params![input.workspace_id,id,sha256,size as i64,mime,now()])?;
    tx.execute("UPDATE entities SET name=?3,revision=revision+1,payload=?4,updated_at=?5 WHERE workspace_id=?1 AND id=?2 AND kind='api_run'",params![input.workspace_id,input.run_id,format!("{} {}",input.method,result.status),serde_json::to_string(&snapshot)?,now()])?;tx.commit()?;
    Ok(result)
}
impl Database {fn http_body_path(&self,workspace_id:&str,id:&str)->ApiResult<(PathBuf,u64)> {
    valid_id(id)?;let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
    let (hash,size):(String,i64)=connection.query_row("SELECT sha256,size FROM blobs WHERE workspace_id=?1 AND id=?2",params![workspace_id,id],|row|Ok((row.get(0)?,row.get(1)?)))?;
    if hash.len()!=64||!hash.chars().all(|c|c.is_ascii_hexdigit())||size<0{return Err(ApiError::new("storage","Invalid body file metadata."));}Ok((self.root.join("bodies").join(workspace_id).join(hash),size as u64))
}}
impl Database {
    fn http_snapshot_body(&self,workspace_id:&str,bytes:&[u8],mime:&str)->ApiResult<BodyRef>{
        let id=self.body_begin(workspace_id,bytes.len() as u64,mime)?;
        let result=(||{for (index,chunk) in bytes.chunks(256*1024).enumerate(){self.body_append(workspace_id,&id,(index*256*1024) as u64,&STANDARD.encode(chunk))?;}self.body_finish(workspace_id,&id)})();
        if result.is_err(){let _=self.body_cancel(workspace_id,&id);}result
    }
    fn http_begin_run(&self,input:&HttpInput)->ApiResult<()> {
        let body=if let Some(id)=&input.body_ref {let _=self.http_body_path(&input.workspace_id,id)?;serde_json::json!({"workspaceId":input.workspace_id,"id":id,"type":"binary"})}
        else if let Some(fields)=&input.multipart {serde_json::to_value(self.http_snapshot_body(&input.workspace_id,&serde_json::to_vec(&serde_json::json!({"fields":fields,"files":input.multipart_files}))?,"application/vnd.traffic-studio.multipart+json")?)?}
        else {serde_json::to_value(self.http_snapshot_body(&input.workspace_id,input.body.as_bytes(),"application/octet-stream")?)?};
        let mut snapshot=serde_json::json!({"source":"native_http","state":"running","startedAt":now(),"ownerPid":std::process::id(),"ownerStamp":crate::platform::process::stamp(std::process::id()).map(|value|value.to_string()),"request":{"method":input.method,"url":input.url,"headers":input.headers,"body":body,"protocol":input.protocol,"followRedirects":input.follow_redirects,"timeoutMs":input.timeout_ms,"proxyUrl":input.proxy_url,"tlsVerify":input.tls_verify,"customCaPem":input.custom_ca_pem,"cookiesEnabled":input.cookies_enabled}});sanitize(&mut snapshot);
        let connection=self.lock()?;Self::require_workspace(&connection,&input.workspace_id)?;
        connection.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'api_run',?3,1,1,?4,?5)",params![input.workspace_id,input.run_id,format!("{} running",input.method),serde_json::to_string(&snapshot)?,now()])?;Ok(())
    }
    fn http_end_failed(&self,input:&HttpInput,error:&ApiError)->ApiResult<()> {
        let state=if error.code=="cancelled"{"cancelled"}else if error.code=="timeout"{"timed_out"}else{"failed"};
        self.lock()?.execute("UPDATE entities SET name=?3,revision=revision+1,payload=json_set(payload,'$.state',?4,'$.error',json(?5),'$.endedAt',?6),updated_at=?6 WHERE workspace_id=?1 AND id=?2 AND kind='api_run'",params![input.workspace_id,input.run_id,format!("{} {}",input.method,state),state,serde_json::to_string(error)?,now()])?;Ok(())
    }
}
