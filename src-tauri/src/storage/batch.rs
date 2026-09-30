use super::*;
use std::collections::HashSet;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BatchInput {
    pub workspace_id: String,
    pub documents: Vec<SaveEntity>,
}
impl Database {
    pub fn save_batch(&self, mut input: BatchInput) -> ApiResult<Vec<Entity>> {
        if input.documents.is_empty() || input.documents.len() > 200 {
            return Err(ApiError::new(
                "validation",
                "Batch must contain 1–200 documents.",
            ));
        }
        let mut ids = HashSet::new();
        let mut bytes = 0;
        for item in &mut input.documents {
            valid_id(&item.id)?;
            valid_name(&item.name)?;
            if item.workspace_id != input.workspace_id
                || !ids.insert(item.id.clone())
                || !KINDS.contains(&item.kind.as_str())
                || !item.payload.is_object()
                || item.expected_revision < 0
            {
                return Err(ApiError::new(
                    "validation",
                    "Invalid batch workspace, kind, ID or revision.",
                ));
            }
            sanitize(&mut item.payload);
            let size = serde_json::to_vec(&item.payload)?.len();
            bytes += size;
            if size > 1024 * 1024 || bytes > 10 * 1024 * 1024 {
                return Err(ApiError::new(
                    "validation",
                    "Batch exceeds document limits.",
                ));
            }
        }
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, &input.workspace_id)?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut output = Vec::new();
        for item in input.documents {
            let prior: Option<(i64, String)> = tx
                .query_row(
                    "SELECT revision,kind FROM entities WHERE workspace_id=?1 AND id=?2",
                    params![input.workspace_id, item.id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()?;
            if prior.as_ref().map(|v| v.0).unwrap_or(0) != item.expected_revision
                || prior.as_ref().is_some_and(|v| v.1 != item.kind)
            {
                return Err(ApiError::new(
                    "conflict",
                    "Batch changed in another window. No documents were saved.",
                ));
            }
            let revision = item.expected_revision + 1;
            let timestamp = now();
            let payload = serde_json::to_string(&item.payload)?;
            tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,?3,?4,1,?5,?6,?7) ON CONFLICT(workspace_id,id) DO UPDATE SET name=excluded.name,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at",params![input.workspace_id,item.id,item.kind,item.name,revision,payload,timestamp])?;
            if item.kind == "tracker_item" {
                tx.execute("DELETE FROM entity_links WHERE workspace_id=?1 AND from_id=?2 AND relation='tracker_flow'",params![input.workspace_id,item.id])?;
                if let Some(links) = item.payload.get("flowIds") {
                    let links = links.as_array().ok_or_else(|| {
                        ApiError::new("validation", "Tracker links must be an array.")
                    })?;
                    if links.len() > 1000 {
                        return Err(ApiError::new("validation", "Too many tracker links."));
                    }
                    let mut seen = HashSet::new();
                    for linked in links {
                        let id = linked.as_str().ok_or_else(|| {
                            ApiError::new("validation", "Invalid tracker flow ID.")
                        })?;
                        valid_id(id)?;
                        if !seen.insert(id) {
                            continue;
                        }
                        let kind: Option<String> = tx
                            .query_row(
                                "SELECT kind FROM entities WHERE workspace_id=?1 AND id=?2",
                                params![input.workspace_id, id],
                                |r| r.get(0),
                            )
                            .optional()?;
                        if !kind.is_some_and(|v| v == "flow" || v == "api_run") {
                            return Err(ApiError::new(
                                "validation",
                                "Linked flow/run does not exist in this workspace.",
                            ));
                        }
                        tx.execute("INSERT INTO entity_links(workspace_id,from_id,to_id,relation) VALUES(?1,?2,?3,'tracker_flow')",params![input.workspace_id,item.id,id])?;
                    }
                }
            }
            output.push(Entity {
                workspace_id: input.workspace_id.clone(),
                id: item.id,
                kind: item.kind,
                name: item.name,
                schema_version: 1,
                revision,
                payload: item.payload,
                updated_at: timestamp,
            });
        }
        tx.commit()?;
        Ok(output)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn conflict_rolls_back_every_document() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Batch").unwrap();
        let a = uuid::Uuid::new_v4().to_string();
        let b = uuid::Uuid::new_v4().to_string();
        let item = |id: String, revision| SaveEntity {
            workspace_id: workspace.id.clone(),
            id,
            kind: "tracker_item".into(),
            name: "Issue".into(),
            expected_revision: revision,
            payload: serde_json::json!({"status":"New","flowIds":[]}),
        };
        db.save_batch(BatchInput {
            workspace_id: workspace.id.clone(),
            documents: vec![item(a.clone(), 0), item(b.clone(), 0)],
        })
        .unwrap();
        assert!(db
            .save_batch(BatchInput {
                workspace_id: workspace.id.clone(),
                documents: vec![item(a.clone(), 1), item(b, 0)]
            })
            .is_err());
        assert_eq!(db.get(&workspace.id, &a).unwrap().revision, 1);
    }
}
