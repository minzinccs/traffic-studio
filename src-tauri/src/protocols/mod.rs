use crate::{domain::*, storage::Database};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};
#[cfg(test)]
mod network_tests;
type Emit = Arc<dyn Fn(&str, &str, &str, i64) + Send + Sync>;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StreamInput {
    pub workspace_id: String,
    pub id: String,
    pub url: String,
    pub protocol: String,
    #[serde(default)]
    pub headers: Vec<crate::http::Header>,
    #[serde(default)]
    pub subprotocol: String,
    #[serde(default)]
    pub last_event_id: String,
}
struct Active {
    sender: mpsc::Sender<Message>,
    cancel: Option<oneshot::Sender<()>>,
}
#[derive(Clone, Default)]
pub struct ProtocolRuntime {
    active: Arc<Mutex<HashMap<(String, String), Active>>>,
}
impl ProtocolRuntime {
    pub fn stop(&self, workspace: &str, id: &str) -> ApiResult<()> {
        valid_id(workspace)?;
        valid_id(id)?;
        let mut active = self
            .active
            .lock()
            .map_err(|_| ApiError::new("runtime", "Streaming worker unavailable"))?;
        let entry = active
            .get_mut(&(workspace.into(), id.into()))
            .ok_or_else(|| ApiError::new("not_found", "Stream is no longer active"))?;
        if let Some(sender) = entry.cancel.take() {
            let _ = sender.send(());
        }
        Ok(())
    }
    pub fn send(&self, workspace: &str, id: &str, kind: &str, data: &str) -> ApiResult<()> {
        valid_id(workspace)?;
        valid_id(id)?;
        if data.len() > 256 * 1024 {
            return Err(ApiError::new("validation", "Message exceeds 256 KiB"));
        }
        let message = match kind {
            "text" => Message::Text(data.into()),
            "binary" => Message::Binary(
                STANDARD
                    .decode(data)
                    .map_err(|_| ApiError::new("validation", "Invalid Base64 frame"))?
                    .into(),
            ),
            "ping" if data.len() <= 125 => Message::Ping(data.as_bytes().to_vec().into()),
            _ => return Err(ApiError::new("validation", "Unsupported message kind/size")),
        };
        self.active
            .lock()
            .map_err(|_| ApiError::new("runtime", "Streaming worker unavailable"))?
            .get(&(workspace.into(), id.into()))
            .ok_or_else(|| ApiError::new("not_found", "Stream is not active"))?
            .sender
            .try_send(message)
            .map_err(|_| ApiError::new("busy", "Message queue is full or connection closed"))
    }
    pub fn start(&self, db: &Database, input: StreamInput, emit: Emit) -> ApiResult<()> {
        valid_id(&input.id)?;
        let url = reqwest::Url::parse(&input.url)
            .map_err(|_| ApiError::new("validation", "Invalid stream URL"))?;
        if !url.username().is_empty()
            || url.password().is_some()
            || input.url.len() > 16384
            || input.headers.len() > 100
            || input
                .headers
                .iter()
                .map(|h| h.key.len() + h.value.len())
                .sum::<usize>()
                > 65536
            || input.subprotocol.len() > 256
            || input.last_event_id.len() > 4096
        {
            return Err(ApiError::new(
                "validation",
                "Invalid stream credentials/metadata size",
            ));
        }
        if !(input.protocol == "WebSocket" && ["ws", "wss"].contains(&url.scheme())
            || input.protocol == "SSE" && ["http", "https"].contains(&url.scheme()))
        {
            return Err(ApiError::new(
                "validation",
                "Protocol and URL scheme do not match",
            ));
        }
        for h in &input.headers {
            if h.key.contains(['\r', '\n'])
                || h.value.contains(['\r', '\n'])
                || [
                    "host",
                    "connection",
                    "upgrade",
                    "sec-websocket-key",
                    "sec-websocket-version",
                    "content-length",
                    "transfer-encoding",
                ]
                .contains(&h.key.to_lowercase().as_str())
            {
                return Err(ApiError::new(
                    "validation",
                    "Invalid or transport-owned header",
                ));
            }
        }
        {
            let c = db.lock()?;
            Database::require_workspace(&c, &input.workspace_id)?;
        }
        let mut active = self
            .active
            .lock()
            .map_err(|_| ApiError::new("runtime", "Streaming worker unavailable"))?;
        let key = (input.workspace_id.clone(), input.id.clone());
        if active.len() >= 8 || active.contains_key(&key) {
            return Err(ApiError::new(
                "busy",
                "Eight streams active or connection ID already used",
            ));
        }
        let (sender, mut messages) = mpsc::channel(32);
        let (cancel_tx, cancel_rx) = oneshot::channel();
        let record=db.save(SaveEntity{workspace_id:input.workspace_id.clone(),id:input.id.clone(),kind:"session".into(),name:format!("{} stream",input.protocol),expected_revision:0,payload:json!({"source":"native_protocol","state":"connecting","url":input.url,"protocol":input.protocol,"createdAt":now(),"ownerPid":std::process::id(),"ownerStamp":crate::platform::process::stamp(std::process::id()).map(|v|v.to_string())})})?;
        emit(&record.workspace_id, &record.id, "session", record.revision);
        active.insert(
            key.clone(),
            Active {
                sender,
                cancel: Some(cancel_tx),
            },
        );
        drop(active);
        let database = db.clone();
        let worker = self.clone();
        tauri::async_runtime::spawn(async move {
            let work = async {
                if input.protocol == "WebSocket" {
                    let mut request = input.url.as_str().into_client_request().map_err(|_| {
                        ApiError::new("validation", "Invalid WebSocket handshake URL")
                    })?;
                    for h in &input.headers {
                        request.headers_mut().append(
                            h.key
                                .parse::<tokio_tungstenite::tungstenite::http::HeaderName>()
                                .map_err(|_| ApiError::new("validation", "Invalid header"))?,
                            h.value
                                .parse()
                                .map_err(|_| ApiError::new("validation", "Invalid header"))?,
                        );
                    }
                    if !input.subprotocol.is_empty() {
                        request.headers_mut().insert(
                            "Sec-WebSocket-Protocol",
                            input
                                .subprotocol
                                .parse()
                                .map_err(|_| ApiError::new("validation", "Invalid subprotocol"))?,
                        );
                    }
                    let config =
                        tokio_tungstenite::tungstenite::protocol::WebSocketConfig::default()
                            .max_message_size(Some(256 * 1024))
                            .max_frame_size(Some(256 * 1024));
                    let (mut stream, _response) = tokio::time::timeout(
                        Duration::from_secs(30),
                        tokio_tungstenite::connect_async_with_config(request, Some(config), false),
                    )
                    .await
                    .map_err(|_| ApiError::new("timeout", "WebSocket connect timed out"))?
                    .map_err(|_| ApiError::new("network", "WebSocket handshake/TLS failed"))?;
                    state(&database, &input, "connected", &emit);
                    let mut count = 0;
                    loop {
                        tokio::select! {
                         incoming=stream.next()=>match incoming{Some(Ok(message))=>{if matches!(message,Message::Close(_)){break;}save_frame(&database,&input,"response",&message,&emit)?;count+=1;},Some(Err(_))=>return Err(ApiError::new("network","WebSocket transport failed")),None=>break},
                         outgoing=messages.recv()=>if let Some(message)=outgoing{stream.send(message.clone()).await.map_err(|_|ApiError::new("network","WebSocket send failed"))?;save_frame(&database,&input,"request",&message,&emit)?;count+=1;}else{break;}
                        }
                        if count >= 10000 {
                            return Err(ApiError::new(
                                "quota",
                                "Connection reached 10000 recorded frames; reconnect to continue",
                            ));
                        }
                    }
                } else {
                    let client = reqwest::Client::builder()
                        .no_proxy()
                        .redirect(reqwest::redirect::Policy::none())
                        .connect_timeout(Duration::from_secs(30))
                        .build()
                        .map_err(|_| ApiError::new("runtime", "SSE transport unavailable"))?;
                    let mut request = client.get(&input.url).header("Accept", "text/event-stream");
                    for h in &input.headers {
                        request = request.header(&h.key, &h.value);
                    }
                    if !input.last_event_id.is_empty() {
                        request = request.header("Last-Event-ID", &input.last_event_id);
                    }
                    let response = tokio::time::timeout(Duration::from_secs(30), request.send())
                        .await
                        .map_err(|_| ApiError::new("timeout", "SSE connect timed out"))?
                        .map_err(|_| ApiError::new("network", "SSE connection/TLS failed"))?;
                    if !response.status().is_success()
                        || !response
                            .headers()
                            .get("content-type")
                            .and_then(|v| v.to_str().ok())
                            .is_some_and(|v| v.to_lowercase().starts_with("text/event-stream"))
                    {
                        return Err(ApiError::new(
                            "network",
                            "SSE endpoint did not return a successful event stream",
                        ));
                    }
                    state(&database, &input, "connected", &emit);
                    let mut stream = response.bytes_stream();
                    let mut parser = SseParser::default();
                    let mut count = 0;
                    while let Some(chunk) = stream.next().await {
                        let chunk = chunk
                            .map_err(|_| ApiError::new("network", "SSE stream disconnected"))?;
                        for event in parser.push(&chunk)? {
                            let record=database.save(SaveEntity{workspace_id:input.workspace_id.clone(),id:uuid::Uuid::new_v4().to_string(),kind:"flow".into(),name:"SSE event".into(),expected_revision:0,payload:json!({"source":"native_protocol","type":"sse_event","sessionId":input.id,"url":input.url,"event":event,"timestamp":now()})})?;
                            emit(&record.workspace_id, &record.id, "flow", record.revision);
                            count += 1;
                            if count >= 10000 {
                                return Err(ApiError::new(
                                    "quota",
                                    "Stream reached 10000 events; reconnect to continue",
                                ));
                            }
                        }
                    }
                }
                Ok::<(), ApiError>(())
            };
            let result = tokio::select! {_=cancel_rx=>Err(ApiError::new("cancelled","Stream stopped by user")),result=work=>result};
            state(
                &database,
                &input,
                match result {
                    Ok(_) => "closed",
                    Err(ref e) if e.code == "cancelled" => "cancelled",
                    Err(_) => "error",
                },
                &emit,
            );
            if let Ok(mut active) = worker.active.lock() {
                active.remove(&key);
            }
        });
        Ok(())
    }
}
fn state(db: &Database, input: &StreamInput, state: &str, emit: &Emit) {
    if let Ok(mut row) = db.get(&input.workspace_id, &input.id) {
        row.payload["state"] = json!(state);
        if let Ok(row) = db.save(SaveEntity {
            workspace_id: row.workspace_id,
            id: row.id,
            kind: row.kind,
            name: row.name,
            expected_revision: row.revision,
            payload: row.payload,
        }) {
            emit(&row.workspace_id, &row.id, "session", row.revision);
        }
    }
}
fn save_frame(
    db: &Database,
    input: &StreamInput,
    direction: &str,
    message: &Message,
    emit: &Emit,
) -> ApiResult<()> {
    let (kind, data) = match message {
        Message::Text(text) => ("text", text.to_string()),
        Message::Binary(bytes) => ("binary", STANDARD.encode(bytes)),
        Message::Ping(bytes) => ("ping", STANDARD.encode(bytes)),
        Message::Pong(bytes) => ("pong", STANDARD.encode(bytes)),
        _ => return Ok(()),
    };
    let row=db.save(SaveEntity{workspace_id:input.workspace_id.clone(),id:uuid::Uuid::new_v4().to_string(),kind:"flow".into(),name:"WebSocket frame".into(),expected_revision:0,payload:json!({"source":"native_protocol","type":"ws_frame","sessionId":input.id,"url":input.url,"direction":direction,"kind":kind,"data":data,"timestamp":now()})})?;
    emit(&row.workspace_id, &row.id, "flow", row.revision);
    Ok(())
}
#[derive(Default)]
pub struct SseParser {
    buffer: Vec<u8>,
    data: Vec<String>,
    event: String,
    id: String,
    retry: Option<u64>,
    size: usize,
}
impl SseParser {
    pub fn push(&mut self, bytes: &[u8]) -> ApiResult<Vec<Value>> {
        let mut output = Vec::new();
        for byte in bytes {
            self.buffer.push(*byte);
            if self.buffer.len() > 65536 {
                return Err(ApiError::new("quota", "SSE line exceeds 64 KiB"));
            }
            if *byte != b'\n' {
                continue;
            }
            let mut line = std::mem::take(&mut self.buffer);
            line.pop();
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            let text = std::str::from_utf8(&line)
                .map_err(|_| ApiError::new("validation", "SSE contained invalid UTF8"))?;
            if text.is_empty() {
                if !self.data.is_empty() {
                    output.push(json!({"data":self.data.join("\n"),"event":if self.event.is_empty(){"message"}else{&self.event},"id":self.id,"retry":self.retry}));
                }
                self.data.clear();
                self.event.clear();
                self.size = 0;
                continue;
            }
            if text.starts_with(':') {
                continue;
            }
            let (field, value) = text.split_once(':').unwrap_or((text, ""));
            let value = value.strip_prefix(' ').unwrap_or(value);
            self.size += text.len();
            if self.size > 65536 {
                return Err(ApiError::new("quota", "SSE event exceeds 64 KiB"));
            }
            match field {
                "data" => self.data.push(value.into()),
                "event" => self.event = value.into(),
                "id" if !value.contains('\0') => self.id = value.into(),
                "retry" if value.bytes().all(|b| b.is_ascii_digit()) => {
                    self.retry = value.parse().ok()
                }
                _ => {}
            }
        }
        Ok(output)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sse_split_utf8_and_multiline() {
        let mut parser = SseParser::default();
        assert!(parser
            .push(b"id: 12\r\ndata: one\r\ndata: ")
            .unwrap()
            .is_empty());
        let mut tail = "hai 🐱\r\nretry: 42\r\n\r\n".as_bytes().to_vec();
        let end = tail.split_off(7);
        assert!(parser.push(&tail).unwrap().is_empty());
        let events = parser.push(&end).unwrap();
        assert_eq!(events[0]["data"], "one\nhai 🐱");
        assert_eq!(events[0]["id"], "12");
        assert_eq!(events[0]["retry"], 42);
    }
}
