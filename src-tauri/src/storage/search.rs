use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FlowSearchInput {
    pub workspace_id: String,
    pub query: String,
    pub session_id: Option<String>,
    pub limit: u32,
}

fn text_field(payload: &Value, keys: &[&str]) -> String {
    for key in keys {
        let mut current = payload;
        let mut ok = true;
        for part in key.split('.') {
            match current.get(part) {
                Some(next) => current = next,
                None => {
                    ok = false;
                    break;
                }
            }
        }
        if ok {
            if let Some(number) = current.as_u64() {
                return number.to_string();
            }
            if let Some(text) = current.as_str() {
                return text.chars().take(2048).collect();
            }
        }
    }
    String::new()
}

fn searchable_content(payload: &Value) -> (String, String, String, String, String) {
    let session = text_field(payload, &["sessionId"]);
    let method = text_field(payload, &["method", "request.method"]);
    let url = text_field(payload, &["url", "request.url"]);
    let status = text_field(payload, &["status", "response.status"]);
    let mut content = String::with_capacity(method.len() + url.len() + status.len() + 2);
    content.push_str(&method);
    content.push(' ');
    content.push_str(&url);
    content.push(' ');
    content.push_str(&status);
    (session, method, url, status, content)
}

pub(crate) fn upsert_flow_search(
    tx: &rusqlite::Transaction<'_>,
    workspace: &str,
    flow_id: &str,
    payload: &Value,
) -> ApiResult<()> {
    let (session, method, url, status, content) = searchable_content(payload);
    tx.execute(
        "INSERT INTO flow_search(workspace_id,flow_id,session_id,method,url,status,content) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(workspace_id,flow_id) DO UPDATE SET session_id=excluded.session_id,method=excluded.method,url=excluded.url,status=excluded.status,content=excluded.content",
        params![workspace, flow_id, session, method, url, status, content],
    )?;
    Ok(())
}

pub(crate) fn delete_flow_search(
    tx: &rusqlite::Transaction<'_>,
    workspace: &str,
    flow_id: &str,
) -> ApiResult<()> {
    tx.execute(
        "DELETE FROM flow_search WHERE workspace_id=?1 AND flow_id=?2",
        params![workspace, flow_id],
    )?;
    Ok(())
}

pub(crate) fn rebuild_workspace_search(
    tx: &rusqlite::Transaction<'_>,
    workspace: &str,
) -> ApiResult<()> {
    tx.execute("DELETE FROM flow_search WHERE workspace_id=?1", [workspace])?;
    let mut statement = tx.prepare(
        "SELECT id,payload FROM entities WHERE workspace_id=?1 AND kind='flow' LIMIT 1000001",
    )?;
    let rows = statement.query_map([workspace], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (id, text) = row?;
        let payload: Value = serde_json::from_str(&text)?;
        upsert_flow_search(tx, workspace, &id, &payload)?;
    }
    Ok(())
}

fn fts_match_expression(query: &str) -> Option<String> {
    let mut tokens = Vec::new();
    for raw in query.split_whitespace().take(10) {
        let cleaned: String = raw
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '/' || *c == ':' || *c == '-')
            .take(64)
            .collect();
        if cleaned.is_empty() {
            continue;
        }
        tokens.push(format!("\"{cleaned}\"*"));
    }
    if tokens.is_empty() {
        return None;
    }
    Some(tokens.join(" AND "))
}

fn escape_like(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars().take(256) {
        if matches!(c, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

impl Database {
    pub fn flow_search(&self, input: FlowSearchInput) -> ApiResult<Vec<Entity>> {
        let query = input.query.trim();
        if query.is_empty() || query.len() > 256 {
            return Err(ApiError::new(
                "validation",
                "Search text must contain 1-256 characters.",
            ));
        }
        if let Some(session) = &input.session_id {
            valid_id(session)?;
        }
        let limit = input.limit.clamp(1, 200);
        let connection = self.lock()?;
        Self::require_workspace(&connection, &input.workspace_id)?;
        if let Some(match_query) = fts_match_expression(query) {
            if let Ok(mut statement) = connection.prepare(
                "SELECT e.workspace_id,e.id,e.kind,e.name,e.schema_version,e.revision,e.payload,e.updated_at FROM flow_search s JOIN flow_search_fts f ON f.rowid=s.rowid JOIN entities e ON e.workspace_id=s.workspace_id AND e.id=s.flow_id WHERE s.workspace_id=?1 AND (?2 IS NULL OR s.session_id=?2) AND flow_search_fts MATCH ?3 ORDER BY e.updated_at DESC,e.id LIMIT ?4",
            ) {
                let attempt = statement.query_map(
                    params![
                        input.workspace_id,
                        input.session_id,
                        match_query,
                        limit as i64
                    ],
                    Self::parse_entity,
                );
                match attempt.and_then(|rows| rows.collect::<Result<Vec<_>, _>>()) {
                    Ok(hits) => return Ok(hits),
                    Err(_) => { /* fall through to LIKE scan */ }
                }
            }
        }
        let like = format!("%{}%", escape_like(query));
        let mut statement = connection.prepare(
            "SELECT e.workspace_id,e.id,e.kind,e.name,e.schema_version,e.revision,e.payload,e.updated_at FROM flow_search s JOIN entities e ON e.workspace_id=s.workspace_id AND e.id=s.flow_id WHERE s.workspace_id=?1 AND (?2 IS NULL OR s.session_id=?2) AND s.content LIKE ?3 ESCAPE '\\' ORDER BY e.updated_at DESC,e.id LIMIT ?4",
        )?;
        let rows = statement.query_map(
            params![input.workspace_id, input.session_id, like, limit as i64],
            Self::parse_entity,
        )?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}

#[cfg(test)]
mod search_tests {
    use super::*;
    fn save_flow(db: &Database, workspace: &str, method: &str, url: &str, status: u64) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        db.save(SaveEntity {
            workspace_id: workspace.into(),
            id: id.clone(),
            kind: "flow".into(),
            name: "Search fixture".into(),
            expected_revision: 0,
            payload: serde_json::json!({"source":"native_capture","type":"flow","sessionId":uuid::Uuid::new_v4().to_string(),"method":method,"url":url,"status":status}),
        })
        .unwrap();
        id
    }
    #[test]
    fn flow_search_uses_triggers_through_database_open() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Search").unwrap();
        let first = save_flow(
            &db,
            &workspace.id,
            "GET",
            "https://example.invalid/searchable-path",
            200,
        );
        save_flow(&db, &workspace.id, "POST", "https://other.invalid/unrelated", 500);
        let hits = db
            .flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "searchable-path".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, first);
        // Update keeps the FTS posting in sync through the trigger-maintained row.
        let mut record = db.get(&workspace.id, &first).unwrap();
        record.payload["url"] = serde_json::json!("https://example.invalid/renamed");
        db.save(SaveEntity {
            workspace_id: workspace.id.clone(),
            id: record.id.clone(),
            kind: "flow".into(),
            name: record.name.clone(),
            expected_revision: record.revision,
            payload: record.payload,
        })
        .unwrap();
        assert!(db
            .flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "searchable-path".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap()
            .is_empty());
        assert_eq!(
            db.flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "renamed".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap()
            .len(),
            1
        );
        // Delete removes the FTS posting; no orphan rows remain.
        let revision = db.get(&workspace.id, &first).unwrap().revision;
        db.remove(&workspace.id, &first, revision).unwrap();
        assert!(db
            .flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "renamed".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap()
            .is_empty());
        let connection = db.lock().unwrap();
        let indexed: i64 = connection
            .query_row("SELECT COUNT(*) FROM flow_search WHERE workspace_id=?1", [&workspace.id], |r| r.get(0))
            .unwrap();
        assert_eq!(indexed, 1);
    }
    #[test]
    fn flow_search_bulk_insert_and_query_through_database_open() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Bulk search").unwrap();
        {
            let mut connection = db.lock().unwrap();
            let tx = connection
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .unwrap();
            for index in 0..2000 {
                let id = uuid::Uuid::new_v4().to_string();
                let payload = serde_json::json!({"source":"native_capture","type":"flow","sessionId":"bulk","method":"GET","url":format!("https://example.invalid/items/{index}"),"status":200});
                let text = serde_json::to_string(&payload).unwrap();
                tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'flow','Bulk',1,1,?3,?4)", params![workspace.id, id, text, now()]).unwrap();
                upsert_flow_search(&tx, &workspace.id, &id, &payload).unwrap();
            }
            tx.commit().unwrap();
        }
        let started = std::time::Instant::now();
        let hits = db
            .flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "items/1999".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap();
        assert_eq!(hits.len(), 1);
        assert!(started.elapsed().as_millis() < 2000);
    }
    #[test]
    #[ignore]
    fn flow_search_100k_benchmark_through_database_open() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(temp.path()).unwrap();
        let workspace = db.create_workspace("Search benchmark").unwrap();
        let started = std::time::Instant::now();
        {
            let mut connection = db.lock().unwrap();
            let tx = connection
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .unwrap();
            for index in 0..100_000 {
                let id = uuid::Uuid::new_v4().to_string();
                let payload = serde_json::json!({"source":"native_capture","type":"flow","sessionId":"benchmark","method":"GET","url":format!("https://example.invalid/benchmark/{index}"),"status":200});
                let text = serde_json::to_string(&payload).unwrap();
                tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'flow','Benchmark',1,1,?3,?4)", params![workspace.id, id, text, now()]).unwrap();
                upsert_flow_search(&tx, &workspace.id, &id, &payload).unwrap();
            }
            tx.commit().unwrap();
        }
        let insert_ms = started.elapsed().as_millis();
        let query_started = std::time::Instant::now();
        let hits = db
            .flow_search(FlowSearchInput {
                workspace_id: workspace.id.clone(),
                query: "benchmark/99999".into(),
                session_id: None,
                limit: 50,
            })
            .unwrap();
        let query_ms = query_started.elapsed().as_millis();
        eprintln!("flow_search benchmark: 100000 rows inserted in {insert_ms} ms; query returned {} rows in {query_ms} ms", hits.len());
        assert_eq!(hits.len(), 1);
    }
}
