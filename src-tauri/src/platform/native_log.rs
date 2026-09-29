use serde::{Deserialize, Serialize};
use std::{fs, io, path::{Path, PathBuf}, sync::{Mutex, OnceLock}, time::{SystemTime, UNIX_EPOCH}};

const MAX_ENTRIES: usize = 200;
const MAX_FILE_BYTES: u64 = 128 * 1024;
const MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000;
static PATH: OnceLock<PathBuf> = OnceLock::new();
static LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeLogEntry {
    pub id: String,
    pub time: u64,
    pub source: String,
    pub action: String,
    pub code: String,
    pub count: u32,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

fn path(root: &Path) -> PathBuf { root.join("diagnostic-errors.json") }
fn valid(entry: &NativeLogEntry, now: u64) -> bool {
    entry.source == "native" && entry.id.len() <= 48 && entry.time <= now.saturating_add(60_000)
        && entry.time >= now.saturating_sub(MAX_AGE_MS) && entry.count > 0 && entry.count <= 1_000_000
        && matches!(entry.action.as_str(), "startup" | "capture_worker" | "native_panic")
        && matches!(entry.code.as_str(), "storage" | "runtime" | "stopped_unexpectedly")
}

fn read_at(root: &Path) -> Vec<NativeLogEntry> {
    let file = path(root);
    if fs::metadata(&file).is_ok_and(|meta| meta.len() > MAX_FILE_BYTES) { return Vec::new(); }
    let Ok(bytes) = fs::read(file) else { return Vec::new() };
    let Ok(rows) = serde_json::from_slice::<Vec<NativeLogEntry>>(&bytes) else { return Vec::new() };
    let now = now_ms();
    rows.into_iter().filter(|row| valid(row, now)).rev().take(MAX_ENTRIES).collect::<Vec<_>>().into_iter().rev().collect()
}

fn write_at(root: &Path, rows: &[NativeLogEntry]) -> io::Result<()> {
    fs::create_dir_all(root)?;
    let serialized = serde_json::to_vec(rows)?;
    fs::write(path(root), serialized)
}

pub fn initialize(root: &Path) {
    if PATH.set(root.to_path_buf()).is_ok() {
        let old_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            record("native_panic", "runtime");
            old_hook(info);
        }));
    }
}

pub fn record(action: &'static str, code: &'static str) {
    let Some(root) = PATH.get() else { return };
    let Ok(_guard) = LOCK.try_lock() else { return };
    let now = now_ms();
    let mut rows = read_at(root);
    if let Some(last) = rows.last_mut().filter(|last| last.action == action && last.code == code && now.saturating_sub(last.time) < 60_000) {
        last.time = now;
        last.count = last.count.saturating_add(1).min(1_000_000);
    } else {
        let row = NativeLogEntry { id: uuid::Uuid::new_v4().to_string(), time: now, source: "native".into(), action: action.into(), code: code.into(), count: 1 };
        if !valid(&row, now) { return; }
        rows.push(row);
        if rows.len() > MAX_ENTRIES { rows.remove(0); }
    }
    let _ = write_at(root, &rows);
}

pub fn read() -> Vec<NativeLogEntry> {
    let Some(root) = PATH.get() else { return Vec::new() };
    let Ok(_guard) = LOCK.lock() else { return Vec::new() };
    read_at(root)
}

pub fn clear() -> io::Result<()> {
    let Some(root) = PATH.get() else { return Ok(()) };
    let _guard = LOCK.lock().map_err(|_| io::Error::other("Diagnostic log unavailable"))?;
    write_at(root, &[])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_and_oversized_logs() {
        let temp = tempfile::tempdir().unwrap();
        let now = now_ms();
        let row = NativeLogEntry { id: "safe".into(), time: now, source: "native".into(), action: "startup".into(), code: "storage".into(), count: 1 };
        write_at(temp.path(), &[row.clone()]).unwrap();
        assert_eq!(read_at(temp.path()).len(), 1);
        let mut private = row;
        private.action = "https://private.invalid/token".into();
        write_at(temp.path(), &[private]).unwrap();
        assert!(read_at(temp.path()).is_empty());
        fs::write(path(temp.path()), vec![b'x'; MAX_FILE_BYTES as usize + 1]).unwrap();
        assert!(read_at(temp.path()).is_empty());
    }
}
