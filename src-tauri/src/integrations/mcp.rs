use crate::{domain::*,storage::Database};
use rusqlite::params;
use serde::{Deserialize,Serialize};
use serde_json::{Value,json};
use base64::{engine::general_purpose::STANDARD,Engine};
use std::sync::{Arc,Mutex};
use tokio::{io::{AsyncReadExt,AsyncWriteExt},net::{TcpListener,TcpStream},sync::{oneshot,Semaphore}};
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct McpStatus {pub running:bool,pub workspace_id:Option<String>,pub port:Option<u16>,pub token:Option<String>,pub draft_writes:bool,pub flow_reads:bool}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct AuditRecord {pub id:i64,pub created_at:i64,pub operation:String,pub outcome:String}
struct RateWindow {started:std::time::Instant,count:u32}
impl RateWindow {fn allow(&mut self)->bool{if self.started.elapsed()>=std::time::Duration::from_secs(60){self.started=std::time::Instant::now();self.count=0;}if self.count>=120{return false;}self.count+=1;true}}
struct Listener {workspace:String,port:u16,draft_writes:bool,flow_reads:bool,stop:oneshot::Sender<()>}
#[derive(Default)]
pub struct McpRuntime {listener:Mutex<Option<Listener>>}
impl McpRuntime {
 pub fn status(&self)->ApiResult<McpStatus>{let guard=self.listener.lock().map_err(|_|ApiError::new("runtime","MCP worker unavailable"))?;Ok(McpStatus{running:guard.is_some(),workspace_id:guard.as_ref().map(|r|r.workspace.clone()),port:guard.as_ref().map(|r|r.port),token:None,draft_writes:guard.as_ref().is_some_and(|r|r.draft_writes),flow_reads:guard.as_ref().is_some_and(|r|r.flow_reads)})}
 pub async fn start(&self,db:&Database,workspace:String,port:u16,acknowledged:bool,draft_writes:bool,flow_reads:bool)->ApiResult<McpStatus>{
  if !acknowledged{return Err(ApiError::new("permission","Explicit workspace permission required"));}{let c=db.lock()?;Database::require_workspace(&c,&workspace)?;}
  let socket=TcpListener::bind(("127.0.0.1",port)).await.map_err(|_|ApiError::new("network","MCP localhost port unavailable"))?;let port=socket.local_addr().map_err(|_|ApiError::new("network","MCP bound port unavailable"))?.port();let mut guard=self.listener.lock().map_err(|_|ApiError::new("runtime","MCP worker unavailable"))?;if guard.is_some(){return Err(ApiError::new("conflict","Stop the current MCP listener first"));}
  let token=format!("{}{}",uuid::Uuid::new_v4(),uuid::Uuid::new_v4());let (stop_tx,mut stop_rx)=oneshot::channel();*guard=Some(Listener{workspace:workspace.clone(),port,draft_writes,flow_reads,stop:stop_tx});drop(guard);
  let database=db.clone();let scope=workspace.clone();let key=token.clone();tauri::async_runtime::spawn(async move{let semaphore=Arc::new(Semaphore::new(8));let rate=Arc::new(Mutex::new(RateWindow{started:std::time::Instant::now(),count:0}));let mut tasks=tokio::task::JoinSet::new();loop{tokio::select!{
   _=&mut stop_rx=>{tasks.abort_all();break;},
   incoming=socket.accept()=>{let Ok((stream,_))=incoming else{break};let Ok(permit)=semaphore.clone().try_acquire_owned()else{drop(stream);continue};let db=database.clone();let workspace=scope.clone();let key=key.clone();let rate=rate.clone();tasks.spawn(async move{let _permit=permit;let _=tokio::time::timeout(std::time::Duration::from_secs(10),handle(stream,&db,&workspace,port,&key,&rate,draft_writes,flow_reads)).await;});},
   _=tasks.join_next(),if !tasks.is_empty()=>{}
  }}});
  Ok(McpStatus{running:true,workspace_id:Some(workspace),port:Some(port),token:Some(token),draft_writes,flow_reads})
 }
 pub fn stop(&self)->ApiResult<()>{if let Some(listener)=self.listener.lock().map_err(|_|ApiError::new("runtime","MCP worker unavailable"))?.take(){let _=listener.stop.send(());}Ok(())}
}
impl Drop for McpRuntime{fn drop(&mut self){let _=self.stop();}}
async fn respond(stream:&mut TcpStream,status:&str,value:Value)->ApiResult<()>{let data=serde_json::to_vec(&value)?;let header=format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n",data.len());stream.write_all(header.as_bytes()).await?;stream.write_all(&data).await?;Ok(())}
async fn accepted_notification(stream:&mut TcpStream)->ApiResult<()>{stream.write_all(b"HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n").await?;Ok(())}
async fn handle(mut stream:TcpStream,db:&Database,workspace:&str,port:u16,token:&str,rate:&Mutex<RateWindow>,draft_writes:bool,flow_reads:bool)->ApiResult<()>{
 let mut buffer=Vec::new();let mut byte=[0u8;1];while !buffer.ends_with(b"\r\n\r\n"){if buffer.len()>=8192{return respond(&mut stream,"431 Request Header Fields Too Large",json!({"error":"Headers too large"})).await;}if stream.read(&mut byte).await?==0{return Ok(());}buffer.push(byte[0]);}
 let Ok(text)=std::str::from_utf8(&buffer)else{return respond(&mut stream,"400 Bad Request",json!({"error":"Invalid headers"})).await};let mut lines=text.split("\r\n");let request_line=lines.next().unwrap_or("");if !["POST /mcp HTTP/1.1","GET /mcp HTTP/1.1","DELETE /mcp HTTP/1.1"].contains(&request_line){return respond(&mut stream,"404 Not Found",json!({"error":"MCP endpoint is /mcp"})).await;}
 let mut headers=std::collections::HashMap::new();for line in lines.filter(|s|!s.is_empty()){let Some((key,value))=line.split_once(':')else{return respond(&mut stream,"400 Bad Request",json!({"error":"Invalid headers"})).await};if headers.insert(key.trim().to_lowercase(),value.trim().to_string()).is_some(){return respond(&mut stream,"400 Bad Request",json!({"error":"Duplicate headers"})).await;}}
 if headers.contains_key("origin")||headers.get("host")!=Some(&format!("127.0.0.1:{port}")){return respond(&mut stream,"403 Forbidden",json!({"error":"Origin/Host rejected"})).await;}
 let expected=format!("Bearer {token}");let actual=headers.get("authorization").map(String::as_bytes).unwrap_or(&[]);if actual.len()!=expected.len()||actual.iter().zip(expected.bytes()).fold(0u8,|difference,(a,b)|difference|(*a^b))!=0{return respond(&mut stream,"401 Unauthorized",json!({"error":"Bearer token required"})).await;}
 if let Some(version)=headers.get("mcp-protocol-version"){if !["2025-11-25","2025-03-26"].contains(&version.as_str()){return respond(&mut stream,"400 Bad Request",json!({"error":"Unsupported MCP protocol version"})).await;}}
 if request_line!="POST /mcp HTTP/1.1"{return respond(&mut stream,"405 Method Not Allowed",json!({"error":"This stateless MCP endpoint does not offer SSE or client session deletion"})).await;}
 if headers.contains_key("transfer-encoding")||!headers.get("content-type").is_some_and(|s|s.starts_with("application/json")){return respond(&mut stream,"400 Bad Request",json!({"error":"JSON Content-Length required"})).await;}
 let Some(size)=headers.get("content-length").and_then(|s|s.parse::<usize>().ok()).filter(|n|*n<=65536)else{return respond(&mut stream,"413 Content Too Large",json!({"error":"Payload too large or length missing"})).await};let mut body=vec![0;size];stream.read_exact(&mut body).await?;
 if !rate.lock().map_err(|_|ApiError::new("runtime","MCP limiter unavailable"))?.allow(){return respond(&mut stream,"429 Too Many Requests",json!({"error":"120 authenticated requests per minute allowed"})).await;}
 let request:Value=match serde_json::from_slice(&body){Ok(value)=>value,Err(_)=>return respond(&mut stream,"400 Bad Request",json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}})).await};if request["jsonrpc"]!="2.0"||!request.is_object(){return respond(&mut stream,"400 Bad Request",json!({"error":"Invalid JSON-RPC request"})).await;}
 if request["method"].as_str().is_some_and(|method|method.starts_with("notifications/")){let operation=match request["method"].as_str(){Some("notifications/initialized")=>"notifications/initialized",Some("notifications/cancelled")=>"notifications/cancelled",_=>"notifications/other"};db.audit_mcp(workspace,operation,true)?;return accepted_notification(&mut stream).await;}
 let operation=match request["method"].as_str().unwrap_or(""){"initialize"=>"initialize","ping"=>"ping","tools/list"=>"tools/list","tools/call"=>match request["params"]["name"].as_str().unwrap_or(""){"list_sessions"=>"tools/call:list_sessions","list_flows"=>"tools/call:list_flows","list_collections"=>"tools/call:list_collections","read_flow"=>"tools/call:read_flow","save_draft"=>"tools/call:save_draft",_=>"tools/call:unsupported"},_=>"unsupported"};
 let id=request.get("id").cloned().unwrap_or(Value::Null);let result=rpc(db,workspace,&request,draft_writes,flow_reads);db.audit_mcp(workspace,operation,result.is_ok())?;let response=match result{Ok(result)=>json!({"jsonrpc":"2.0","id":id,"result":result}),Err(error)=>json!({"jsonrpc":"2.0","id":id,"error":{"code":-32602,"message":error.message}})};respond(&mut stream,"200 OK",response).await
}
impl Database {
 fn audit_mcp(&self,workspace:&str,operation:&str,success:bool)->ApiResult<()>{let connection=self.lock()?;Self::require_workspace(&connection,workspace)?;connection.execute("INSERT INTO mcp_audit(workspace_id,created_at,operation,outcome) VALUES(?1,?2,?3,?4)",params![workspace,now(),operation,if success{"ok"}else{"rejected"}])?;Ok(())}
 pub fn mcp_audit(&self,workspace:&str,limit:u32)->ApiResult<Vec<AuditRecord>>{let connection=self.lock()?;Self::require_workspace(&connection,workspace)?;let mut statement=connection.prepare("SELECT id,created_at,operation,outcome FROM mcp_audit WHERE workspace_id=?1 ORDER BY id DESC LIMIT ?2")?;let rows=statement.query_map(params![workspace,limit.clamp(1,200)],|r|Ok(AuditRecord{id:r.get(0)?,created_at:r.get(1)?,operation:r.get(2)?,outcome:r.get(3)?}))?.collect::<Result<Vec<_>,_>>()?;Ok(rows)}
}
pub fn rpc(db:&Database,workspace:&str,request:&Value,draft_writes:bool,flow_reads:bool)->ApiResult<Value>{
 match request["method"].as_str().unwrap_or(""){
  "initialize"=>{let requested=request["params"]["protocolVersion"].as_str().unwrap_or("");if requested.is_empty(){return Err(ApiError::new("validation","Client protocolVersion required."));}let version=if ["2025-11-25","2025-03-26"].contains(&requested){requested}else{"2025-11-25"};Ok(json!({"protocolVersion":version,"capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"traffic-studio-local","version":"0.1.0"}}))},
  "ping"=>Ok(json!({})),
  "tools/list"=>Ok(tool_list(draft_writes,flow_reads)),
  "tools/call"=>{let name=request["params"]["name"].as_str().unwrap_or("");if name=="save_draft"{if !draft_writes{return Err(ApiError::new("permission","Draft write capability was not granted."));}return save_draft(db,workspace,&request["params"]["arguments"]);}if name=="read_flow"{if !flow_reads{return Err(ApiError::new("permission","Captured flow read capability was not granted."));}return read_flow(db,workspace,&request["params"]["arguments"]);}let kind=match name{"list_sessions"=>"session","list_flows"=>"flow","list_collections"=>"collection",_=>return Err(ApiError::new("unsupported","Tool unavailable. Execution, deletion and trust changes are not exposed."))};let offset=request["params"]["arguments"]["offset"].as_u64().unwrap_or(0);if offset>u32::MAX as u64{return Err(ApiError::new("validation","Invalid page offset"));}let rows=db.query(workspace,kind,100,offset as u32)?;let count=rows.len();let data=rows.into_iter().map(|row|{let url=row.payload["url"].as_str().and_then(|u|reqwest::Url::parse(u).ok()).map(|mut u|{u.set_query(None);u.set_fragment(None);let _=u.set_username("");let _=u.set_password(None);u.to_string()});json!({"id":row.id,"name":row.name,"kind":row.kind,"revision":row.revision,"url":url,"method":row.payload["method"],"status":row.payload["status"],"source":row.payload["source"]})}).collect::<Vec<_>>();Ok(json!({"content":[{"type":"text","text":serde_json::to_string(&json!({"rows":data,"nextOffset":if count==100{Some(offset+100)}else{None}}))?}],"isError":false}))},
  _=>Err(ApiError::new("unsupported","MCP method unavailable"))
 }
}
fn tool_list(draft_writes:bool,flow_reads:bool)->Value{
 let mut tools=vec![json!({"name":"list_sessions","description":"Read session metadata in the explicitly permitted workspace","inputSchema":{"type":"object","properties":{"offset":{"type":"integer","minimum":0}},"additionalProperties":false}}),json!({"name":"list_flows","description":"Read redacted flow metadata; no headers, bodies or URL query values","inputSchema":{"type":"object","properties":{"offset":{"type":"integer","minimum":0}},"additionalProperties":false}}),json!({"name":"list_collections","description":"Read collection IDs, titles and revisions only","inputSchema":{"type":"object","properties":{"offset":{"type":"integer","minimum":0}},"additionalProperties":false}})];
 if flow_reads{tools.push(json!({"name":"read_flow","description":"Read one native proxy-captured HTTP flow, including common credential-header redaction and bounded decoded request/response body previews. Body content can still contain secrets. Never decrypts packets captured outside the proxy.","inputSchema":{"type":"object","required":["id"],"properties":{"id":{"type":"string","format":"uuid"}},"additionalProperties":false}}));}
 if draft_writes{tools.push(json!({"name":"save_draft","description":"Create or update an inert request, collection, or rule-set draft in the permitted workspace. Requires an exact expected revision. Never sends a request or applies rules.","inputSchema":{"type":"object","required":["id","expectedRevision","kind","name"],"properties":{"id":{"type":"string","format":"uuid"},"expectedRevision":{"type":"integer","minimum":0},"kind":{"enum":["request","collection","rule_set"]},"name":{"type":"string","minLength":1,"maxLength":80},"method":{"type":"string"},"url":{"type":"string"},"body":{"type":"string"},"parentId":{"type":["string","null"]},"rules":{"type":"array"}},"additionalProperties":false}}));}json!({"tools":tools})
}
fn redacted_headers(headers:&Value)->Vec<Value>{
 headers.as_array().into_iter().flatten().filter_map(|header|{
  let key=header["key"].as_str().or_else(||header["name"].as_str())?;
  let value=header["value"].as_str()?;
  let hidden=["authorization","proxy-authorization","cookie","set-cookie","x-api-key","api-key"].iter().any(|secret|key.eq_ignore_ascii_case(secret));
  Some(json!({"key":key,"value":if hidden{"[redacted]"}else{value}}))
 }).collect()
}
fn content_encoding(headers:&Value)->String{
 headers.as_array().into_iter().flatten().find_map(|header|{
  let key=header["key"].as_str().or_else(||header["name"].as_str())?;
  if key.eq_ignore_ascii_case("content-encoding"){header["value"].as_str().map(str::to_owned)}else{None}
 }).unwrap_or_else(||"identity".into())
}
fn body_preview(db:&Database,workspace:&str,reference:&Value,headers:&Value)->Value{
 let Some(id)=reference["id"].as_str()else{return json!({"available":false,"reason":if reference["unavailable"].is_null(){"No captured body"}else{"Original body unavailable"}})};
 match db.decode_body(workspace,id,&content_encoding(headers),false){
  Ok(decoded)=>match STANDARD.decode(decoded.base64.as_bytes()){
   Ok(bytes)=>{
    const LIMIT:usize=64*1024;
    let preview=&bytes[..bytes.len().min(LIMIT)];let truncated=decoded.truncated||bytes.len()>LIMIT;
    match std::str::from_utf8(preview){
     Ok(text) if !text.chars().any(|c|c=='\0')=>json!({"available":true,"format":"utf8","text":text,"decodedSize":decoded.decoded_size,"truncated":truncated}),
     _=>json!({"available":true,"format":"base64","base64":STANDARD.encode(preview),"decodedSize":decoded.decoded_size,"truncated":truncated})
    }
   },
   Err(_)=>json!({"available":false,"reason":"Body preview could not be decoded"})
  },
  Err(error)=>json!({"available":false,"reason":error.message})
 }
}
fn read_flow(db:&Database,workspace:&str,args:&Value)->ApiResult<Value>{
 let id=args["id"].as_str().ok_or_else(||ApiError::new("validation","Captured flow ID required."))?;valid_id(id)?;
 let flow=db.get(workspace,id)?;
 if flow.kind!="flow"||flow.payload["source"]!="native_capture"||flow.payload["type"]!="flow"{return Err(ApiError::new("validation","Only completed native proxy-captured HTTP flows can be read."));}
 let payload=&flow.payload;
 let url=payload["url"].as_str().and_then(|value|reqwest::Url::parse(value).ok()).map(|mut parsed|{parsed.set_query(None);parsed.set_fragment(None);let _=parsed.set_username("");let _=parsed.set_password(None);parsed.to_string()});
 let data=json!({"id":flow.id,"source":"native_capture","inspection":"proxy_http","url":url,"method":payload["method"],"status":payload["status"],"protocol":payload["protocol"],"startedAt":payload["startedAt"],"durationMs":payload["durationMs"],"request":{"headers":redacted_headers(&payload["requestHeaders"]),"body":body_preview(db,workspace,&payload["requestBody"],&payload["requestHeaders"])},"response":{"headers":redacted_headers(&payload["responseHeaders"]),"body":body_preview(db,workspace,&payload["responseBody"],&payload["responseHeaders"])}});
 Ok(json!({"content":[{"type":"text","text":serde_json::to_string(&data)?}],"isError":false}))
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct DraftArgs {id:String,expected_revision:i64,kind:String,name:String,#[serde(default)]method:Option<String>,#[serde(default)]url:Option<String>,#[serde(default)]body:Option<String>,#[serde(default)]parent_id:Option<String>,#[serde(default)]rules:Option<Vec<crate::rules::Rule>>}
fn save_draft(db:&Database,workspace:&str,value:&Value)->ApiResult<Value>{
 let args:DraftArgs=serde_json::from_value(value.clone())?;valid_id(&args.id)?;valid_name(&args.name)?;if args.expected_revision<0{return Err(ApiError::new("validation","Expected revision must be nonnegative."));}
 let payload=match args.kind.as_str(){
  "request"=>{if args.parent_id.is_some()||args.rules.is_some(){return Err(ApiError::new("validation","Request draft fields are invalid."));}let method=args.method.ok_or_else(||ApiError::new("validation","Request method required."))?;if method.is_empty()||method.len()>20||!method.bytes().all(|c|c.is_ascii_uppercase()||c==b'-'){return Err(ApiError::new("validation","Invalid request method."));}let url=args.url.ok_or_else(||ApiError::new("validation","Request URL required."))?;let parsed=reqwest::Url::parse(&url).map_err(|_|ApiError::new("validation","Invalid request URL."))?;if !["http","https"].contains(&parsed.scheme())||!parsed.username().is_empty()||parsed.password().is_some()||parsed.fragment().is_some(){return Err(ApiError::new("validation","Use an HTTP(S) request URL without credentials or fragment."));}let body=args.body.unwrap_or_default();if body.len()>65536{return Err(ApiError::new("quota","Draft body exceeds 64 KiB."));}let body_mode=if body.is_empty(){"None"}else{"Text"};json!({"documentType":"http_request","source":"mcp_draft","draft":{"name":args.name,"method":method,"url":url,"body":body,"bodyMode":body_mode,"params":[],"headers":[],"auth":"","variables":[],"docs":""}})},
  "collection"=>{if args.method.is_some()||args.url.is_some()||args.body.is_some()||args.rules.is_some(){return Err(ApiError::new("validation","Collection fields are invalid."));}if let Some(parent)=&args.parent_id{valid_id(parent)?;if parent==&args.id||db.get(workspace,parent)?.kind!="collection"{return Err(ApiError::new("validation","Parent must be a different collection in this workspace."));}}json!({"documentType":"collection","source":"mcp_draft","parentId":args.parent_id,"variables":[]})},
  "rule_set"=>{if args.method.is_some()||args.url.is_some()||args.body.is_some()||args.parent_id.is_some(){return Err(ApiError::new("validation","Rule-set fields are invalid."));}let rules=args.rules.ok_or_else(||ApiError::new("validation","Rule array required."))?;crate::rules::validate(&rules)?;json!({"documentType":"capture_rules","source":"mcp_draft","rules":rules})},
  _=>return Err(ApiError::new("unsupported","Only request, collection and rule-set drafts may be saved."))
 };
 let saved=db.save(SaveEntity{workspace_id:workspace.into(),id:args.id,kind:args.kind,name:args.name,expected_revision:args.expected_revision,payload})?;Ok(json!({"content":[{"type":"text","text":serde_json::to_string(&json!({"id":saved.id,"kind":saved.kind,"revision":saved.revision}))?}],"isError":false}))
}
#[cfg(test)]mod tests{
 use super::*;
 #[tokio::test]async fn initialized_notification_returns_empty_202(){
  let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let workspace=db.create_workspace("Notification fixture").unwrap();
  let runtime=McpRuntime::default();let started=runtime.start(&db,workspace.id,0,true,false,false).await.unwrap();let port=started.port.unwrap();assert_ne!(port,0);let token=started.token.unwrap();let client=reqwest::Client::builder().no_proxy().build().unwrap();let response=client.post(format!("http://127.0.0.1:{port}/mcp")).bearer_auth(token).header("Content-Type","application/json").body(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#).send().await.unwrap();assert_eq!(response.status().as_u16(),202);assert!(response.bytes().await.unwrap().is_empty());runtime.stop().unwrap();
 }
 #[tokio::test]async fn streamable_http_client_handshake_and_stateless_get(){
  let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let workspace=db.create_workspace("MCP transport").unwrap();let runtime=McpRuntime::default();let started=runtime.start(&db,workspace.id,0,true,false,true).await.unwrap();let url=format!("http://127.0.0.1:{}/mcp",started.port.unwrap());let token=started.token.unwrap();let client=reqwest::Client::builder().no_proxy().build().unwrap();
  let initialize=json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}});
  let response=client.post(&url).bearer_auth(&token).header("Accept","application/json, text/event-stream").header("Content-Type","application/json").body(serde_json::to_vec(&initialize).unwrap()).send().await.unwrap();assert_eq!(response.status().as_u16(),200);let value:Value=serde_json::from_str(&response.text().await.unwrap()).unwrap();assert_eq!(value["result"]["protocolVersion"],"2025-03-26");
  let initialized=client.post(&url).bearer_auth(&token).header("MCP-Protocol-Version","2025-03-26").header("Accept","application/json, text/event-stream").header("Content-Type","application/json").body(serde_json::to_vec(&json!({"jsonrpc":"2.0","method":"notifications/initialized"})).unwrap()).send().await.unwrap();assert_eq!(initialized.status().as_u16(),202);assert!(initialized.bytes().await.unwrap().is_empty());
  let listed=client.post(&url).bearer_auth(&token).header("MCP-Protocol-Version","2025-03-26").header("Accept","application/json, text/event-stream").header("Content-Type","application/json").body(serde_json::to_vec(&json!({"jsonrpc":"2.0","id":2,"method":"tools/list"})).unwrap()).send().await.unwrap();assert_eq!(listed.status().as_u16(),200);let tools:Value=serde_json::from_str(&listed.text().await.unwrap()).unwrap();assert!(tools["result"]["tools"].as_array().unwrap().iter().any(|tool|tool["name"]=="read_flow"));
  let get=client.get(&url).bearer_auth(&token).header("Accept","text/event-stream").send().await.unwrap();assert_eq!(get.status().as_u16(),405);
  let invalid=client.post(&url).bearer_auth(&token).header("MCP-Protocol-Version","invalid").header("Content-Type","application/json").body(serde_json::to_vec(&initialize).unwrap()).send().await.unwrap();assert_eq!(invalid.status().as_u16(),400);runtime.stop().unwrap();
 }
 #[tokio::test]async fn authenticated_scoped_metadata_and_revoke(){let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let workspace=db.create_workspace("MCP fixture").unwrap();let second=db.create_workspace("Hidden workspace").unwrap();db.save(SaveEntity{workspace_id:workspace.id.clone(),id:uuid::Uuid::new_v4().to_string(),kind:"flow".into(),name:"Permitted flow".into(),expected_revision:0,payload:json!({"url":"https://example.com/path?token=secret","method":"GET","source":"native_capture","status":200})}).unwrap();db.save(SaveEntity{workspace_id:second.id,id:uuid::Uuid::new_v4().to_string(),kind:"flow".into(),name:"Hidden flow".into(),expected_revision:0,payload:json!({"url":"https://hidden.invalid/"})}).unwrap();let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();drop(listener);let runtime=McpRuntime::default();let started=runtime.start(&db,workspace.id.clone(),port,true,false,false).await.unwrap();let client=reqwest::Client::builder().no_proxy().build().unwrap();let url=format!("http://127.0.0.1:{port}/mcp");let payload=json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_flows","arguments":{}}});let unauthenticated=client.post(&url).header("Content-Type","application/json").body(serde_json::to_vec(&payload).unwrap()).send().await.unwrap();assert_eq!(unauthenticated.status().as_u16(),401);let response=client.post(&url).bearer_auth(started.token.unwrap()).header("Content-Type","application/json").body(serde_json::to_vec(&payload).unwrap()).send().await.unwrap().text().await.unwrap();assert!(response.contains("Permitted flow"));assert!(!response.contains("Hidden flow"));assert!(!response.contains("token=secret"));runtime.stop().unwrap();tokio::time::sleep(std::time::Duration::from_millis(100)).await;assert!(client.post(url).header("Content-Type","application/json").body(serde_json::to_vec(&payload).unwrap()).send().await.is_err());}
 #[tokio::test]async fn rate_limit_and_audit_do_not_store_tokens(){
  let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let workspace=db.create_workspace("MCP audit fixture").unwrap();let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();drop(listener);
  let runtime=McpRuntime::default();let token=runtime.start(&db,workspace.id.clone(),port,true,false,false).await.unwrap().token.unwrap();let client=reqwest::Client::builder().no_proxy().build().unwrap();let url=format!("http://127.0.0.1:{port}/mcp");let payload=serde_json::to_vec(&json!({"jsonrpc":"2.0","id":1,"method":"ping"})).unwrap();
  for _ in 0..120{let response=client.post(&url).bearer_auth(&token).header("Content-Type","application/json").body(payload.clone()).send().await.unwrap();assert_eq!(response.status().as_u16(),200);}
  let limited=client.post(&url).bearer_auth(&token).header("Content-Type","application/json").body(payload).send().await.unwrap();assert_eq!(limited.status().as_u16(),429);let audit=db.mcp_audit(&workspace.id,200).unwrap();assert_eq!(audit.len(),120);assert!(audit.iter().all(|row|row.operation=="ping"&&row.outcome=="ok"));let raw=std::fs::read(temp.path().join("workspace.sqlite3")).unwrap();assert!(!raw.windows(token.len()).any(|window|window==token.as_bytes()));runtime.stop().unwrap();
 }
 #[test]fn draft_write_capability_is_scoped_and_revision_guarded(){
  let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let permitted=db.create_workspace("Permitted").unwrap();let other=db.create_workspace("Other").unwrap();let request_id=uuid::Uuid::new_v4().to_string();
  let call=|kind:&str,id:&str,revision:i64,extra:Value|{let mut args=json!({"kind":kind,"id":id,"expectedRevision":revision,"name":"Draft"});for(key,value)in extra.as_object().unwrap(){args[key]=value.clone();}json!({"method":"tools/call","params":{"name":"save_draft","arguments":args}})};
  let request=call("request",&request_id,0,json!({"method":"GET","url":"https://example.invalid/path","body":""}));assert!(rpc(&db,&permitted.id,&request,false,false).is_err());assert!(rpc(&db,&permitted.id,&request,true,false).is_ok());assert_eq!(db.get(&permitted.id,&request_id).unwrap().kind,"request");assert!(db.get(&other.id,&request_id).is_err());assert!(rpc(&db,&permitted.id,&request,true,false).is_err());
  let collection_id=uuid::Uuid::new_v4().to_string();assert!(rpc(&db,&permitted.id,&call("collection",&collection_id,0,json!({})),true,false).is_ok());
  let rules_id=uuid::Uuid::new_v4().to_string();let rule_id=uuid::Uuid::new_v4().to_string();let rule=call("rule_set",&rules_id,0,json!({"rules":[{"id":rule_id,"enabled":true,"match":"/fixture","action":"mock","status":200,"body":"safe draft"}]}));assert!(rpc(&db,&permitted.id,&rule,true,false).is_ok());assert_eq!(db.get(&permitted.id,&rules_id).unwrap().payload["documentType"],"capture_rules");
  assert_eq!(tool_list(false,false)["tools"].as_array().unwrap().len(),3);assert_eq!(tool_list(true,false)["tools"].as_array().unwrap().len(),4);
 }
 #[test]fn flow_read_requires_opt_in_native_source_and_workspace(){
  let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let permitted=db.create_workspace("Capture").unwrap();let other=db.create_workspace("Other").unwrap();
  let body=db.body_begin(&permitted.id,12,"text/plain").unwrap();db.body_append(&permitted.id,&body,0,"aGVsbG8gd29ybGQh").unwrap();db.body_finish(&permitted.id,&body).unwrap();
  let id=uuid::Uuid::new_v4().to_string();db.save(SaveEntity{workspace_id:permitted.id.clone(),id:id.clone(),kind:"flow".into(),name:"Captured flow".into(),expected_revision:0,payload:json!({"type":"flow","source":"native_capture","url":"https://user:password@example.test/path?token=hidden#fragment","method":"POST","status":200,"requestHeaders":[{"key":"Content-Type","value":"text/plain"}],"requestBody":{"id":body}})}).unwrap();
  let mut raw=db.get(&permitted.id,&id).unwrap().payload;raw["requestHeaders"]=json!([{"key":"Authorization","value":"Bearer secret"},{"key":"Content-Type","value":"text/plain"}]);raw["responseHeaders"]=json!([{"key":"Set-Cookie","value":"session=secret"}]);db.lock().unwrap().execute("UPDATE entities SET payload=?1 WHERE workspace_id=?2 AND id=?3",params![raw.to_string(),permitted.id,id]).unwrap();
  let call=json!({"method":"tools/call","params":{"name":"read_flow","arguments":{"id":id}}});
  assert!(rpc(&db,&permitted.id,&call,false,false).is_err());assert!(rpc(&db,&other.id,&call,false,true).is_err());
  let result=rpc(&db,&permitted.id,&call,false,true).unwrap();let text=result["content"][0]["text"].as_str().unwrap();let data:Value=serde_json::from_str(text).unwrap();
  assert_eq!(data["request"]["body"]["text"],"hello world!");assert!(data["request"]["headers"].as_array().unwrap().iter().any(|header|header["key"]=="Authorization"&&header["value"]=="[redacted]"));assert!(data["response"]["headers"].as_array().unwrap().iter().any(|header|header["key"]=="Set-Cookie"&&header["value"]=="[redacted]"));assert_eq!(data["url"],"https://example.test/path");assert!(!text.contains("hidden"));assert!(!text.contains("password"));
  let imported=uuid::Uuid::new_v4().to_string();db.save(SaveEntity{workspace_id:permitted.id.clone(),id:imported.clone(),kind:"flow".into(),name:"Imported".into(),expected_revision:0,payload:json!({"type":"flow","source":"har_import"})}).unwrap();assert!(rpc(&db,&permitted.id,&json!({"method":"tools/call","params":{"name":"read_flow","arguments":{"id":imported}}}),false,true).is_err());
  assert_eq!(tool_list(false,true)["tools"].as_array().unwrap().len(),4);
 }
}
