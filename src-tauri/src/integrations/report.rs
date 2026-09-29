use crate::{domain::*,storage::Database};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct ReportInput {pub workspace_id:String,pub session_id:String,pub url:String,pub acknowledged:bool,pub preview_digest:String}
pub async fn deliver(db:&Database,input:ReportInput)->ApiResult<u16>{
 if !input.acknowledged{return Err(ApiError::new("permission","Preview and confirm the destination and redacted metadata before sending."));}
 let url=reqwest::Url::parse(&input.url).map_err(|_|ApiError::new("validation","Invalid report URL"))?;let loopback=matches!(url.host_str(),Some("127.0.0.1"|"[::1]"));if !(url.scheme()=="https"||url.scheme()=="http"&&loopback)||!url.username().is_empty()||url.password().is_some()||url.fragment().is_some(){return Err(ApiError::new("validation","Use HTTPS, or literal loopback HTTP, without credentials/fragment."));}
 let value=db.export_har_value(&input.workspace_id,&input.session_id,false,false)?;let mut payload=value;redact(&mut payload);let bytes=serde_json::to_vec(&payload)?;if bytes.len()>8*1024*1024{return Err(ApiError::new("quota","Report metadata exceeds 8 MiB"));}if digest(&payload)?!=input.preview_digest{return Err(ApiError::new("conflict","Session changed since preview. Preview and approve the current metadata again."));}
 let client=reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(30)).build().map_err(|_|ApiError::new("runtime","Report transport unavailable"))?;
 let response=client.post(url).header("Content-Type","application/json").body(bytes).send().await.map_err(|_|ApiError::new("network","Report delivery failed; no automatic retry"))?;let status=response.status();if !status.is_success(){return Err(ApiError::new("network","Report endpoint returned an unsuccessful status; body suppressed"));}Ok(status.as_u16())
}
pub fn digest(value:&serde_json::Value)->ApiResult<String>{use sha2::{Digest,Sha256};Ok(format!("{:x}",Sha256::digest(serde_json::to_vec(value)?)))}
pub fn redact(value:&mut serde_json::Value){match value{
 serde_json::Value::Object(map)=>{for key in ["headers","cookies","postData","text","queryString"]{map.remove(key);}for (key,value) in map.iter_mut(){if key=="url"{if let Some(raw)=value.as_str(){if let Ok(mut url)=reqwest::Url::parse(raw){url.set_query(None);url.set_fragment(None);*value=serde_json::json!(url.to_string());}}}else{redact(value);}}},
 serde_json::Value::Array(rows)=>for row in rows{redact(row)},_=>{}
}}
