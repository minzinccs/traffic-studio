use crate::domain::*;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, path::{Path, PathBuf}, sync::{Mutex, MutexGuard}};

pub mod blobs;
pub mod import;
pub mod export;
pub mod environments;
pub mod batch;
pub mod decode;
pub mod har;
pub mod charles;
pub mod backup;
pub mod retention;
#[derive(Clone)]
pub struct Database { pub connection: std::sync::Arc<Mutex<Connection>>, pub root: PathBuf, pub uploads: std::sync::Arc<Mutex<std::collections::HashMap<String, blobs::Upload>>> }
impl Database {
    pub fn open(root: &Path) -> ApiResult<Self> {
        std::fs::create_dir_all(root.join("bodies"))?;
        std::fs::create_dir_all(root.join("staging"))?;
        let mut connection = Connection::open(root.join("workspace.sqlite3"))?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "FULL")?;
        let version: u32 = connection.pragma_query_value(None, "user_version", |row|row.get(0))?;
        // Database migration version is separate from the versioned domain DTOs.
        if version > 7 { return Err(ApiError::new("unsupported", "Database belongs to a newer app. Open it with that version.")); }
        if version == 0 { let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?; tx.execute_batch(include_str!("schema.sql"))?; tx.commit()?; }
        if version < 2 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch(include_str!("certificates.sql"))?;tx.commit()?;}
        if version == 2 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch("ALTER TABLE device_certificates ADD COLUMN installed_by_app INTEGER NOT NULL DEFAULT 0; ALTER TABLE device_certificates ADD COLUMN operation TEXT NOT NULL DEFAULT 'idle'; PRAGMA user_version=3;")?;tx.commit()?;}
        if version < 4 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch(include_str!("device_settings.sql"))?;tx.commit()?;}
        if version < 5 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch(include_str!("content_gc.sql"))?;tx.commit()?;}
        if version < 6 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch(include_str!("mcp_audit.sql"))?;tx.commit()?;}
        if version < 7 {let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;tx.execute_batch(include_str!("active_rules.sql"))?;tx.commit()?;}
        let pending={let mut statement=connection.prepare("SELECT workspace_id,id,payload FROM entities WHERE json_extract(payload,'$.source') IN ('native_http','native_capture','native_protocol') AND json_extract(payload,'$.state') IN ('running','starting','recording','connecting','connected')")?;let rows=statement.query_map([],|row|Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?)))?;rows.collect::<Result<Vec<_>,_>>()?};
        for (workspace,id,payload) in pending {let value:Value=serde_json::from_str(&payload)?;if let (Some(pid),Some(created))=(value["ownerPid"].as_u64(),value["ownerStamp"].as_str().and_then(|value|value.parse::<u64>().ok())){if pid<=u32::MAX as u64&&crate::platform::process::owner_dead(pid as u32,created){connection.execute("UPDATE entities SET revision=revision+1,payload=json_set(payload,'$.state','interrupted','$.endedAt',?3),updated_at=?3 WHERE workspace_id=?1 AND id=?2 AND json_extract(payload,'$.state') IN ('running','starting','recording','connecting','connected')",params![workspace,id,now()])?;}}}
        let database=Self { connection: std::sync::Arc::new(Mutex::new(connection)), root:root.into(), uploads:std::sync::Arc::new(Mutex::new(std::collections::HashMap::new())) };let _=database.recover_content_gc();Ok(database)
    }
    pub fn lock(&self) -> ApiResult<MutexGuard<'_, Connection>> { self.connection.lock().map_err(|_|ApiError::new("storage", "Storage worker is unavailable. Restart the app.")) }
    pub fn require_workspace(connection: &Connection, id: &str) -> ApiResult<()> {
        valid_id(id)?;
        if !connection.query_row("SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)", [id], |r|r.get::<_,bool>(0))? { return Err(ApiError::new("not_found", "Workspace no longer exists.")); }
        Ok(())
    }
    pub fn workspaces(&self) -> ApiResult<Vec<Workspace>> {
        let connection = self.lock()?;
        let mut query = connection.prepare("SELECT id,name,revision,created_at,updated_at FROM workspaces ORDER BY created_at,id")?;
        let rows = query.query_map([], |r|Ok(Workspace{id:r.get(0)?,name:r.get(1)?,revision:r.get(2)?,created_at:r.get(3)?,updated_at:r.get(4)?}))?;
        rows.collect::<Result<Vec<_>,_>>().map_err(Into::into)
    }
    pub fn create_workspace(&self, name: &str) -> ApiResult<Workspace> {
        valid_name(name)?;
        let workspace = Workspace{id:uuid::Uuid::new_v4().to_string(), name:name.trim().into(), revision:1,created_at:now(),updated_at:now()};
        self.lock()?.execute("INSERT INTO workspaces(id,name,revision,created_at,updated_at) VALUES(?1,?2,1,?3,?4)",params![workspace.id,workspace.name,workspace.created_at,workspace.updated_at])?;
        Ok(workspace)
    }
    pub fn rename_workspace(&self, id:&str, name:&str, expected_revision:i64) -> ApiResult<Workspace> {
        valid_id(id)?;valid_name(name)?;
        let connection=self.lock()?;
        let changed=connection.execute("UPDATE workspaces SET name=?1,revision=revision+1,updated_at=?2 WHERE id=?3 AND revision=?4",params![name.trim(),now(),id,expected_revision])?;
        if changed==0 { return Err(ApiError::new("conflict", "Workspace changed in another window. Reload before renaming.")); }
        Ok(connection.query_row("SELECT id,name,revision,created_at,updated_at FROM workspaces WHERE id=?1",[id],|r|Ok(Workspace{id:r.get(0)?,name:r.get(1)?,revision:r.get(2)?,created_at:r.get(3)?,updated_at:r.get(4)?}))?)
    }
    fn parse_entity(row:&rusqlite::Row<'_>) -> rusqlite::Result<Entity> {
        let payload:String=row.get(6)?;
        let value=serde_json::from_str(&payload).map_err(|e|rusqlite::Error::FromSqlConversionFailure(6,rusqlite::types::Type::Text,Box::new(e)))?;
        Ok(Entity{workspace_id:row.get(0)?,id:row.get(1)?,kind:row.get(2)?,name:row.get(3)?,schema_version:row.get(4)?,revision:row.get(5)?,payload:value,updated_at:row.get(7)?})
    }
    pub fn query(&self, workspace_id:&str, kind:&str, limit:u32, offset:u32) -> ApiResult<Vec<Entity>> {
        if !KINDS.contains(&kind) {return Err(ApiError::new("validation","Unknown entity kind."));}
        let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
        let mut query=connection.prepare("SELECT workspace_id,id,kind,name,schema_version,revision,payload,updated_at FROM entities WHERE workspace_id=?1 AND kind=?2 ORDER BY updated_at DESC,id LIMIT ?3 OFFSET ?4")?;
        let rows=query.query_map(params![workspace_id,kind,limit.clamp(1,200),offset],Self::parse_entity)?;
        rows.collect::<Result<Vec<_>,_>>().map_err(Into::into)
    }
    pub fn get(&self, workspace_id:&str, id:&str)->ApiResult<Entity> {
        valid_id(id)?;let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
        connection.query_row("SELECT workspace_id,id,kind,name,schema_version,revision,payload,updated_at FROM entities WHERE workspace_id=?1 AND id=?2",params![workspace_id,id],Self::parse_entity).optional()?.ok_or_else(||ApiError::new("not_found","Document no longer exists."))
    }
    pub fn save(&self, mut input:SaveEntity)->ApiResult<Entity> {
        valid_id(&input.id)?;valid_name(&input.name)?;
        if !KINDS.contains(&input.kind.as_str()) || !input.payload.is_object() || input.expected_revision<0 {return Err(ApiError::new("validation","Invalid entity kind, payload or revision."));}
        sanitize(&mut input.payload);let payload=serde_json::to_string(&input.payload)?;
        if payload.len()>1024*1024 {return Err(ApiError::new("validation","Document exceeds 1 MB. Use the streaming body store for large content."));}
        let mut connection=self.lock()?;Self::require_workspace(&connection,&input.workspace_id)?;
        let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let previous:Option<(i64,String)>=tx.query_row("SELECT revision,kind FROM entities WHERE workspace_id=?1 AND id=?2",params![input.workspace_id,input.id],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        if previous.as_ref().map(|p|p.0).unwrap_or(0)!=input.expected_revision || previous.as_ref().is_some_and(|p|p.1!=input.kind) {return Err(ApiError::new("conflict","Document changed in another window. Reload or save a copy."));}
        let revision=input.expected_revision+1;let updated_at=now();
        tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(workspace_id,id) DO UPDATE SET name=excluded.name,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at",params![input.workspace_id,input.id,input.kind,input.name.trim(),SCHEMA_VERSION,revision,payload,updated_at])?;
        tx.commit()?;
        Ok(Entity{workspace_id:input.workspace_id,id:input.id,kind:input.kind,name:input.name.trim().into(),schema_version:SCHEMA_VERSION,revision,payload:input.payload,updated_at})
    }
    pub fn remove(&self, workspace_id:&str,id:&str,revision:i64)->ApiResult<()> {
        valid_id(id)?;let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
        if connection.execute("DELETE FROM entities WHERE workspace_id=?1 AND id=?2 AND revision=?3",params![workspace_id,id,revision])?==0 {return Err(ApiError::new("conflict","Document was changed or deleted. Reload before deleting."));} Ok(())
    }
    pub fn import_snapshot(&self, input:ImportSnapshot)->ApiResult<ImportResult> {
        valid_name(&input.name)?;
        if input.source_id.is_empty() || input.source_id.len()>160 || input.entries.len()>1000 {return Err(ApiError::new("validation","Invalid migration source or too many entries."));}
        let mut entries=BTreeMap::new();
        for (key,text) in input.entries {
            if !key.starts_with("traffic-studio-") || key.len()>180 || text.len()>1024*1024 {return Err(ApiError::new("validation","Unsupported or oversized browser entry."));}
            // Parse before transaction; entries are archived, not executed as app configuration.
            let mut value:Value=serde_json::from_str(&text).unwrap_or(Value::String(text));sanitize(&mut value);entries.insert(key,value);
        }
        let payload=serde_json::to_string(&entries)?;
        if payload.len()>20*1024*1024 {return Err(ApiError::new("validation","Migration exceeds 20 MB."));}
        let digest=format!("{:x}",Sha256::digest(payload.as_bytes()));
        let mut connection=self.lock()?;let tx=connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing:Option<(String,String)>=tx.query_row("SELECT workspace_id,digest FROM migrations WHERE source_id=?1 ORDER BY imported_at DESC LIMIT 1",[&input.source_id],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        if let Some((id,hash))=existing {if hash==digest {return Ok(ImportResult{workspace_id:id,entries:entries.len(),already_imported:true});}}
        let id=uuid::Uuid::new_v4().to_string();let entity_id=uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL,input.source_id.as_bytes()).to_string();let timestamp=now();
        tx.execute("INSERT INTO workspaces(id,name,revision,created_at,updated_at) VALUES(?1,?2,1,?3,?3)",params![id,input.name.trim(),timestamp])?;
        tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'legacy_snapshot','Browser migration archive',1,1,?3,?4)",params![id,entity_id,payload,timestamp])?;
        tx.execute("INSERT INTO migrations(workspace_id,source_id,digest,imported_at) VALUES(?1,?2,?3,?4)",params![id,input.source_id,digest,timestamp])?;tx.commit()?;
        Ok(ImportResult{workspace_id:id,entries:entries.len(),already_imported:false})
    }
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct ImportSnapshot {pub source_id:String,pub name:String,pub entries:BTreeMap<String,String>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ImportResult {pub workspace_id:String,pub entries:usize,pub already_imported:bool}
