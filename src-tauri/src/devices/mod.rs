use crate::{domain::*, storage::Database};
use rcgen::{CertificateParams, KeyPair, SanType};
use rustls::{
    pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer},
    ServerConfig,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    net::{IpAddr, Ipv4Addr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::{oneshot, Semaphore},
};
use tokio_rustls::{server::TlsStream, TlsAcceptor};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanStatus {
    pub running: bool,
    pub workspace_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub fingerprint: Option<String>,
    pub token: Option<String>,
    pub pairing: Option<String>,
    pub device_count: usize,
    pub ingested_flows: u64,
    pub ingested_events: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanDevice {
    pub id: String,
    pub label: String,
    pub peer_ip: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub flows_ingested: u64,
    pub events_ingested: u64,
}

struct Listener {
    workspace: String,
    host: Ipv4Addr,
    port: u16,
    fingerprint: String,
    pairing: String,
    devices: Arc<Mutex<Vec<LanDevice>>>,
    counters: Arc<Mutex<(u64, u64)>>,
    stop: oneshot::Sender<()>,
}
#[derive(Default)]
pub struct LanReadRuntime {
    listener: Mutex<Option<Listener>>,
}
struct Rate {
    since: Instant,
    count: u32,
}
impl Rate {
    fn allow(&mut self) -> bool {
        if self.since.elapsed() >= Duration::from_secs(60) {
            self.since = Instant::now();
            self.count = 0;
        }
        if self.count >= 120 {
            return false;
        }
        self.count += 1;
        true
    }
}

pub fn build_pairing_payload(host: &str, port: u16, fingerprint: &str, token: &str) -> String {
    serde_json::json!({
        "schemaVersion": 1,
        "host": host,
        "port": port,
        "fingerprint": fingerprint,
        "token": token,
    })
    .to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IngestFlow {
    method: String,
    url: String,
    status: Option<u16>,
    duration_ms: Option<u64>,
    note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IngestEvent {
    kind: String,
    message: String,
    level: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IngestDoc {
    schema_version: u32,
    device_id: String,
    device_label: Option<String>,
    flows: Option<Vec<IngestFlow>>,
    events: Option<Vec<IngestEvent>>,
}

fn truncate(text: &str, max: usize) -> String {
    let mut out: String = text.chars().take(max).collect();
    if text.chars().count() > max {
        out.push('…');
    }
    out
}

fn parse_ingest_body(bytes: &[u8]) -> ApiResult<IngestDoc> {
    let doc: IngestDoc = serde_json::from_slice(bytes)
        .map_err(|_| ApiError::new("validation", "Ingest body must be JSON."))?;
    if doc.schema_version != 1 {
        return Err(ApiError::new(
            "validation",
            "Unsupported ingest schemaVersion; expected 1.",
        ));
    }
    let device_id = doc.device_id.trim();
    if device_id.is_empty() || device_id.len() > 64 {
        return Err(ApiError::new(
            "validation",
            "deviceId must contain 1–64 characters.",
        ));
    }
    if doc.device_label.as_deref().is_some_and(|l| l.len() > 80) {
        return Err(ApiError::new(
            "validation",
            "deviceLabel must be at most 80 characters.",
        ));
    }
    let flows = doc.flows.as_ref().map(Vec::len).unwrap_or(0);
    let events = doc.events.as_ref().map(Vec::len).unwrap_or(0);
    if flows == 0 && events == 0 {
        return Err(ApiError::new(
            "validation",
            "Ingest must include at least one flow or event.",
        ));
    }
    if flows > 50 {
        return Err(ApiError::new(
            "validation",
            "At most 50 flows per ingest request.",
        ));
    }
    if events > 100 {
        return Err(ApiError::new(
            "validation",
            "At most 100 events per ingest request.",
        ));
    }
    for flow in doc.flows.as_deref().unwrap_or_default() {
        let method = flow.method.trim();
        if method.is_empty()
            || method.len() > 16
            || !method
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err(ApiError::new("validation", "Flow method is invalid."));
        }
        let url = flow.url.trim();
        if url.is_empty()
            || url.len() > 2048
            || !(url.starts_with("http://") || url.starts_with("https://"))
        {
            return Err(ApiError::new(
                "validation",
                "Flow url must be an http(s) URL up to 2048 characters.",
            ));
        }
        if flow.status.is_some_and(|s| !(100..=599).contains(&s)) {
            return Err(ApiError::new("validation", "Flow status is out of range."));
        }
        if flow.duration_ms.is_some_and(|d| d > 3_600_000) {
            return Err(ApiError::new(
                "validation",
                "Flow durationMs is out of range.",
            ));
        }
        if flow.note.as_deref().is_some_and(|n| n.len() > 2000) {
            return Err(ApiError::new(
                "validation",
                "Flow note must be at most 2000 characters.",
            ));
        }
    }
    for event in doc.events.as_deref().unwrap_or_default() {
        if event.kind.trim().is_empty() || event.kind.len() > 32 {
            return Err(ApiError::new(
                "validation",
                "Event kind must contain 1–32 characters.",
            ));
        }
        if event.message.trim().is_empty() || event.message.len() > 2000 {
            return Err(ApiError::new(
                "validation",
                "Event message must contain 1–2000 characters.",
            ));
        }
        if event
            .level
            .as_deref()
            .is_some_and(|l| !["debug", "info", "warn", "error"].contains(&l))
        {
            return Err(ApiError::new(
                "validation",
                "Event level must be debug, info, warn or error.",
            ));
        }
    }
    Ok(doc)
}

fn touch_device(
    devices: &Mutex<Vec<LanDevice>>,
    id: &str,
    label: &str,
    peer_ip: &str,
    flows: u64,
    events: u64,
) {
    if let Ok(mut guard) = devices.lock() {
        let at = now();
        if let Some(found) = guard.iter_mut().find(|d| d.id == id) {
            found.label = truncate(label, 80);
            found.peer_ip = peer_ip.into();
            found.last_seen = at;
            found.flows_ingested += flows;
            found.events_ingested += events;
        } else {
            guard.push(LanDevice {
                id: truncate(id, 64),
                label: truncate(label, 80),
                peer_ip: peer_ip.into(),
                first_seen: at,
                last_seen: at,
                flows_ingested: flows,
                events_ingested: events,
            });
            if guard.len() > 32 {
                guard.remove(0);
            }
        }
    }
}

fn store_ingest(db: &Database, workspace: &str, doc: &IngestDoc) -> ApiResult<(u64, u64)> {
    let at = now();
    let label = truncate(doc.device_label.as_deref().unwrap_or("Mobile device"), 80);
    let mut flows_stored = 0u64;
    for flow in doc.flows.as_deref().unwrap_or_default() {
        let host = flow
            .url
            .split("://")
            .nth(1)
            .unwrap_or(&flow.url)
            .split('/')
            .next()
            .unwrap_or(&flow.url);
        let name = truncate(
            &format!("{} {}", flow.method.trim().to_uppercase(), host),
            80,
        );
        let payload = json!({
            "source": "mobile",
            "deviceId": doc.device_id.trim(),
            "deviceLabel": label,
            "method": flow.method.trim().to_uppercase(),
            "url": truncate(flow.url.trim(), 2048),
            "status": flow.status,
            "durationMs": flow.duration_ms,
            "note": flow.note.as_deref().map(|n| truncate(n, 2000)),
            "ingestedAt": at,
        });
        db.save(SaveEntity {
            workspace_id: workspace.into(),
            id: uuid::Uuid::new_v4().to_string(),
            kind: "flow".into(),
            name,
            expected_revision: 0,
            payload,
        })?;
        flows_stored += 1;
    }
    let mut events_stored = 0u64;
    for event in doc.events.as_deref().unwrap_or_default() {
        let name = truncate(
            &format!(
                "[{}] {}",
                event.kind.trim(),
                event.message.trim().chars().take(60).collect::<String>()
            ),
            80,
        );
        let payload = json!({
            "source": "mobile",
            "deviceId": doc.device_id.trim(),
            "deviceLabel": label,
            "category": "mobile-debug",
            "status": event.level.as_deref().unwrap_or("info"),
            "kind": truncate(event.kind.trim(), 32),
            "message": truncate(event.message.trim(), 2000),
            "at": at,
        });
        db.save(SaveEntity {
            workspace_id: workspace.into(),
            id: uuid::Uuid::new_v4().to_string(),
            kind: "tracker_item".into(),
            name,
            expected_revision: 0,
            payload,
        })?;
        events_stored += 1;
    }
    Ok((flows_stored, events_stored))
}

impl LanReadRuntime {
    pub fn status(&self) -> ApiResult<LanStatus> {
        let guard = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?;
        Ok(match guard.as_ref() {
            Some(value) => {
                let device_count = value.devices.lock().map(|d| d.len()).unwrap_or(0);
                let (flows, events) = value.counters.lock().map(|c| *c).unwrap_or((0, 0));
                LanStatus {
                    running: true,
                    workspace_id: Some(value.workspace.clone()),
                    host: Some(value.host.to_string()),
                    port: Some(value.port),
                    fingerprint: Some(value.fingerprint.clone()),
                    token: None,
                    pairing: None,
                    device_count,
                    ingested_flows: flows,
                    ingested_events: events,
                }
            }
            None => LanStatus {
                running: false,
                workspace_id: None,
                host: None,
                port: None,
                fingerprint: None,
                token: None,
                pairing: None,
                device_count: 0,
                ingested_flows: 0,
                ingested_events: 0,
            },
        })
    }
    pub fn devices(&self) -> ApiResult<Vec<LanDevice>> {
        let guard = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?;
        match guard.as_ref() {
            Some(value) => value
                .devices
                .lock()
                .map(|d| d.clone())
                .map_err(|_| ApiError::new("runtime", "LAN device list unavailable")),
            None => Err(ApiError::new("conflict", "LAN sharing is not running.")),
        }
    }
    pub fn pairing(&self) -> ApiResult<String> {
        let guard = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?;
        guard
            .as_ref()
            .map(|value| value.pairing.clone())
            .ok_or_else(|| ApiError::new("conflict", "LAN sharing is not running."))
    }
    pub fn revoke(&self, device_id: &str) -> ApiResult<Vec<LanDevice>> {
        let guard = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?;
        let Some(value) = guard.as_ref() else {
            return Err(ApiError::new("conflict", "LAN sharing is not running."));
        };
        let mut devices = value
            .devices
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN device list unavailable"))?;
        devices.retain(|d| d.id != device_id);
        Ok(devices.clone())
    }
    pub async fn start(
        &self,
        db: &Database,
        workspace_id: String,
        host: String,
        port: u16,
        acknowledged: bool,
    ) -> ApiResult<LanStatus> {
        if !acknowledged {
            return Err(ApiError::new(
                "permission",
                "Confirm LAN sharing for this workspace.",
            ));
        }
        let address: Ipv4Addr = host.parse().map_err(|_| {
            ApiError::new("validation", "Enter this PC's private Wi-Fi IPv4 address.")
        })?;
        if !address.is_private() || address.is_loopback() || port == 0 {
            return Err(ApiError::new(
                "validation",
                "Use a private LAN IPv4 address and nonzero port.",
            ));
        }
        {
            let connection = db.lock()?;
            Database::require_workspace(&connection, &workspace_id)?;
        }
        let socket = TcpListener::bind((address, port)).await.map_err(|_| {
            ApiError::new("network", "LAN address or port is unavailable on this PC.")
        })?;
        let mut guard = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?;
        if guard.is_some() {
            return Err(ApiError::new(
                "conflict",
                "Stop the current LAN reader first.",
            ));
        }
        let mut params = CertificateParams::new(vec![])
            .map_err(|_| ApiError::new("certificate", "Could not configure LAN certificate."))?;
        params
            .subject_alt_names
            .push(SanType::IpAddress(IpAddr::V4(address)));
        let key = KeyPair::generate()
            .map_err(|_| ApiError::new("certificate", "Could not generate LAN key."))?;
        let cert = params
            .self_signed(&key)
            .map_err(|_| ApiError::new("certificate", "Could not generate LAN certificate."))?;
        let fingerprint = format!("{:x}", Sha256::digest(cert.der().as_ref()));
        let private = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.serialize_der()));
        let config = ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(vec![CertificateDer::from(cert.der().to_vec())], private)
            .map_err(|_| ApiError::new("certificate", "Could not configure LAN TLS."))?;
        let acceptor = TlsAcceptor::from(Arc::new(config));
        let token = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        let pairing = build_pairing_payload(&address.to_string(), port, &fingerprint, &token);
        let (stop, mut stopped) = oneshot::channel();
        let devices: Arc<Mutex<Vec<LanDevice>>> = Arc::new(Mutex::new(Vec::new()));
        let counters: Arc<Mutex<(u64, u64)>> = Arc::new(Mutex::new((0, 0)));
        *guard = Some(Listener {
            workspace: workspace_id.clone(),
            host: address,
            port,
            fingerprint: fingerprint.clone(),
            pairing: pairing.clone(),
            devices: devices.clone(),
            counters: counters.clone(),
            stop,
        });
        drop(guard);
        let database = db.clone();
        let scope = workspace_id.clone();
        let secret = token.clone();
        tauri::async_runtime::spawn(async move {
            let semaphore = Arc::new(Semaphore::new(4));
            let rate = Arc::new(Mutex::new(Rate {
                since: Instant::now(),
                count: 0,
            }));
            let mut tasks = tokio::task::JoinSet::new();
            loop {
                tokio::select! {
                 _=&mut stopped=>{tasks.abort_all();break},
                 incoming=socket.accept()=>{let Ok((stream,peer))=incoming else{break};if !peer.ip().is_ipv4() || !peer.ip().to_string().parse::<Ipv4Addr>().is_ok_and(|ip|ip.is_private()){continue}let Ok(permit)=semaphore.clone().try_acquire_owned()else{continue};let acceptor=acceptor.clone();let db=database.clone();let workspace=scope.clone();let token=secret.clone();let rate=rate.clone();let devices=devices.clone();let counters=counters.clone();tasks.spawn(async move{let _permit=permit;let _=tokio::time::timeout(Duration::from_secs(15),serve(stream,acceptor,&db,&workspace,address,port,&token,&rate,&devices,&counters,peer.ip().to_string())).await;});},
                 _=tasks.join_next(),if !tasks.is_empty()=>{}
                }
            }
        });
        Ok(LanStatus {
            running: true,
            workspace_id: Some(workspace_id),
            host: Some(address.to_string()),
            port: Some(port),
            fingerprint: Some(fingerprint),
            token: Some(token),
            pairing: Some(pairing),
            device_count: 0,
            ingested_flows: 0,
            ingested_events: 0,
        })
    }
    pub fn stop(&self) -> ApiResult<()> {
        if let Some(listener) = self
            .listener
            .lock()
            .map_err(|_| ApiError::new("runtime", "LAN reader unavailable"))?
            .take()
        {
            let _ = listener.stop.send(());
        }
        Ok(())
    }
}
impl Drop for LanReadRuntime {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

async fn reply(stream: &mut TlsStream<TcpStream>, status: &str, value: Value) -> ApiResult<()> {
    let bytes = serde_json::to_vec(&value)?;
    let header=format!("HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n",bytes.len());
    stream.write_all(header.as_bytes()).await?;
    stream.write_all(&bytes).await?;
    Ok(())
}

fn bearer_ok(actual: &[u8], secret: &str) -> bool {
    let expected = format!("Bearer {secret}");
    let expected = expected.as_bytes();
    if actual.len() != expected.len() {
        return false;
    }
    actual
        .iter()
        .zip(expected.iter())
        .fold(0u8, |diff, (a, b)| diff | (*a ^ *b))
        == 0
}

async fn serve(
    stream: TcpStream,
    acceptor: TlsAcceptor,
    db: &Database,
    workspace: &str,
    host: Ipv4Addr,
    port: u16,
    secret: &str,
    rate: &Mutex<Rate>,
    devices: &Mutex<Vec<LanDevice>>,
    counters: &Mutex<(u64, u64)>,
    peer_ip: String,
) -> ApiResult<()> {
    let mut stream = acceptor
        .accept(stream)
        .await
        .map_err(|_| ApiError::new("network", "LAN TLS handshake failed."))?;
    let mut bytes = Vec::with_capacity(1024);
    let mut one = [0u8; 1];
    while !bytes.ends_with(b"\r\n\r\n") {
        if bytes.len() >= 8192 {
            return reply(
                &mut stream,
                "431 Request Header Fields Too Large",
                json!({"error":"Headers too large"}),
            )
            .await;
        }
        if stream.read(&mut one).await? == 0 {
            return Ok(());
        }
        bytes.push(one[0]);
    }
    let Ok(header) = std::str::from_utf8(&bytes) else {
        return reply(
            &mut stream,
            "400 Bad Request",
            json!({"error":"Invalid headers"}),
        )
        .await;
    };
    let mut lines = header.split("\r\n");
    let request = lines.next().unwrap_or("");
    let mut parts = request.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    let mut headers = std::collections::HashMap::new();
    for line in lines.filter(|line| !line.is_empty()) {
        let Some((key, value)) = line.split_once(':') else {
            return reply(
                &mut stream,
                "400 Bad Request",
                json!({"error":"Invalid headers"}),
            )
            .await;
        };
        if headers
            .insert(key.trim().to_ascii_lowercase(), value.trim().to_string())
            .is_some()
        {
            return reply(
                &mut stream,
                "400 Bad Request",
                json!({"error":"Duplicate headers"}),
            )
            .await;
        }
    }
    if headers.contains_key("origin")
        || headers.get("host") != Some(&format!("{host}:{port}"))
        || headers.contains_key("transfer-encoding")
    {
        return reply(
            &mut stream,
            "403 Forbidden",
            json!({"error":"Request rejected"}),
        )
        .await;
    }
    let actual = headers
        .get("authorization")
        .map(String::as_bytes)
        .unwrap_or_default()
        .to_vec();
    if !bearer_ok(&actual, secret) {
        return reply(
            &mut stream,
            "401 Unauthorized",
            json!({"error":"Pairing token required"}),
        )
        .await;
    }
    if !rate
        .lock()
        .map_err(|_| ApiError::new("runtime", "LAN limiter unavailable"))?
        .allow()
    {
        return reply(
            &mut stream,
            "429 Too Many Requests",
            json!({"error":"Rate limit reached"}),
        )
        .await;
    }
    if method == "GET" {
        let content_length = headers.get("content-length");
        if content_length.is_some_and(|v| v != "0") {
            return reply(
                &mut stream,
                "403 Forbidden",
                json!({"error":"Request rejected"}),
            )
            .await;
        }
        let kind = match path {
            "/v1/sessions" => "session",
            "/v1/flows" => "flow",
            "/v1/collections" => "collection",
            _ => {
                return reply(
                    &mut stream,
                    "404 Not Found",
                    json!({"error":"Unknown endpoint"}),
                )
                .await
            }
        };
        touch_device(
            devices,
            &format!("lan-{peer_ip}"),
            "Read-only client",
            &peer_ip,
            0,
            0,
        );
        let rows = db.query(workspace, kind, 50, 0)?;
        let items=rows.into_iter().map(|row|json!({"id":row.id,"name":row.name,"kind":row.kind,"updatedAt":row.updated_at,"method":row.payload["method"],"status":row.payload["status"],"source":row.payload["source"]})).collect::<Vec<_>>();
        return reply(
            &mut stream,
            "200 OK",
            json!({"schemaVersion":1,"workspaceId":workspace,"items":items,"limit":50,"readOnly":true}),
        )
        .await;
    }
    if method == "POST" && path == "/v1/ingest" {
        let length: usize = headers
            .get("content-length")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        if length == 0 || length > 512 * 1024 {
            return reply(
                &mut stream,
                "413 Payload Too Large",
                json!({"error":"Ingest body must be 1–524288 bytes."}),
            )
            .await;
        }
        if headers
            .get("content-type")
            .is_some_and(|v| !v.starts_with("application/json"))
        {
            return reply(
                &mut stream,
                "415 Unsupported Media Type",
                json!({"error":"Ingest body must be application/json."}),
            )
            .await;
        }
        let mut body = vec![0u8; length];
        if let Err(_) =
            tokio::time::timeout(Duration::from_secs(10), stream.read_exact(&mut body)).await
        {
            return reply(
                &mut stream,
                "408 Request Timeout",
                json!({"error":"Ingest body incomplete."}),
            )
            .await;
        }
        let doc = match parse_ingest_body(&body) {
            Ok(doc) => doc,
            Err(error) => {
                return reply(
                    &mut stream,
                    "422 Unprocessable Entity",
                    json!({"error": error.message}),
                )
                .await
            }
        };
        let stored = match store_ingest(db, workspace, &doc) {
            Ok(stored) => stored,
            Err(error) => {
                return reply(
                    &mut stream,
                    "500 Internal Server Error",
                    json!({"error": error.message}),
                )
                .await
            }
        };
        let label = doc.device_label.as_deref().unwrap_or("Mobile device");
        touch_device(
            devices,
            doc.device_id.trim(),
            label,
            &peer_ip,
            stored.0,
            stored.1,
        );
        if let Ok(mut guard) = counters.lock() {
            guard.0 += stored.0;
            guard.1 += stored.1;
        }
        return reply(
            &mut stream,
            "200 OK",
            json!({"schemaVersion":1,"workspaceId":workspace,"acceptedFlows":stored.0,"acceptedEvents":stored.1}),
        )
        .await;
    }
    reply(
        &mut stream,
        "404 Not Found",
        json!({"error":"Unknown endpoint"}),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pairing_payload_is_versioned_json() {
        let payload = build_pairing_payload("192.168.1.20", 8891, "abc123", "tok");
        let value: Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["host"], "192.168.1.20");
        assert_eq!(value["port"], 8891);
        assert_eq!(value["fingerprint"], "abc123");
        assert_eq!(value["token"], "tok");
    }

    #[test]
    fn ingest_validation() {
        let ok = parse_ingest_body(
            br#"{"schemaVersion":1,"deviceId":"pixel-8","deviceLabel":"Pixel 8","flows":[{"method":"GET","url":"https://example.com/api","status":200}],"events":[{"kind":"console","message":"hello","level":"info"}]}"#,
        )
        .unwrap();
        assert_eq!(ok.flows.unwrap().len(), 1);
        assert_eq!(ok.events.unwrap().len(), 1);
        assert!(parse_ingest_body(br#"{"schemaVersion":2,"deviceId":"a"}"#).is_err());
        assert!(parse_ingest_body(br#"{"schemaVersion":1,"deviceId":"","flows":[]}"#).is_err());
        assert!(parse_ingest_body(
            br#"{"schemaVersion":1,"deviceId":"a","flows":[{"method":"GET","url":"ftp://x"}]}"#
        )
        .is_err());
        let many_flows = format!(
            "{{\"schemaVersion\":1,\"deviceId\":\"a\",\"flows\":[{}]}}",
            (0..51)
                .map(|_| r#"{"method":"GET","url":"https://example.com/"}"#)
                .collect::<Vec<_>>()
                .join(",")
        );
        assert!(parse_ingest_body(many_flows.as_bytes()).is_err());
    }

    #[test]
    fn bearer_compare_is_length_bound() {
        assert!(bearer_ok(b"Bearer secret", "secret"));
        assert!(!bearer_ok(b"Bearer wrong", "secret"));
        assert!(!bearer_ok(b"Bearer short", "a-much-longer-secret"));
    }
}
