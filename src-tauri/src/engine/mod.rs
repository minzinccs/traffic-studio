use crate::domain::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub state: String,
    pub adapter: Option<String>,
    pub message: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    protocol_version: u32,
    adapter: String,
    executable: String,
    sha256: String,
    selection_evidence: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hello {
    protocol_version: u32,
    token: String,
    adapter: String,
}
struct Running {
    child: Child,
    adapter: String,
}
#[derive(Default)]
pub struct Supervisor {
    process: Mutex<Option<Running>>,
}
impl Supervisor {
    pub fn status(&self) -> ApiResult<EngineStatus> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| ApiError::new("runtime", "Engine supervisor unavailable."))?;
        if let Some(running) = process.as_mut() {
            if running.child.try_wait()?.is_some() {
                *process = None;
                return Ok(EngineStatus {
                    state: "error".into(),
                    adapter: None,
                    message: "Sidecar exited. Capture was not restarted automatically.".into(),
                });
            }
            return Ok(EngineStatus {
                state: "ready".into(),
                adapter: Some(running.adapter.clone()),
                message: "Sidecar authenticated; listener has not been started by this command."
                    .into(),
            });
        }
        Ok(EngineStatus {
            state: "unconfigured".into(),
            adapter: None,
            message: "No selected/bundled core. Benchmark selection remains pending.".into(),
        })
    }
    pub fn start(&self, resources: &Path) -> ApiResult<EngineStatus> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| ApiError::new("runtime", "Engine supervisor unavailable."))?;
        if process.is_some() {
            return Err(ApiError::new(
                "conflict",
                "Sidecar is already running. Stop before changing it.",
            ));
        }
        let root = resources.canonicalize()?;
        let manifest:Manifest=serde_json::from_slice(&std::fs::read(root.join("engine-manifest.json")).map_err(|_|ApiError::new("unsupported","Selected engine manifest is not packaged. Complete the core-selection gate first."))?)?;
        if manifest.protocol_version != 1
            || !["whistle", "mitmproxy"].contains(&manifest.adapter.as_str())
            || manifest.selection_evidence.trim().is_empty()
            || manifest.sha256.len() != 64
        {
            return Err(ApiError::new(
                "validation",
                "Engine manifest must record selection evidence, protocol and checksum.",
            ));
        }
        let executable = root.join(&manifest.executable).canonicalize()?;
        if !executable.starts_with(&root) || !executable.is_file() {
            return Err(ApiError::new(
                "permission",
                "Sidecar executable must remain inside packaged resources.",
            ));
        }
        let mut file = std::fs::File::open(&executable)?;
        let mut digest = Sha256::new();
        let mut buffer = [0u8; 65536];
        loop {
            let count = file.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            digest.update(&buffer[..count]);
        }
        if format!("{:x}", digest.finalize()) != manifest.sha256.to_lowercase() {
            return Err(ApiError::new(
                "permission",
                "Sidecar checksum does not match the packaged manifest.",
            ));
        }
        let token = uuid::Uuid::new_v4().to_string();
        let mut command = Command::new(executable);
        command
            .env("TRAFFIC_STUDIO_IPC_TOKEN", &token)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn()?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ApiError::new("runtime", "Sidecar stdout unavailable."))?;
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            let hello = std::io::Read::by_ref(&mut reader)
                .take(65537)
                .read_line(&mut line)
                .map(|_| line);
            let _ = sender.send(hello);
            let mut sink = [0u8; 8192];
            while reader.read(&mut sink).unwrap_or(0) > 0 {}
        });
        let handshake = receiver
            .recv_timeout(Duration::from_secs(5))
            .ok()
            .and_then(Result::ok)
            .and_then(|line| {
                if line.len() > 65536 {
                    None
                } else {
                    serde_json::from_str::<Hello>(&line).ok()
                }
            });
        if !handshake.is_some_and(|hello| {
            hello.protocol_version == 1 && hello.token == token && hello.adapter == manifest.adapter
        }) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(ApiError::new(
                "runtime",
                "Sidecar handshake failed or timed out. No listener was enabled.",
            ));
        }
        *process = Some(Running {
            child,
            adapter: manifest.adapter.clone(),
        });
        Ok(EngineStatus {
            state: "ready".into(),
            adapter: Some(manifest.adapter),
            message:
                "Authenticated sidecar ready. Capture and HTTP commands are not connected yet."
                    .into(),
        })
    }
    pub fn stop(&self) -> ApiResult<()> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| ApiError::new("runtime", "Engine supervisor unavailable."))?;
        if let Some(mut running) = process.take() {
            if let Some(stdin) = running.child.stdin.as_mut() {
                let _ = stdin.write_all(b"{\"command\":\"shutdown\"}\n");
            }
            let _ = running.child.kill();
            let _ = running.child.wait();
        }
        Ok(())
    }
}
impl Drop for Supervisor {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
