use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

pub const SCHEMA_VERSION: u32 = 1;
pub type ApiResult<T> = Result<T, ApiError>;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError { pub code: String, pub message: String, pub retryable: bool }
impl ApiError {
    pub fn new(code: &str, message: &str) -> Self { Self { code: code.into(), message: message.into(), retryable: false } }
}
impl From<rusqlite::Error> for ApiError {
    fn from(_: rusqlite::Error) -> Self { Self::new("storage", "Database operation failed. Keep the editor open and retry or export a backup.") }
}
impl From<std::io::Error> for ApiError {
    fn from(_: std::io::Error) -> Self { Self::new("storage", "Local file operation failed. Check free space and file permissions.") }
}
impl From<serde_json::Error> for ApiError {
    fn from(_: serde_json::Error) -> Self { Self::new("validation", "Invalid JSON document.") }
}
pub fn now() -> i64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64 }
pub fn valid_id(id: &str) -> ApiResult<()> { uuid::Uuid::parse_str(id).map(|_|()).map_err(|_| ApiError::new("validation", "Expected a stable UUID.")) }
pub fn valid_name(name: &str) -> ApiResult<()> { if name.trim().is_empty() || name.chars().count() > 80 { Err(ApiError::new("validation", "Name must contain 1–80 characters.")) } else { Ok(()) } }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace { pub id: String, pub name: String, pub revision: i64, pub created_at: i64, pub updated_at: i64 }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entity { pub workspace_id: String, pub id: String, pub kind: String, pub name: String, pub schema_version: u32, pub revision: i64, pub payload: Value, pub updated_at: i64 }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveEntity { pub workspace_id: String, pub id: String, pub kind: String, pub name: String, pub expected_revision: i64, pub payload: Value }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionEvent { pub workspace_id: String, pub entity_id: String, pub kind: String, pub revision: i64, pub sequence: u64, pub schema_version: u32 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo { pub mode: String, pub schema_version: u32, pub storage: bool, pub secrets: bool, pub engine: bool, pub http: bool, pub capture: bool, pub message: String }
pub const KINDS: &[&str] = &["request", "api_run", "collection", "environment", "session", "flow", "rule_set", "tracker_item", "saved_view", "dashboard", "layout", "preferences", "legacy_snapshot"];
pub fn sanitize(value: &mut Value) {
    match value {
        Value::Object(object) => {
            if object.get("secret").and_then(Value::as_bool) == Some(true) {
                for key in ["value", "currentValue", "initialValue"] { if object.contains_key(key) { object.insert(key.into(), Value::String(String::new())); } }
            }
            for key in ["auth", "password", "authPassword", "apiKeyValue", "cookies", "accessToken", "refreshToken"] { object.remove(key); }
            for value in object.values_mut() { sanitize(value); }
        }
        Value::Array(values) => {
            values.retain(|v| {
                let key = v.get("key").or_else(||v.get("name")).and_then(Value::as_str).unwrap_or("").trim().to_ascii_lowercase();
                !["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key", "api-key"].contains(&key.as_str())
            });
            for value in values { sanitize(value); }
        }
        _ => {}
    }
}
