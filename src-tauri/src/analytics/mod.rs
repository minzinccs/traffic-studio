use crate::{domain::*,storage::Database};
use rusqlite::params;
use serde::{Deserialize,Serialize};
use std::collections::BTreeMap;
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct AnalyticsInput {pub workspace_id:String,pub session_id:Option<String>,pub since:i64,pub until:i64,pub host:Option<String>}
#[derive(Default,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Metrics {pub requests:u64,pub errors:u64,pub payload_bytes:u64,pub measured_durations:u64,pub average_ms:Option<f64>,pub p95_ms:Option<f64>,pub hosts:BTreeMap<String,u64>,pub statuses:BTreeMap<String,u64>,pub protocols:BTreeMap<String,u64>,pub endpoints:BTreeMap<String,u64>}
impl Database {
 pub fn analytics(&self,input:AnalyticsInput)->ApiResult<Metrics>{
  if input.since<0||input.until<input.since||input.host.as_ref().is_some_and(|h|h.len()>256){return Err(ApiError::new("validation","Invalid analytics time/host bounds."));}if let Some(id)=&input.session_id{valid_id(id)?;}
  let connection=self.lock()?;Self::require_workspace(&connection,&input.workspace_id)?;let mut statement=connection.prepare("SELECT payload FROM entities WHERE workspace_id=?1 AND kind IN ('flow','api_run') AND updated_at BETWEEN ?2 AND ?3 AND (?4 IS NULL OR json_extract(payload,'$.sessionId')=?4) LIMIT 1000001")?;
  let mut rows=statement.query(params![input.workspace_id,input.since,input.until,input.session_id])?;let mut metrics=Metrics::default();let mut durations=Vec::new();let mut scanned=0;
  while let Some(row)=rows.next()?{scanned+=1;if scanned>1_000_000{return Err(ApiError::new("quota","Narrow the time window to fewer than one million records."));}let payload:serde_json::Value=serde_json::from_str(&row.get::<_,String>(0)?)?;
   let capture=payload["source"]=="native_capture"&&payload["type"]=="flow";let api=payload["source"]=="native_http"&&["completed","failed","timed_out","cancelled","interrupted"].contains(&payload["state"].as_str().unwrap_or(""));if !capture&&!api{continue;}
   let url=if capture{payload["url"].as_str()}else{payload["request"]["url"].as_str()};let Some(url)=url.and_then(|u|reqwest::Url::parse(u).ok())else{continue};let host=url.host_str().unwrap_or("unknown").to_string();if input.host.as_deref().is_some_and(|filter|filter!=host){continue;}
   metrics.requests+=1;*metrics.hosts.entry(host.clone()).or_default()+=1;let status=if capture{payload["status"].as_u64()}else{payload["response"]["status"].as_u64()};if status.is_none()||status.is_some_and(|s|s>=400){metrics.errors+=1;}*metrics.statuses.entry(status.map(|s|s.to_string()).unwrap_or_else(||"transport error".into())).or_default()+=1;
   let protocol=if capture{payload["protocol"].as_str()}else{payload["response"]["protocol"].as_str()};*metrics.protocols.entry(protocol.unwrap_or("unavailable").to_string()).or_default()+=1;
   let method=if capture{payload["method"].as_str()}else{payload["request"]["method"].as_str()}.unwrap_or("?");*metrics.endpoints.entry(format!("{method} {host}{}",url.path())).or_default()+=1;
   let duration=if capture{payload["durationMs"].as_f64()}else{payload["response"]["durationMs"].as_f64()};if let Some(ms)=duration.filter(|d|d.is_finite()&&*d>=0.0){durations.push(ms);}
   metrics.payload_bytes+=if capture{payload["responseBody"]["size"].as_u64()}else{payload["response"]["body"]["size"].as_u64()}.unwrap_or(0);
  }
  if !durations.is_empty(){durations.sort_by(f64::total_cmp);metrics.measured_durations=durations.len() as u64;metrics.average_ms=Some(durations.iter().sum::<f64>()/durations.len() as f64);metrics.p95_ms=Some(durations[((durations.len() as f64*0.95).ceil() as usize).saturating_sub(1)]);}
  Ok(metrics)
 }
}
