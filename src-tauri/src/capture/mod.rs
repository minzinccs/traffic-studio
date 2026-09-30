use crate::{domain::*, storage::Database};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
#[cfg(test)]
mod tests;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaptureInput {
    pub workspace_id: String,
    pub name: String,
    pub port: u16,
    pub certificate_id: String,
    #[serde(default)]
    pub upstream_ca_pem: Option<String>,
    #[serde(default = "regular")]
    pub mode: String,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub ssl_intercept: bool,
}
fn regular() -> String {
    "regular".into()
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatus {
    pub state: String,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub port: Option<u16>,
    pub message: String,
}
type Acknowledgements =
    Arc<Mutex<std::collections::HashMap<String, std::sync::mpsc::Sender<bool>>>>;
struct Running {
    child: Child,
    token: String,
    workspace: String,
    session: String,
    port: u16,
    reader: Option<std::thread::JoinHandle<()>>,
    healthy: Arc<AtomicBool>,
    db: Database,
    acks: Acknowledgements,
    job: crate::platform::job::ChildJob,
}
#[derive(Default)]
pub struct CaptureRuntime {
    running: Mutex<Option<Running>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RuntimeConfig {
    python: String,
    site_packages: String,
}
pub fn available() -> bool {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let runtime_root = root.join(".runtime");
    let Ok(data) = std::fs::read(runtime_root.join("capture-runtime.json")) else {
        return false;
    };
    let Ok(config) = serde_json::from_slice::<RuntimeConfig>(&data) else {
        return false;
    };
    let Ok(site) = PathBuf::from(config.site_packages).canonicalize() else {
        return false;
    };
    let Ok(runtime) = runtime_root.canonicalize() else {
        return false;
    };
    let Ok(python) = PathBuf::from(config.python).canonicalize() else {
        return false;
    };
    site.starts_with(runtime)
        && site.is_dir()
        && python.is_file()
        && std::fs::read(root.join("engine-sidecar/mitm_adapter.py")).is_ok_and(|adapter| {
            adapter == include_bytes!("../../../engine-sidecar/mitm_adapter.py")
        })
}
impl CaptureRuntime {
    pub fn status(&self) -> ApiResult<CaptureStatus> {
        let mut guard = self
            .running
            .lock()
            .map_err(|_| ApiError::new("runtime", "Capture worker unavailable."))?;
        if let Some(run) = guard.as_mut() {
            if run.child.try_wait()?.is_none() && run.healthy.load(Ordering::Acquire) {
                return Ok(CaptureStatus {
                    state: "recording".into(),
                    workspace_id: Some(run.workspace.clone()),
                    session_id: Some(run.session.clone()),
                    port: Some(run.port),
                    message: "Native mitmproxy listener on 127.0.0.1. Windows proxy is unchanged."
                        .into(),
                });
            }
            let mut run = guard.take().unwrap();
            crate::platform::native_log::record("capture_worker", "stopped_unexpectedly");
            let _ = run.child.kill();
            let _ = run.child.wait();
            if let Some(reader) = run.reader.take() {
                let _ = reader.join();
            }
            end_session(&run.db, &run.workspace, &run.session, "error");
            return Ok(CaptureStatus{state:"error".into(),workspace_id:Some(run.workspace),session_id:Some(run.session),port:None,message:"Capture worker exited or event ingestion failed. Listener stopped; inspect the session and restart explicitly.".into()});
        }
        Ok(CaptureStatus {
            state: "stopped".into(),
            workspace_id: None,
            session_id: None,
            port: None,
            message: "Capture stopped. Start explicitly; no OS proxy/trust changes are automatic."
                .into(),
        })
    }
    pub fn start(
        &self,
        db: &Database,
        input: CaptureInput,
        emit: Arc<dyn Fn(&str, &str, &str, i64) + Send + Sync>,
    ) -> ApiResult<CaptureStatus> {
        valid_name(&input.name)?;
        valid_id(&input.certificate_id)?;
        if input.port == 0 {
            return Err(ApiError::new(
                "validation",
                "Choose a nonzero localhost port.",
            ));
        }
        let proxy_mode = match input.mode.as_str() {
            "regular" => "regular".to_string(),
            "reverse" | "upstream" => {
                let target = input.target.as_ref().ok_or_else(|| {
                    ApiError::new("validation", "Reverse/upstream mode needs a target.")
                })?;
                let url = reqwest::Url::parse(target)
                    .map_err(|_| ApiError::new("validation", "Invalid capture target URL."))?;
                if !["http", "https", "http3"].contains(&url.scheme())
                    || input.mode == "upstream" && url.scheme() == "http3"
                    || !url.username().is_empty()
                    || url.password().is_some()
                    || !matches!(url.path(), "" | "/")
                    || url.query().is_some()
                    || url.fragment().is_some()
                    || url.port_or_known_default() == Some(input.port)
                        && matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
                {
                    return Err(ApiError::new(
                        "validation",
                        "Use a target origin without credentials/path/query or listener recursion.",
                    ));
                }
                if url.scheme() == "http3" && !input.ssl_intercept {
                    return Err(ApiError::new(
                        "permission",
                        "HTTP3 reverse capture requires explicit TLS interception.",
                    ));
                }
                format!("{}:{}", input.mode, target.trim_end_matches('/'))
            }
            _ => return Err(ApiError::new("unsupported", "Capture mode is unsupported.")),
        };
        let mut guard = self
            .running
            .lock()
            .map_err(|_| ApiError::new("runtime", "Capture worker unavailable."))?;
        if guard.is_some() {
            return Err(ApiError::new(
                "conflict",
                "Stop the existing capture before starting another.",
            ));
        }
        {
            let connection = db.lock()?;
            Database::require_workspace(&connection, &input.workspace_id)?;
        }
        let initial_rules = if let Some(active) = db.active_rules(&input.workspace_id)? {
            let record = db.get(&input.workspace_id, &active.id)?;
            if record.kind != "rule_set" || record.revision != active.revision {
                return Err(ApiError::new(
                    "conflict",
                    "Active rule set changed. Re-apply it before starting capture.",
                ));
            }
            let rules: Vec<crate::rules::Rule> =
                serde_json::from_value(record.payload["rules"].clone())?;
            crate::rules::validate(&rules)?;
            crate::rules::reject_listener_recursion(&rules, input.port)?;
            serde_json::to_value(rules)?
        } else {
            json!([])
        };
        let runtime_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".runtime");
        let config: RuntimeConfig = serde_json::from_slice(
            &std::fs::read(runtime_root.join("capture-runtime.json")).map_err(|_| {
                ApiError::new(
                    "unsupported",
                    "Run scripts/setup-capture.ps1 to prepare the local capture runtime.",
                )
            })?,
        )?;
        let site = PathBuf::from(&config.site_packages).canonicalize()?;
        if !site.starts_with(runtime_root.canonicalize()?) {
            return Err(ApiError::new(
                "permission",
                "Capture dependencies must remain in the project runtime.",
            ));
        }
        let adapter = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("engine-sidecar/mitm_adapter.py");
        if std::fs::read(&adapter)? != include_bytes!("../../../engine-sidecar/mitm_adapter.py") {
            return Err(ApiError::new(
                "conflict",
                "Capture adapter changed. Rebuild the native app first.",
            ));
        }
        let (pem, protected, expires): (String, Vec<u8>, i64) = db.lock()?.query_row(
            "SELECT pem,protected_key,expires_at FROM device_certificates WHERE id=?1",
            [&input.certificate_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        if expires <= now() {
            return Err(ApiError::new("validation", "Selected CA is expired."));
        }
        let mut key = crate::platform::secrets::unprotect_bytes(&protected, &input.certificate_id)?;
        let session = uuid::Uuid::new_v4().to_string();
        let spool = db.root.join("capture-spool").join(&session);
        std::fs::create_dir_all(&spool)?;
        let token = uuid::Uuid::new_v4().to_string();
        let mut config = json!({"protocolVersion":1,"token":token,"port":input.port,"spool":spool,"privatePem":String::from_utf8(key.clone()).map_err(|_|ApiError::new("certificate","Invalid signing key"))?,"caPem":pem,"mode":proxy_mode,"sslIntercept":input.ssl_intercept,"initialRules":initial_rules});
        key.fill(0);
        if let Some(public) = input.upstream_ca_pem.filter(|p| !p.trim().is_empty()) {
            if public.len() > 65536 || reqwest::Certificate::from_pem(public.as_bytes()).is_err() {
                return Err(ApiError::new(
                    "validation",
                    "Additional upstream CA must be a valid PEM up to 64 KiB.",
                ));
            }
            let path = spool.join("upstream-ca.pem");
            std::fs::write(&path, public)?;
            config["upstreamCa"] = json!(path);
        }
        let mut command =
            Command::new(config_python(&config, &config_python_path(&runtime_root)?)?); // validated configuration, never imported UI/shell text
        command
            .arg(&adapter)
            .env("PYTHONPATH", &site)
            .env("PYTHONNOUSERSITE", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn()?;
        let job = match crate::platform::job::ChildJob::attach(&child) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let write = serde_json::to_writer(child.stdin.as_mut().unwrap(), &config)
            .map_err(ApiError::from)
            .and_then(|_| {
                child
                    .stdin
                    .as_mut()
                    .unwrap()
                    .write_all(b"\n")
                    .map_err(ApiError::from)
            });
        if let Some(Value::String(value)) = config.get_mut("privatePem") {
            unsafe {
                value.as_bytes_mut().fill(0);
            }
        }
        if let Err(error) = write {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        let stdout = child.stdout.take().unwrap();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let owner = input.workspace_id.clone();
        let session_copy = session.clone();
        let token_copy = token.clone();
        let database = db.clone();
        let port = input.port;
        let emit_copy = emit.clone();
        // Session intent exists before events are consumed. No synthetic flows are inserted.
        if let Err(error)=db.save(SaveEntity{workspace_id:owner.clone(),id:session.clone(),kind:"session".into(),name:input.name,expected_revision:0,payload:json!({"source":"native_capture","state":"starting","port":port,"certificateId":input.certificate_id,"createdAt":now(),"ownerPid":std::process::id(),"ownerStamp":crate::platform::process::stamp(std::process::id()).map(|v|v.to_string())})}){let _=child.kill();let _=child.wait();return Err(error);}
        let reader_owner = owner.clone();
        let acks: Acknowledgements = Arc::new(Mutex::new(std::collections::HashMap::new()));
        let reader_acks = acks.clone();
        let healthy = Arc::new(AtomicBool::new(true));
        let reader_health = healthy.clone();
        let reader = std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            let mut authenticated = false;
            let mut failed = false;
            loop {
                line.clear();
                let count = std::io::Read::by_ref(&mut reader)
                    .take(524289)
                    .read_line(&mut line)
                    .unwrap_or(0);
                if count == 0 {
                    break;
                }
                if line.len() > 524288 {
                    failed = true;
                    break;
                }
                let Ok(mut event) = serde_json::from_str::<Value>(&line) else {
                    failed = true;
                    break;
                };
                if !authenticated {
                    if event["type"] == "ready"
                        && event["token"] == token_copy
                        && event["port"] == port
                    {
                        authenticated = true;
                        let _ = ready_tx.send(true);
                    } else {
                        let _ = ready_tx.send(false);
                        break;
                    }
                    continue;
                }
                if let Some(operation) = event["operationId"].as_str() {
                    if let Ok(mut pending) = reader_acks.lock() {
                        if let Some(sender) = pending.remove(operation) {
                            let _ = sender.send(event["failed"] != true);
                        }
                    }
                }
                if event["type"] == "flow" || event["type"] == "frame" || event["type"] == "paused"
                {
                    if let Ok((id, revision)) =
                        database.capture_event(&reader_owner, &session_copy, &spool, &mut event)
                    {
                        emit_copy(&reader_owner, &id, "flow", revision);
                    } else {
                        failed = true;
                        break;
                    }
                }
            }
            end_session(
                &database,
                &reader_owner,
                &session_copy,
                if failed { "error" } else { "interrupted" },
            );
            reader_health.store(false, Ordering::Release);
            emit_copy(&reader_owner, &session_copy, "session", 0);
        });
        if ready_rx.recv_timeout(Duration::from_secs(10)).ok() != Some(true) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            end_session(db, &owner, &session, "error");
            return Err(ApiError::new("runtime","Capture did not confirm listener startup. Check port conflict/runtime/CA compatibility."));
        }
        set_session_state(db, &owner, &session, "recording");
        emit(&owner, &session, "session", 2);
        *guard = Some(Running {
            child,
            token,
            workspace: owner.clone(),
            session: session.clone(),
            port,
            reader: Some(reader),
            healthy,
            db: db.clone(),
            acks,
            job,
        });
        drop(guard);
        self.status()
    }
    pub fn stop(&self) -> ApiResult<()> {
        let mut guard = self
            .running
            .lock()
            .map_err(|_| ApiError::new("runtime", "Capture worker unavailable."))?;
        if let Some(mut run) = guard.take() {
            if let Some(stdin) = run.child.stdin.as_mut() {
                let _ = writeln!(stdin, "{}", json!({"token":run.token,"command":"shutdown"}));
            }
            let started = std::time::Instant::now();
            while run.child.try_wait()?.is_none() && started.elapsed() < Duration::from_secs(3) {
                std::thread::sleep(Duration::from_millis(30));
            }
            let _ = run.child.kill();
            let _ = run.child.wait();
            drop(run.job);
            if let Some(reader) = run.reader.take() {
                let _ = reader.join();
            }
            end_session(&run.db, &run.workspace, &run.session, "stopped");
        }
        Ok(())
    }
    pub fn rules(&self, rules: Value, revision: i64) -> ApiResult<()> {
        self.control(json!({"command":"rules","rules":rules,"revision":revision}))
    }
    pub fn control(&self, mut command: Value) -> ApiResult<()> {
        let mut guard = self
            .running
            .lock()
            .map_err(|_| ApiError::new("runtime", "Capture worker unavailable."))?;
        let run = guard.as_mut().ok_or_else(|| {
            ApiError::new(
                "not_found",
                "Start capture before sending control commands.",
            )
        })?;
        let id = uuid::Uuid::new_v4().to_string();
        command["operationId"] = json!(id);
        command["token"] = json!(run.token);
        let (tx, rx) = std::sync::mpsc::channel();
        run.acks
            .lock()
            .map_err(|_| ApiError::new("runtime", "Control worker unavailable."))?
            .insert(id.clone(), tx);
        let result = writeln!(
            run.child
                .stdin
                .as_mut()
                .ok_or_else(|| ApiError::new("runtime", "Capture control pipe closed"))?,
            "{}",
            command
        )
        .map_err(ApiError::from)
        .and_then(|_| match rx.recv_timeout(Duration::from_secs(5)) {
            Ok(true) => Ok(()),
            Ok(false) => Err(ApiError::new("conflict", "Capture operation expired.")),
            Err(_) => Err(ApiError::new(
                "timeout",
                "Engine did not acknowledge the command; state is uncertain.",
            )),
        });
        run.acks
            .lock()
            .map_err(|_| ApiError::new("runtime", "Control worker unavailable."))?
            .remove(&id);
        result
    }
}
fn config_python_path(root: &Path) -> ApiResult<String> {
    let config: RuntimeConfig =
        serde_json::from_slice(&std::fs::read(root.join("capture-runtime.json"))?)?;
    Ok(config.python)
}
fn config_python(_: &Value, path: &str) -> ApiResult<PathBuf> {
    let path = PathBuf::from(path).canonicalize()?;
    if !path.is_file() {
        return Err(ApiError::new(
            "validation",
            "Configured Python interpreter is unavailable.",
        ));
    }
    Ok(path)
}
impl Drop for CaptureRuntime {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
fn set_session_state(db: &Database, workspace: &str, session: &str, state: &str) {
    if let Ok(connection) = db.lock() {
        let _=connection.execute("UPDATE entities SET payload=json_set(payload,'$.state',?3),revision=revision+1,updated_at=?4 WHERE workspace_id=?1 AND id=?2",params![workspace,session,state,now()]);
    }
}
fn end_session(db: &Database, workspace: &str, session: &str, state: &str) {
    set_session_state(db, workspace, session, state);
}
impl Database {
    fn capture_event(
        &self,
        workspace: &str,
        session: &str,
        spool: &Path,
        event: &mut Value,
    ) -> ApiResult<(String, i64)> {
        let _content = crate::platform::content_lock::ContentLock::enter(&self.root)?;
        let id = event["id"]
            .as_str()
            .ok_or_else(|| ApiError::new("validation", "Capture event missing ID"))?
            .to_string();
        valid_id(&id)?;
        let mut refs = Vec::new();
        for field in ["requestBody", "responseBody", "body"] {
            let Some(value) = event.get_mut(field).filter(|v| v.is_object()) else {
                continue;
            };
            let Some(hash) = value["sha256"].as_str().map(str::to_owned) else {
                continue;
            };
            let size = value["size"]
                .as_u64()
                .ok_or_else(|| ApiError::new("validation", "Invalid captured body size"))?;
            if hash.len() != 64
                || !hash.bytes().all(|b| b.is_ascii_hexdigit())
                || size > 64 * 1024 * 1024
            {
                return Err(ApiError::new("validation", "Capture body limits exceeded"));
            }
            let source = spool.join(&hash);
            let mut file = std::fs::File::open(&source)?;
            let mut digest = Sha256::new();
            let mut count = 0;
            let mut bytes = [0u8; 65536];
            loop {
                let n = file.read(&mut bytes)?;
                if n == 0 {
                    break;
                }
                count += n as u64;
                if count > size {
                    return Err(ApiError::new("validation", "Body size mismatch"));
                }
                digest.update(&bytes[..n]);
            }
            if count != size || format!("{:x}", digest.finalize()) != hash {
                return Err(ApiError::new(
                    "validation",
                    "Captured body checksum mismatch",
                ));
            }
            let directory = self.root.join("bodies").join(workspace);
            std::fs::create_dir_all(&directory)?;
            let target = directory.join(&hash);
            if !target.exists() {
                std::fs::copy(&source, &target)?;
                std::fs::OpenOptions::new()
                    .write(true)
                    .open(&target)?
                    .sync_all()?;
            }
            let body_id = uuid::Uuid::new_v4().to_string();
            *value = json!({"workspaceId":workspace,"id":body_id,"sha256":hash,"size":size,"mimeType":"application/octet-stream"});
            refs.push((body_id, hash, size));
        }
        event
            .as_object_mut()
            .unwrap()
            .insert("sessionId".into(), json!(session));
        event
            .as_object_mut()
            .unwrap()
            .insert("source".into(), json!("native_capture"));
        let payload = serde_json::to_string(event)?;
        let mut connection = self.lock()?;
        let tx = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        Self::require_workspace(&tx, workspace)?;
        for (body_id, hash, size) in refs {
            tx.execute("INSERT INTO blobs(workspace_id,id,sha256,size,mime_type,created_at) VALUES(?1,?2,?3,?4,'application/octet-stream',?5)",params![workspace,body_id,hash,size as i64,now()])?;
        }
        tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'flow',?3,1,1,?4,?5) ON CONFLICT(workspace_id,id) DO UPDATE SET revision=entities.revision+1,payload=excluded.payload,updated_at=excluded.updated_at",params![workspace,id,if event["type"]=="frame"{"WebSocket frame"}else{"Captured request"},payload,now()])?;
        let revision = tx.query_row(
            "SELECT revision FROM entities WHERE workspace_id=?1 AND id=?2",
            params![workspace, id],
            |r| r.get(0),
        )?;
        tx.execute("INSERT OR IGNORE INTO entity_links(workspace_id,from_id,to_id,relation) VALUES(?1,?2,?3,'session')",params![workspace,id,session])?;
        tx.commit()?;
        Ok((id, revision))
    }
}
