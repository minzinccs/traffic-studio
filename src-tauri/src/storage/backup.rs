use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::io::{Read, Write};
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Secret {
    id: String,
    protected: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FileEntry {
    sha256: String,
    size: u64,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    version: u32,
    workspace: Workspace,
    entities: Vec<Entity>,
    blobs: Vec<blobs::BodyRef>,
    links: Vec<(String, String, String)>,
    secrets: Vec<Secret>,
    files: Vec<FileEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    active_rules: Option<crate::rules::ActiveRules>,
}
impl Database {
    pub fn backup_to(&self, workspace: &str, output: &mut impl Write) -> ApiResult<()> {
        let _content = crate::platform::content_lock::ContentLock::enter(&self.root)?;
        let uploads = self
            .uploads
            .lock()
            .map_err(|_| ApiError::new("storage", "Uploads unavailable"))?;
        if !uploads.is_empty() {
            return Err(ApiError::new(
                "busy",
                "Finish or cancel body uploads before backup.",
            ));
        }
        let mut guard = self.lock()?;
        let connection = guard.transaction_with_behavior(TransactionBehavior::Immediate)?;
        Self::require_workspace(&connection, workspace)?;
        let active:bool=connection.query_row("SELECT EXISTS(SELECT 1 FROM entities WHERE workspace_id=?1 AND json_extract(payload,'$.state') IN ('running','starting','recording','connecting','connected'))",[workspace],|r|r.get(0))?;
        if active {
            return Err(ApiError::new(
                "busy",
                "Stop capture/streams and finish HTTP runs before backup.",
            ));
        }
        let metadata = connection.query_row(
            "SELECT id,name,revision,created_at,updated_at FROM workspaces WHERE id=?1",
            [workspace],
            |r| {
                Ok(Workspace {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    revision: r.get(2)?,
                    created_at: r.get(3)?,
                    updated_at: r.get(4)?,
                })
            },
        )?;
        let mut query=connection.prepare("SELECT workspace_id,id,kind,name,schema_version,revision,payload,updated_at FROM entities WHERE workspace_id=?1 ORDER BY id LIMIT 20001")?;
        let entities = query
            .query_map([workspace], Self::parse_entity)?
            .collect::<Result<Vec<_>, _>>()?;
        drop(query);
        if entities.len() > 20000 {
            return Err(ApiError::new(
                "quota",
                "Backup currently supports at most 20000 documents per workspace.",
            ));
        }
        let mut query=connection.prepare("SELECT id,sha256,size,mime_type FROM blobs WHERE workspace_id=?1 ORDER BY id LIMIT 50001")?;
        let blobs = query
            .query_map([workspace], |r| {
                Ok(blobs::BodyRef {
                    workspace_id: workspace.into(),
                    id: r.get(0)?,
                    sha256: r.get(1)?,
                    size: r.get::<_, i64>(2)? as u64,
                    mime_type: r.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(query);
        if blobs.len() > 50000 {
            return Err(ApiError::new(
                "quota",
                "Too many body references in backup.",
            ));
        }
        let mut query=connection.prepare("SELECT from_id,to_id,relation FROM entity_links WHERE workspace_id=?1 ORDER BY from_id,to_id,relation")?;
        let links = query
            .query_map([workspace], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        drop(query);
        let mut query = connection
            .prepare("SELECT id,protected FROM secrets WHERE workspace_id=?1 ORDER BY id")?;
        let secrets = query
            .query_map([workspace], |r| {
                Ok(Secret {
                    id: r.get(0)?,
                    protected: STANDARD.encode(r.get::<_, Vec<u8>>(1)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(query);
        let mut files = BTreeMap::new();
        for body in &blobs {
            check_hash(&body.sha256)?;
            if body.size > 1024 * 1024 * 1024 {
                return Err(ApiError::new("quota", "Body exceeds backup limit"));
            }
            if let Some(previous) = files.insert(body.sha256.clone(), body.size) {
                if previous != body.size {
                    return Err(ApiError::new("storage", "Conflicting body sizes"));
                }
            }
        }
        let files = files
            .into_iter()
            .map(|(sha256, size)| FileEntry { sha256, size })
            .collect::<Vec<_>>();
        if files.iter().map(|f| f.size).sum::<u64>() > 1024 * 1024 * 1024 {
            return Err(ApiError::new(
                "quota",
                "Workspace bodies exceed 1 GiB backup limit.",
            ));
        }
        let active_rules=connection.query_row("SELECT a.rule_set_id,a.revision FROM active_rules a JOIN entities e ON e.workspace_id=a.workspace_id AND e.id=a.rule_set_id AND e.kind='rule_set' AND e.revision=a.revision WHERE a.workspace_id=?1",[workspace],|r|Ok(crate::rules::ActiveRules{id:r.get(0)?,revision:r.get(1)?})).optional()?;
        let manifest = Manifest {
            version: 1,
            workspace: metadata,
            entities,
            blobs,
            links,
            secrets,
            files,
            active_rules,
        };
        let json = serde_json::to_vec(&manifest)?;
        if json.len() > 32 * 1024 * 1024 {
            return Err(ApiError::new("quota", "Backup metadata exceeds 32 MiB."));
        }
        output.write_all(b"TSBACK01")?;
        output.write_all(&(json.len() as u64).to_le_bytes())?;
        output.write_all(&Sha256::digest(&json))?;
        output.write_all(&json)?;
        for file in &manifest.files {
            copy_verified(
                std::fs::File::open(self.root.join("bodies").join(workspace).join(&file.sha256))?,
                output,
                &file.sha256,
                file.size,
            )?;
        }
        Ok(())
    }
    pub fn restore_from(
        &self,
        reader: &mut impl Read,
        name: &str,
        restore_secrets: bool,
    ) -> ApiResult<String> {
        valid_name(name)?;
        let mut magic = [0u8; 8];
        reader.read_exact(&mut magic)?;
        if &magic != b"TSBACK01" {
            return Err(ApiError::new(
                "validation",
                "Unsupported workspace backup format.",
            ));
        }
        let mut length = [0u8; 8];
        reader.read_exact(&mut length)?;
        let size = u64::from_le_bytes(length);
        if size > 32 * 1024 * 1024 {
            return Err(ApiError::new("quota", "Backup metadata exceeds 32 MiB."));
        }
        let mut expected = [0u8; 32];
        reader.read_exact(&mut expected)?;
        let mut json = vec![0u8; size as usize];
        reader.read_exact(&mut json)?;
        if Sha256::digest(&json).as_slice() != expected {
            return Err(ApiError::new(
                "validation",
                "Backup metadata checksum mismatch.",
            ));
        }
        let mut manifest: Manifest = serde_json::from_slice(&json)?;
        if manifest.version != 1
            || manifest.entities.len() > 20000
            || manifest.blobs.len() > 50000
            || manifest.files.len() > 50000
            || manifest.links.len() > 200000
            || manifest.secrets.len() > 10000
        {
            return Err(ApiError::new(
                "validation",
                "Backup version or record limits invalid.",
            ));
        }
        valid_id(&manifest.workspace.id)?;
        let source = manifest.workspace.id.clone();
        let workspace = uuid::Uuid::new_v4().to_string();
        let mut entity_ids = std::collections::HashSet::new();
        let mut file_map = BTreeMap::new();
        let mut total = 0u64;
        for file in &manifest.files {
            check_hash(&file.sha256)?;
            total = total
                .checked_add(file.size)
                .ok_or_else(|| ApiError::new("quota", "Backup size overflow"))?;
            if file.size > 1024 * 1024 * 1024
                || total > 1024 * 1024 * 1024
                || file_map.insert(file.sha256.clone(), file.size).is_some()
            {
                return Err(ApiError::new(
                    "quota",
                    "Invalid duplicate file or backup exceeds 1 GiB",
                ));
            }
        }
        if let Some(active) = &manifest.active_rules {
            valid_id(&active.id)?;
            if !manifest.entities.iter().any(|entity| {
                entity.id == active.id
                    && entity.kind == "rule_set"
                    && entity.revision == active.revision
            }) {
                return Err(ApiError::new(
                    "validation",
                    "Backup contains a stale or invalid applied rule set.",
                ));
            }
        }
        for entity in &mut manifest.entities {
            valid_id(&entity.id)?;
            valid_name(&entity.name)?;
            if entity.workspace_id != source
                || entity.schema_version != 1
                || !KINDS.contains(&entity.kind.as_str())
                || !entity.payload.is_object()
                || !entity_ids.insert(entity.id.clone())
                || serde_json::to_vec(&entity.payload)?.len() > 1024 * 1024
            {
                return Err(ApiError::new("validation", "Invalid backup document."));
            }
            remap_workspace(&mut entity.payload, &source, &workspace, restore_secrets);
            if entity.kind == "session" {
                entity.payload["state"] = serde_json::json!("restored");
            }
            entity.workspace_id = workspace.clone();
        }
        let mut body_ids = std::collections::HashSet::new();
        for body in &manifest.blobs {
            valid_id(&body.id)?;
            if body.workspace_id != source
                || !body_ids.insert(&body.id)
                || file_map.get(&body.sha256) != Some(&body.size)
                || body.mime_type.len() > 160
            {
                return Err(ApiError::new("validation", "Invalid backup body metadata."));
            }
        }
        for (from, to, relation) in &manifest.links {
            if !entity_ids.contains(from) || !entity_ids.contains(to) || relation.len() > 80 {
                return Err(ApiError::new("validation", "Backup has an orphan link."));
            }
        }
        let mut secrets = Vec::new();
        let mut secret_ids = std::collections::HashSet::new();
        for secret in manifest.secrets {
            valid_id(&secret.id)?;
            if !secret_ids.insert(secret.id.clone()) || secret.protected.len() > 180000 {
                return Err(ApiError::new("validation", "Invalid backup vault record."));
            }
            if restore_secrets {
                let protected = STANDARD
                    .decode(secret.protected)
                    .map_err(|_| ApiError::new("validation", "Malformed protected secret."))?;
                let mut plaintext = crate::platform::secrets::unprotect_bytes(&protected, &source)?;
                let rebound = crate::platform::secrets::protect_bytes(&plaintext, &workspace);
                plaintext.fill(0);
                secrets.push((secret.id, rebound?));
            }
        }
        let temporary = tempfile::tempdir_in(self.root.join("staging"))?;
        for file in &manifest.files {
            let mut output = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(temporary.path().join(&file.sha256))?;
            copy_verified(reader.take(file.size), &mut output, &file.sha256, file.size)?;
            output.sync_all()?;
        }
        let mut extra = [0u8; 1];
        if reader.read(&mut extra)? != 0 {
            return Err(ApiError::new(
                "validation",
                "Backup contains trailing data.",
            ));
        }
        let _content = crate::platform::content_lock::ContentLock::enter(&self.root)?;
        let mut connection = self.lock()?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let destination = self.root.join("bodies").join(&workspace);
        std::fs::create_dir_all(&destination)?;
        for file in &manifest.files {
            std::fs::rename(
                temporary.path().join(&file.sha256),
                destination.join(&file.sha256),
            )?;
        }
        tx.execute(
            "INSERT INTO workspaces(id,name,revision,created_at,updated_at) VALUES(?1,?2,1,?3,?3)",
            params![workspace, name, now()],
        )?;
        for entity in manifest.entities {
            tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,?3,?4,1,1,?5,?6)",params![workspace,entity.id,entity.kind,entity.name,serde_json::to_string(&entity.payload)?,now()])?;
        }
        for body in manifest.blobs {
            tx.execute("INSERT INTO blobs(workspace_id,id,sha256,size,mime_type,created_at) VALUES(?1,?2,?3,?4,?5,?6)",params![workspace,body.id,body.sha256,body.size as i64,body.mime_type,now()])?;
        }
        for (from, to, relation) in manifest.links {
            tx.execute(
                "INSERT INTO entity_links(workspace_id,from_id,to_id,relation) VALUES(?1,?2,?3,?4)",
                params![workspace, from, to, relation],
            )?;
        }
        for (id, protected) in secrets {
            tx.execute(
                "INSERT INTO secrets(workspace_id,id,protected,updated_at) VALUES(?1,?2,?3,?4)",
                params![workspace, id, protected, now()],
            )?;
        }
        if let Some(active) = manifest.active_rules {
            tx.execute(
                "INSERT INTO active_rules(workspace_id,rule_set_id,revision) VALUES(?1,?2,1)",
                params![workspace, active.id],
            )?;
        }
        tx.commit()?;
        Ok(workspace)
    }
}
fn check_hash(hash: &str) -> ApiResult<()> {
    if hash.len() != 64 || !hash.bytes().all(|v| v.is_ascii_hexdigit()) {
        Err(ApiError::new("validation", "Invalid body hash."))
    } else {
        Ok(())
    }
}
fn copy_verified(
    mut input: impl Read,
    output: &mut impl Write,
    hash: &str,
    size: u64,
) -> ApiResult<()> {
    let mut digest = Sha256::new();
    let mut count = 0u64;
    let mut buffer = [0u8; 65536];
    loop {
        let n = input.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        count += n as u64;
        if count > size {
            return Err(ApiError::new("validation", "Body size mismatch."));
        }
        digest.update(&buffer[..n]);
        output.write_all(&buffer[..n])?;
    }
    if count != size || format!("{:x}", digest.finalize()) != hash {
        return Err(ApiError::new("validation", "Body checksum mismatch."));
    }
    Ok(())
}
fn remap_workspace(value: &mut Value, source: &str, target: &str, secrets: bool) {
    match value {
        Value::Object(map) => {
            if map.get("workspaceId").and_then(Value::as_str) == Some(source) {
                map.insert("workspaceId".into(), serde_json::json!(target));
            }
            if !secrets && map.get("secret").and_then(Value::as_bool) == Some(true) {
                map.insert("secretId".into(), Value::Null);
                map.insert("value".into(), serde_json::json!(""));
            }
            for child in map.values_mut() {
                remap_workspace(child, source, target, secrets);
            }
        }
        Value::Array(rows) => {
            for row in rows {
                remap_workspace(row, source, target, secrets);
            }
        }
        _ => {}
    }
}
#[cfg(test)]
mod privacy_tests {
    use super::*;
    #[test]
    fn applied_rule_binding_survives_workspace_backup() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Rules fixture").unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let saved = db
            .save(SaveEntity {
                workspace_id: workspace.id.clone(),
                id: id.clone(),
                kind: "rule_set".into(),
                name: "Active rules".into(),
                expected_revision: 0,
                payload: serde_json::json!({"rules":[]}),
            })
            .unwrap();
        db.set_active_rules(&workspace.id, &id, saved.revision)
            .unwrap();
        let mut bytes = Vec::new();
        db.backup_to(&workspace.id, &mut bytes).unwrap();
        let restored = db
            .restore_from(&mut std::io::Cursor::new(bytes), "Recovered rules", false)
            .unwrap();
        let active = db.active_rules(&restored).unwrap().unwrap();
        assert_eq!(active.id, id);
        assert_eq!(active.revision, db.get(&restored, &id).unwrap().revision);
        db.save(SaveEntity {
            workspace_id: workspace.id.clone(),
            id: id.clone(),
            kind: "rule_set".into(),
            name: "Changed draft".into(),
            expected_revision: saved.revision,
            payload: serde_json::json!({"rules":[]}),
        })
        .unwrap();
        let mut stale_bytes = Vec::new();
        db.backup_to(&workspace.id, &mut stale_bytes).unwrap();
        let stale_restored = db
            .restore_from(
                &mut std::io::Cursor::new(stale_bytes),
                "Recovered stale draft",
                false,
            )
            .unwrap();
        assert!(db.active_rules(&stale_restored).unwrap().is_none());
    }
    #[test]
    fn workspace_backup_preserves_original_flow_headers() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Private fixture").unwrap();
        let har = serde_json::json!({"log":{"version":"1.2","entries":[{"request":{"url":"http://example.invalid/","method":"GET","headers":[{"name":"Authorization","value":"Bearer backup"}]},"response":{"status":200,"content":{}},"time":1}]}});
        let session = db
            .import_har_bytes(
                &workspace.id,
                &serde_json::to_vec(&har).unwrap(),
                "Original",
            )
            .unwrap();
        let mut bytes = Vec::new();
        db.backup_to(&workspace.id, &mut bytes).unwrap();
        let restored = db
            .restore_from(&mut std::io::Cursor::new(bytes), "Recovered", false)
            .unwrap();
        let result = db
            .export_har_value(&restored, &session, false, true)
            .unwrap();
        assert_eq!(
            result["log"]["entries"][0]["request"]["headers"][0]["value"],
            "Bearer backup"
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_restore_blobs_vault_and_corruption() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let w = db.create_workspace("Original").unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        db.secret_put(&w.id, &id, "vault fixture".into()).unwrap();
        let body = db.body_begin(&w.id, 3, "text/plain").unwrap();
        db.body_append(&w.id, &body, 0, "YWJj").unwrap();
        db.body_finish(&w.id, &body).unwrap();
        let entity = uuid::Uuid::new_v4().to_string();
        db.save(SaveEntity {
            workspace_id: w.id.clone(),
            id: entity.clone(),
            kind: "request".into(),
            name: "Saved request".into(),
            expected_revision: 0,
            payload: serde_json::json!({"body":{"workspaceId":w.id,"id":body}}),
        })
        .unwrap();
        let mut bytes = Vec::new();
        db.backup_to(&w.id, &mut bytes).unwrap();
        let restored = db
            .restore_from(&mut std::io::Cursor::new(&bytes), "Restored", true)
            .unwrap();
        assert_eq!(db.secret_get(&restored, &id).unwrap(), "vault fixture");
        assert_eq!(
            db.get(&restored, &entity).unwrap().payload["body"]["workspaceId"],
            restored
        );
        assert_eq!(db.original_body(&restored, &body, 10).unwrap(), b"abc");
        let count = db.workspaces().unwrap().len();
        *bytes.last_mut().unwrap() ^= 1;
        assert!(db
            .restore_from(&mut std::io::Cursor::new(bytes), "Corrupt", true)
            .is_err());
        assert_eq!(db.workspaces().unwrap().len(), count);
    }
}
