use crate::{
    domain::*,
    storage::{
        blobs::{BodyChunk, BodyRef},
        Database, ImportResult, ImportSnapshot,
    },
};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, State};
#[tauri::command(async)]
pub fn decode_run(input: crate::decoder::DecodeInput) -> ApiResult<crate::decoder::DecodeOutput> {
    crate::decoder::run(input)
}
#[tauri::command(async)]
pub fn sha_file() -> ApiResult<Option<crate::decoder::FileHash>> {
    crate::decoder::hash_file()
}
#[tauri::command(async)]
pub fn packet_status(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.status(&db)
}
#[tauri::command(async)]
pub fn packet_interfaces(
    runtime: State<'_, crate::packets::PacketRuntime>,
) -> ApiResult<Vec<crate::packets::PacketInterface>> {
    runtime.interfaces()
}
#[tauri::command(async)]
pub fn packet_start(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
    interface: u32,
    acknowledged: bool,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.start(&db, interface, acknowledged)
}
#[tauri::command(async)]
pub fn packet_stop(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.stop(&db)
}
#[tauri::command(async)]
pub fn packet_clear(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
    acknowledged: bool,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.clear(&db, acknowledged)
}
#[tauri::command(async)]
pub fn packet_keylog_select(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.keylog_select(&db)
}
#[tauri::command(async)]
pub fn packet_keylog_clear(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
) -> ApiResult<crate::packets::PacketStatus> {
    runtime.keylog_clear(&db)
}
#[tauri::command(async)]
pub fn packet_inspect(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
    name: String,
) -> ApiResult<Vec<crate::packets::PacketRow>> {
    runtime.inspect(&db, &name)
}
#[tauri::command(async)]
pub fn packet_export(
    db: State<'_, Database>,
    runtime: State<'_, crate::packets::PacketRuntime>,
    name: String,
) -> ApiResult<bool> {
    runtime.export(&db, &name)
}
#[tauri::command]
pub fn runtime_diagnostics() -> crate::platform::diagnostics::RuntimeDiagnostics {
    crate::platform::diagnostics::snapshot()
}
#[tauri::command]
pub fn native_error_log() -> Vec<crate::platform::native_log::NativeLogEntry> {
    crate::platform::native_log::read()
}
#[tauri::command]
pub fn native_error_clear() -> ApiResult<()> {
    crate::platform::native_log::clear().map_err(ApiError::from)
}
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
#[tauri::command]
pub fn workbench_detach(app: tauri::AppHandle) -> ApiResult<()> {
    use tauri::Manager;
    if app
        .webview_windows()
        .keys()
        .filter(|name| name.starts_with("workbench-"))
        .count()
        >= 4
    {
        return Err(ApiError::new(
            "quota",
            "Four detached workspaces are already open.",
        ));
    }
    let label = format!("workbench-{}", uuid::Uuid::new_v4());
    tauri::WebviewWindowBuilder::new(
        &app,
        label.clone(),
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Traffic Studio — Mixed Workspace")
    .inner_size(1200.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .initialization_script(format!(
        "window.__TRAFFIC_STUDIO_DETACHED__=true;window.__TRAFFIC_STUDIO_WORKBENCH_ID__={};",
        serde_json::to_string(&label)?
    ))
    .build()
    .map_err(|_| ApiError::new("runtime", "Could not open detached workspace."))?;
    Ok(())
}
#[tauri::command]
pub fn workbench_close(window: tauri::WebviewWindow) -> ApiResult<()> {
    if !window.label().starts_with("workbench-") {
        return Err(ApiError::new(
            "permission",
            "This command only closes detached workspace windows.",
        ));
    }
    window
        .close()
        .map_err(|_| ApiError::new("runtime", "Could not close detached workspace."))
}
#[tauri::command(async)]
pub fn storage_retention(
    db: State<'_, Database>,
    workspace_id: String,
    days: u32,
    apply: bool,
    acknowledged: bool,
) -> ApiResult<crate::storage::retention::RetentionResult> {
    if apply && !acknowledged {
        return Err(ApiError::new(
            "permission",
            "Acknowledge deletion of unused aged body files.",
        ));
    }
    db.retain(&workspace_id, days, apply)
}
#[tauri::command(async)]
pub fn workspace_backup(
    db: State<'_, Database>,
    workspace_id: String,
    acknowledged: bool,
) -> ApiResult<bool> {
    if !acknowledged {
        return Err(ApiError::new(
            "permission",
            "Backup includes private bodies and account-protected vault entries.",
        ));
    }
    #[cfg(windows)]
    {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Traffic Studio backup", &["tsb"])
            .set_file_name("traffic-workspace.tsb")
            .save_file()
        else {
            return Ok(false);
        };
        let parent = path
            .parent()
            .ok_or_else(|| ApiError::new("validation", "Invalid backup path"))?
            .canonicalize()?;
        if parent.starts_with(db.root.canonicalize()?) {
            return Err(ApiError::new(
                "permission",
                "Save backup outside app-private data.",
            ));
        }
        let mut file = tempfile::NamedTempFile::new_in(parent)?;
        db.backup_to(&workspace_id, &mut file)?;
        file.as_file().sync_all()?;
        file.persist(path)
            .map_err(|_| ApiError::new("storage", "Backup file commit failed."))?;
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = (db, workspace_id);
        Err(ApiError::new(
            "unsupported",
            "Backup file picker is Windows-only",
        ))
    }
}
#[tauri::command(async)]
pub fn workspace_restore(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    name: String,
    restore_secrets: bool,
    acknowledged: bool,
) -> ApiResult<Option<String>> {
    if !acknowledged {
        return Err(ApiError::new(
            "permission",
            "Restore creates a new workspace; verify the source and vault option.",
        ));
    }
    #[cfg(windows)]
    {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Traffic Studio backup", &["tsb"])
            .pick_file()
        else {
            return Ok(None);
        };
        let mut file = std::fs::File::open(path)?;
        let id = db.restore_from(&mut file, &name, restore_secrets)?;
        changed(&app, &id, &id, "workspace", 1);
        Ok(Some(id))
    }
    #[cfg(not(windows))]
    {
        let _ = (app, db, name, restore_secrets);
        Err(ApiError::new(
            "unsupported",
            "Restore file picker is Windows-only",
        ))
    }
}
#[tauri::command]
pub fn mcp_status(
    runtime: State<'_, crate::integrations::mcp::McpRuntime>,
) -> ApiResult<crate::integrations::mcp::McpStatus> {
    runtime.status()
}
#[tauri::command]
pub fn lan_status(
    runtime: State<'_, crate::devices::LanReadRuntime>,
) -> ApiResult<crate::devices::LanStatus> {
    runtime.status()
}
#[tauri::command]
pub async fn lan_start(
    db: State<'_, Database>,
    runtime: State<'_, crate::devices::LanReadRuntime>,
    workspace_id: String,
    host: String,
    port: u16,
    acknowledged: bool,
) -> ApiResult<crate::devices::LanStatus> {
    runtime
        .start(&db, workspace_id, host, port, acknowledged)
        .await
}
#[tauri::command]
pub fn lan_stop(runtime: State<'_, crate::devices::LanReadRuntime>) -> ApiResult<()> {
    runtime.stop()
}
#[tauri::command(async)]
pub fn mcp_audit(
    db: State<'_, Database>,
    workspace_id: String,
    limit: u32,
) -> ApiResult<Vec<crate::integrations::mcp::AuditRecord>> {
    db.mcp_audit(&workspace_id, limit)
}
#[tauri::command]
pub async fn mcp_start(
    db: State<'_, Database>,
    runtime: State<'_, crate::integrations::mcp::McpRuntime>,
    workspace_id: String,
    port: u16,
    acknowledged: bool,
    draft_writes: bool,
    flow_reads: bool,
) -> ApiResult<crate::integrations::mcp::McpStatus> {
    runtime
        .start(
            &db,
            workspace_id,
            port,
            acknowledged,
            draft_writes,
            flow_reads,
        )
        .await
}
#[tauri::command]
pub fn mcp_stop(runtime: State<'_, crate::integrations::mcp::McpRuntime>) -> ApiResult<()> {
    runtime.stop()
}
#[tauri::command(async)]
pub fn terminal_start(
    runtime: State<'_, crate::integrations::terminal::TerminalRuntime>,
    capture: State<'_, crate::capture::CaptureRuntime>,
    command: String,
    acknowledged: bool,
) -> ApiResult<()> {
    let status = capture.status()?;
    let port = status.port.ok_or_else(|| {
        ApiError::new(
            "conflict",
            "Start native localhost capture before launching a proxy command.",
        )
    })?;
    runtime.start(&command, port, acknowledged)
}
#[tauri::command(async)]
pub fn terminal_status(
    runtime: State<'_, crate::integrations::terminal::TerminalRuntime>,
) -> ApiResult<crate::integrations::terminal::TerminalStatus> {
    runtime.status()
}
#[tauri::command(async)]
pub fn terminal_stop(
    runtime: State<'_, crate::integrations::terminal::TerminalRuntime>,
) -> ApiResult<()> {
    runtime.stop()
}
#[tauri::command(async)]
pub fn report_preview(
    db: State<'_, Database>,
    workspace_id: String,
    session_id: String,
) -> ApiResult<serde_json::Value> {
    let mut value = db.export_har_value(&workspace_id, &session_id, false, false)?;
    crate::integrations::report::redact(&mut value);
    let digest = crate::integrations::report::digest(&value)?;
    Ok(serde_json::json!({"payload":value,"digest":digest}))
}
#[tauri::command]
pub async fn report_send(
    db: State<'_, Database>,
    input: crate::integrations::report::ReportInput,
) -> ApiResult<u16> {
    crate::integrations::report::deliver(&db, input).await
}
#[tauri::command(async)]
pub fn session_import_har(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    workspace_id: String,
) -> ApiResult<Option<String>> {
    #[cfg(windows)]
    {
        use std::io::Read;
        let Some(path) = rfd::FileDialog::new()
            .add_filter("HAR", &["har", "json"])
            .pick_file()
        else {
            return Ok(None);
        };
        let mut bytes = Vec::new();
        std::fs::File::open(path)?
            .take(32 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        let session = db.import_har_bytes(&workspace_id, &bytes, "Imported HAR session")?;
        changed(&app, &workspace_id, &session, "session", 1);
        Ok(Some(session))
    }
    #[cfg(not(windows))]
    {
        let _ = (app, db, workspace_id);
        Err(ApiError::new(
            "unsupported",
            "Native file dialog adapter not configured on this platform.",
        ))
    }
}
#[tauri::command(async)]
pub fn session_import_charles_xml(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    workspace_id: String,
) -> ApiResult<Option<String>> {
    #[cfg(windows)]
    {
        use std::io::Read;
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Charles XML exchange", &["xml"])
            .pick_file()
        else {
            return Ok(None);
        };
        let mut bytes = Vec::new();
        std::fs::File::open(path)?
            .take(32 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        let session = db.import_charles_xml_bytes(&workspace_id, &bytes, "Imported Charles XML")?;
        changed(&app, &workspace_id, &session, "session", 1);
        Ok(Some(session))
    }
    #[cfg(not(windows))]
    {
        let _ = (app, db, workspace_id);
        Err(ApiError::new(
            "unsupported",
            "Native file dialog adapter not configured on this platform.",
        ))
    }
}
#[tauri::command(async)]
pub fn session_export_har(
    db: State<'_, Database>,
    workspace_id: String,
    session_id: String,
    include_bodies: bool,
    include_sensitive_headers: bool,
    acknowledged: bool,
) -> ApiResult<bool> {
    if include_sensitive_headers && !acknowledged {
        return Err(ApiError::new(
            "permission",
            "Confirm that exported HAR may contain credential headers.",
        ));
    }
    #[cfg(windows)]
    {
        use std::io::Write;
        let value = db.export_har_value(
            &workspace_id,
            &session_id,
            include_bodies,
            include_sensitive_headers,
        )?;
        let Some(path) = rfd::FileDialog::new()
            .add_filter("HAR", &["har"])
            .set_file_name("traffic-session.har")
            .save_file()
        else {
            return Ok(false);
        };
        let parent = path
            .parent()
            .ok_or_else(|| ApiError::new("validation", "Export destination missing"))?
            .canonicalize()?;
        if parent.starts_with(db.root.canonicalize()?) {
            return Err(ApiError::new(
                "permission",
                "Choose a destination outside app-private storage.",
            ));
        }
        let mut file = tempfile::NamedTempFile::new_in(parent)?;
        serde_json::to_writer(file.as_file_mut(), &value)?;
        file.flush()?;
        file.as_file().sync_all()?;
        file.persist(path)
            .map_err(|_| ApiError::new("storage", "HAR file commit failed."))?;
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = (db, workspace_id, session_id, include_bodies);
        Err(ApiError::new(
            "unsupported",
            "Native file dialog adapter not configured.",
        ))
    }
}
#[tauri::command(async)]
pub fn body_decode(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
    encoding: String,
    protobuf: bool,
) -> ApiResult<crate::storage::decode::DecodedBody> {
    db.decode_body(&workspace_id, &id, &encoding, protobuf)
}
#[tauri::command]
pub fn stream_start(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    runtime: State<'_, crate::protocols::ProtocolRuntime>,
    input: crate::protocols::StreamInput,
) -> ApiResult<()> {
    runtime.start(
        &db,
        input,
        std::sync::Arc::new(move |workspace, id, kind, revision| {
            changed(&app, workspace, id, kind, revision)
        }),
    )
}
#[tauri::command]
pub fn stream_stop(
    runtime: State<'_, crate::protocols::ProtocolRuntime>,
    workspace_id: String,
    id: String,
) -> ApiResult<()> {
    runtime.stop(&workspace_id, &id)
}
#[tauri::command]
pub fn stream_send(
    runtime: State<'_, crate::protocols::ProtocolRuntime>,
    workspace_id: String,
    id: String,
    kind: String,
    data: String,
) -> ApiResult<()> {
    runtime.send(&workspace_id, &id, &kind, &data)
}
#[tauri::command(async)]
pub fn analytics_query(
    db: State<'_, Database>,
    input: crate::analytics::AnalyticsInput,
) -> ApiResult<crate::analytics::Metrics> {
    db.analytics(input)
}
#[tauri::command(async)]
pub fn flow_search(
    db: State<'_, Database>,
    workspace_id: String,
    query: String,
    session_id: Option<String>,
    limit: u32,
) -> ApiResult<Vec<Entity>> {
    db.flow_search(crate::storage::search::FlowSearchInput {
        workspace_id,
        query,
        session_id,
        limit,
    })
}
#[tauri::command(async)]
pub fn active_rules(
    db: State<'_, Database>,
    workspace_id: String,
) -> ApiResult<Option<crate::rules::ActiveRules>> {
    db.active_rules(&workspace_id)
}
#[tauri::command(async)]
pub fn breakpoint_decide(
    db: State<'_, Database>,
    runtime: State<'_, crate::capture::CaptureRuntime>,
    workspace_id: String,
    flow_id: String,
    decision: String,
    url: Option<String>,
    body: Option<String>,
    status: Option<u16>,
) -> ApiResult<()> {
    let state = runtime.status()?;
    let row = db.get(&workspace_id, &flow_id)?;
    if state.workspace_id.as_deref() != Some(&workspace_id)
        || row.payload["sessionId"].as_str() != state.session_id.as_deref()
        || row.payload["type"] != "paused"
        || !["resume", "drop"].contains(&decision.as_str())
    {
        return Err(ApiError::new(
            "conflict",
            "Breakpoint is not paused in the active workspace/session.",
        ));
    }
    let response = row.payload["phase"] == "response";
    if decision == "drop" && (url.is_some() || body.is_some() || status.is_some())
        || response && url.is_some()
        || !response && status.is_some()
    {
        return Err(ApiError::new(
            "validation",
            "Breakpoint edits do not match the paused phase or decision.",
        ));
    }
    if let Some(value) = &url {
        let target = reqwest::Url::parse(value)
            .map_err(|_| ApiError::new("validation", "Invalid edited URL."))?;
        if !["http", "https"].contains(&target.scheme())
            || !target.username().is_empty()
            || target.password().is_some()
        {
            return Err(ApiError::new(
                "validation",
                "Use an HTTP(S) URL without credentials.",
            ));
        }
    }
    if body.as_ref().is_some_and(|b| b.len() > 65536)
        || status.is_some_and(|s| !(200..=599).contains(&s))
    {
        return Err(ApiError::new(
            "validation",
            "Edited body/status is outside allowed limits.",
        ));
    }
    let mut command =
        serde_json::json!({"command":"decision","flowId":flow_id,"decision":decision});
    if let Some(url) = url {
        command["url"] = serde_json::json!(url);
    }
    if let Some(body) = body {
        command["body"] = serde_json::json!(body);
    }
    if let Some(status) = status {
        command["status"] = serde_json::json!(status);
    }
    runtime.control(command)
}
#[tauri::command(async)]
pub fn entity_batch(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    input: crate::storage::batch::BatchInput,
) -> ApiResult<Vec<Entity>> {
    let rows = db.save_batch(input)?;
    for row in &rows {
        changed(&app, &row.workspace_id, &row.id, &row.kind, row.revision);
    }
    Ok(rows)
}
#[tauri::command(async)]
pub fn rules_apply(
    db: State<'_, Database>,
    runtime: State<'_, crate::capture::CaptureRuntime>,
    workspace_id: String,
    id: String,
    expected_revision: i64,
) -> ApiResult<()> {
    let state = runtime.status()?;
    if state.workspace_id.as_deref() != Some(&workspace_id) {
        return Err(ApiError::new(
            "conflict",
            "Capture belongs to a different workspace.",
        ));
    }
    let document = db.get(&workspace_id, &id)?;
    if document.kind != "rule_set" || document.revision != expected_revision {
        return Err(ApiError::new(
            "conflict",
            "Reload the saved rule set before applying.",
        ));
    }
    let rules: Vec<crate::rules::Rule> = serde_json::from_value(document.payload["rules"].clone())?;
    crate::rules::validate(&rules)?;
    crate::rules::reject_listener_recursion(
        &rules,
        state
            .port
            .ok_or_else(|| ApiError::new("conflict", "Capture is not recording."))?,
    )?;
    let previous = db.active_rules(&workspace_id)?;
    runtime.rules(serde_json::to_value(&rules)?, document.revision)?;
    if let Err(error) = db.set_active_rules(&workspace_id, &id, document.revision) {
        let old = previous
            .and_then(|binding| {
                db.get(&workspace_id, &binding.id)
                    .ok()
                    .map(|row| (binding.revision, row.payload["rules"].clone()))
            })
            .unwrap_or((0, serde_json::json!([])));
        if runtime.rules(old.1, old.0).is_err() {
            return Err(ApiError::new(
                "runtime",
                "Rule activation could not be saved or rolled back. Stop capture and reload rules.",
            ));
        }
        return Err(error);
    }
    Ok(())
}
#[tauri::command(async)]
pub fn windows_proxy_recovery(
    db: State<'_, Database>,
) -> ApiResult<crate::platform::proxy_control::RecoveryState> {
    db.proxy_recovery()
}
#[tauri::command(async)]
pub fn windows_proxy_apply(
    db: State<'_, Database>,
    port: u16,
    acknowledged: bool,
) -> ApiResult<crate::platform::proxy_control::RecoveryState> {
    db.proxy_apply(port, acknowledged)
}
#[tauri::command(async)]
pub fn windows_proxy_restore(
    db: State<'_, Database>,
    id: String,
    acknowledged: bool,
) -> ApiResult<crate::platform::proxy_control::RecoveryState> {
    db.proxy_restore(&id, acknowledged)
}
#[tauri::command(async)]
pub fn environment_save(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    input: crate::storage::environments::EnvironmentInput,
) -> ApiResult<Entity> {
    let entity = db.environment_save(input)?;
    changed(
        &app,
        &entity.workspace_id,
        &entity.id,
        "environment",
        entity.revision,
    );
    Ok(entity)
}
#[tauri::command(async)]
pub fn environment_load(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
) -> ApiResult<Entity> {
    db.environment_load(&workspace_id, &id)
}
#[tauri::command(async)]
pub fn http_record_scripts(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    workspace_id: String,
    run_id: String,
    summaries: Vec<crate::scripts::ScriptSummary>,
) -> ApiResult<()> {
    let revision = db.record_script_results(&workspace_id, &run_id, summaries)?;
    changed(&app, &workspace_id, &run_id, "api_run", revision);
    Ok(())
}
#[tauri::command(async)]
pub fn body_export(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
) -> ApiResult<Option<u64>> {
    db.body_export(&workspace_id, &id)
}
#[tauri::command]
pub async fn oauth_exchange(
    runtime: State<'_, crate::http::oauth::OAuthRuntime>,
    input: crate::http::oauth::OAuthInput,
) -> ApiResult<crate::http::oauth::OAuthToken> {
    runtime.exchange(input).await
}
#[tauri::command]
pub fn oauth_cancel(
    runtime: State<'_, crate::http::oauth::OAuthRuntime>,
    id: String,
) -> ApiResult<()> {
    runtime.cancel(&id)
}
#[tauri::command(async)]
pub fn entity_import(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    input: crate::storage::import::ImportDocuments,
) -> ApiResult<usize> {
    let workspace = input.workspace_id.clone();
    let count = db.import_documents(input)?;
    changed(&app, &workspace, &workspace, "import", 0);
    Ok(count)
}
#[tauri::command(async)]
pub fn script_run(
    worker: State<'_, crate::scripts::ScriptRuntime>,
    input: crate::scripts::ScriptInput,
) -> ApiResult<crate::scripts::ScriptResult> {
    worker.run(input)
}
#[tauri::command]
pub fn script_cancel(
    worker: State<'_, crate::scripts::ScriptRuntime>,
    id: String,
) -> ApiResult<()> {
    worker.cancel(&id)
}
#[tauri::command(async)]
pub fn certificate_list(
    db: State<'_, Database>,
) -> ApiResult<Vec<crate::certificates::CertificateInfo>> {
    db.certificate_list()
}
#[tauri::command(async)]
pub fn certificate_create(
    db: State<'_, Database>,
) -> ApiResult<crate::certificates::CertificateInfo> {
    db.certificate_create()
}
#[tauri::command(async)]
pub fn certificate_trust(
    db: State<'_, Database>,
    id: String,
    fingerprint: String,
    acknowledged: bool,
    install: bool,
) -> ApiResult<()> {
    db.certificate_trust(&id, &fingerprint, acknowledged, install)
}
pub(crate) fn changed(
    app: &tauri::AppHandle,
    workspace_id: &str,
    id: &str,
    kind: &str,
    revision: i64,
) {
    let _ = app.emit(
        "traffic-studio://revision",
        RevisionEvent {
            workspace_id: workspace_id.into(),
            entity_id: id.into(),
            kind: kind.into(),
            revision,
            sequence: SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1,
            schema_version: SCHEMA_VERSION,
        },
    );
}
#[tauri::command(async)]
pub fn capture_status(
    runtime: State<'_, crate::capture::CaptureRuntime>,
) -> ApiResult<crate::capture::CaptureStatus> {
    runtime.status()
}
#[tauri::command(async)]
pub fn capture_start(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    runtime: State<'_, crate::capture::CaptureRuntime>,
    input: crate::capture::CaptureInput,
) -> ApiResult<crate::capture::CaptureStatus> {
    runtime.start(
        &db,
        input,
        std::sync::Arc::new(move |workspace, id, kind, revision| {
            changed(&app, workspace, id, kind, revision)
        }),
    )
}
#[tauri::command(async)]
pub fn capture_stop(
    app: tauri::AppHandle,
    runtime: State<'_, crate::capture::CaptureRuntime>,
) -> ApiResult<()> {
    runtime.stop()?;
    changed(&app, "", "", "session", 0);
    Ok(())
}
#[tauri::command]
pub fn runtime_info() -> RuntimeInfo {
    let capture = crate::capture::available();
    RuntimeInfo{mode:"native".into(),schema_version:SCHEMA_VERSION,storage:true,secrets:cfg!(windows),engine:false,http:true,capture,message:if capture{"Native HTTP and local mitmproxy capture are available from this checkout. Listener starts only on explicit user action; installer bundling is pending."}else{"Native HTTP is available. Run scripts/setup-capture.ps1 to prepare local capture; installer bundling is pending."}.into()}
}
#[tauri::command(async)]
pub fn workspace_list(db: State<'_, Database>) -> ApiResult<Vec<Workspace>> {
    db.workspaces()
}
#[tauri::command(async)]
pub fn workspace_create(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    name: String,
) -> ApiResult<Workspace> {
    let w = db.create_workspace(&name)?;
    changed(&app, &w.id, &w.id, "workspace", w.revision);
    Ok(w)
}
#[tauri::command(async)]
pub fn workspace_rename(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    id: String,
    name: String,
    expected_revision: i64,
) -> ApiResult<Workspace> {
    let w = db.rename_workspace(&id, &name, expected_revision)?;
    changed(&app, &w.id, &w.id, "workspace", w.revision);
    Ok(w)
}
#[tauri::command(async)]
pub fn entity_query(
    db: State<'_, Database>,
    workspace_id: String,
    kind: String,
    limit: u32,
    offset: u32,
) -> ApiResult<Vec<Entity>> {
    db.query(&workspace_id, &kind, limit, offset)
}
#[tauri::command(async)]
pub fn entity_get(db: State<'_, Database>, workspace_id: String, id: String) -> ApiResult<Entity> {
    db.get(&workspace_id, &id)
}
#[tauri::command(async)]
pub fn entity_save(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    input: SaveEntity,
) -> ApiResult<Entity> {
    let e = db.save(input)?;
    changed(&app, &e.workspace_id, &e.id, &e.kind, e.revision);
    Ok(e)
}
#[tauri::command(async)]
pub fn entity_delete(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
    expected_revision: i64,
) -> ApiResult<()> {
    db.remove(&workspace_id, &id, expected_revision)?;
    changed(&app, &workspace_id, &id, "deleted", expected_revision + 1);
    Ok(())
}
#[tauri::command(async)]
pub fn migration_import(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    input: ImportSnapshot,
) -> ApiResult<ImportResult> {
    let result = db.import_snapshot(input)?;
    changed(
        &app,
        &result.workspace_id,
        &result.workspace_id,
        "migration",
        1,
    );
    Ok(result)
}
#[tauri::command(async)]
pub fn body_begin(
    db: State<'_, Database>,
    workspace_id: String,
    size: u64,
    mime_type: String,
) -> ApiResult<String> {
    db.body_begin(&workspace_id, size, &mime_type)
}
#[tauri::command(async)]
pub fn body_append(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
    offset: u64,
    data: String,
) -> ApiResult<u64> {
    db.body_append(&workspace_id, &id, offset, &data)
}
#[tauri::command(async)]
pub fn body_finish(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
) -> ApiResult<BodyRef> {
    db.body_finish(&workspace_id, &id)
}
#[tauri::command(async)]
pub fn body_cancel(db: State<'_, Database>, workspace_id: String, id: String) -> ApiResult<()> {
    db.body_cancel(&workspace_id, &id)
}
#[tauri::command(async)]
pub fn body_read(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
    offset: u64,
    length: u32,
) -> ApiResult<BodyChunk> {
    db.body_read(&workspace_id, &id, offset, length)
}
#[tauri::command(async)]
pub fn secret_put(
    db: State<'_, Database>,
    workspace_id: String,
    id: String,
    value: String,
) -> ApiResult<()> {
    db.secret_put(&workspace_id, &id, value)
}
#[tauri::command(async)]
pub fn secret_get(db: State<'_, Database>, workspace_id: String, id: String) -> ApiResult<String> {
    db.secret_get(&workspace_id, &id)
}
#[tauri::command(async)]
pub fn secret_delete(db: State<'_, Database>, workspace_id: String, id: String) -> ApiResult<()> {
    db.secret_delete(&workspace_id, &id)
}

#[tauri::command]
pub fn engine_status(
    engine: State<'_, crate::engine::Supervisor>,
) -> ApiResult<crate::engine::EngineStatus> {
    engine.status()
}
#[tauri::command(async)]
pub fn engine_start(
    app: tauri::AppHandle,
    engine: State<'_, crate::engine::Supervisor>,
) -> ApiResult<crate::engine::EngineStatus> {
    use tauri::Manager;
    let resources = app
        .path()
        .resource_dir()
        .map_err(|_| ApiError::new("runtime", "Packaged resource directory unavailable."))?;
    engine.start(&resources)
}
#[tauri::command(async)]
pub fn engine_stop(engine: State<'_, crate::engine::Supervisor>) -> ApiResult<()> {
    engine.stop()
}

#[tauri::command]
pub async fn http_send(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    http: State<'_, crate::http::HttpRuntime>,
    input: crate::http::HttpInput,
) -> ApiResult<crate::http::HttpResult> {
    let workspace = input.workspace_id.clone();
    let run_id = input.run_id.clone();
    let result = http.send(&db, input).await;
    if let Ok(record) = db.get(&workspace, &run_id) {
        changed(&app, &workspace, &run_id, "api_run", record.revision);
    }
    result
}
#[tauri::command]
pub fn http_cancel(
    http: State<'_, crate::http::HttpRuntime>,
    workspace_id: String,
    run_id: String,
) -> ApiResult<()> {
    http.cancel(&workspace_id, &run_id)
}

#[tauri::command(async)]
pub fn windows_proxy_read() -> ApiResult<crate::platform::proxy::WindowsProxyState> {
    crate::platform::proxy::read()
}

#[tauri::command]
pub fn http_clear_cookies(
    db: State<'_, Database>,
    http: State<'_, crate::http::HttpRuntime>,
    workspace_id: String,
) -> ApiResult<()> {
    {
        let connection = db.lock()?;
        Database::require_workspace(&connection, &workspace_id)?;
    }
    http.clear_cookies(&workspace_id)
}
