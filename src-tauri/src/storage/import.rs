use super::*;
use std::collections::HashSet;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportDocuments {
    pub workspace_id: String,
    pub documents: Vec<SaveEntity>,
}
impl Database {
    pub fn import_documents(&self, mut input: ImportDocuments) -> ApiResult<usize> {
        if input.documents.is_empty() || input.documents.len() > 2500 {
            return Err(ApiError::new(
                "validation",
                "Import needs 1–2500 documents.",
            ));
        }
        let mut ids = HashSet::new();
        let mut size = 0usize;
        for document in &mut input.documents {
            valid_id(&document.id)?;
            valid_name(&document.name)?;
            if document.workspace_id != input.workspace_id
                || document.expected_revision != 0
                || !["collection", "request", "environment"].contains(&document.kind.as_str())
                || !document.payload.is_object()
                || !ids.insert(document.id.clone())
            {
                return Err(ApiError::new("validation","Import requires new unique workspace-owned request/collection/environment documents."));
            }
            sanitize(&mut document.payload);
            let bytes = serde_json::to_vec(&document.payload)?.len();
            size += bytes;
            if bytes > 1024 * 1024 || size > 10 * 1024 * 1024 {
                return Err(ApiError::new(
                    "quota",
                    "Import limit: 1 MiB per document, 10 MiB per batch.",
                ));
            }
        }
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, &input.workspace_id)?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        for document in &input.documents {
            if tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM entities WHERE workspace_id=?1 AND id=?2)",
                params![input.workspace_id, document.id],
                |row| row.get::<_, bool>(0),
            )? {
                return Err(ApiError::new(
                    "conflict",
                    "Import ID already exists. Existing documents were not overwritten.",
                ));
            }
            tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,?3,?4,1,1,?5,?6)",params![input.workspace_id,document.id,document.kind,document.name.trim(),serde_json::to_string(&document.payload)?,now()])?;
        }
        for document in &input.documents {
            for (key, relation) in [("parentId", "parent"), ("collectionId", "collection")] {
                if let Some(parent) = document.payload.get(key).and_then(Value::as_str) {
                    valid_id(parent)?;
                    if parent == document.id || !ids.contains(parent) {
                        return Err(ApiError::new(
                            "validation",
                            "Import parent must be another collection in the same batch.",
                        ));
                    }
                    let target = input
                        .documents
                        .iter()
                        .find(|value| value.id == parent)
                        .ok_or_else(|| ApiError::new("validation", "Missing parent."))?;
                    if target.kind != "collection" {
                        return Err(ApiError::new(
                            "validation",
                            "Import parent is not a collection.",
                        ));
                    }
                    tx.execute("INSERT INTO entity_links(workspace_id,from_id,to_id,relation) VALUES(?1,?2,?3,?4)",params![input.workspace_id,document.id,parent,relation])?;
                }
            }
            let mut seen = HashSet::new();
            let mut current = document;
            while let Some(parent) = current.payload.get("parentId").and_then(Value::as_str) {
                if !seen.insert(parent) || seen.len() > 24 {
                    return Err(ApiError::new(
                        "validation",
                        "Import folder cycle or excessive depth.",
                    ));
                }
                current = input
                    .documents
                    .iter()
                    .find(|value| value.id == parent)
                    .ok_or_else(|| ApiError::new("validation", "Missing folder."))?;
            }
        }
        tx.commit()?;
        Ok(input.documents.len())
    }
}
