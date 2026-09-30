use serde::Serialize;
use std::{sync::OnceLock, time::Instant};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnostics {
    pub host_working_set_bytes: Option<u64>,
    pub uptime_seconds: u64,
}

pub fn snapshot() -> RuntimeDiagnostics {
    static START: OnceLock<Instant> = OnceLock::new();
    RuntimeDiagnostics {
        host_working_set_bytes: host_working_set(),
        uptime_seconds: START.get_or_init(Instant::now).elapsed().as_secs(),
    }
}

#[cfg(windows)]
fn host_working_set() -> Option<u64> {
    use windows_sys::Win32::System::{
        ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS},
        Threading::GetCurrentProcess,
    };
    let mut counters = PROCESS_MEMORY_COUNTERS::default();
    counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
    let ok = unsafe { K32GetProcessMemoryInfo(GetCurrentProcess(), &mut counters, counters.cb) };
    (ok != 0).then_some(counters.WorkingSetSize as u64)
}

#[cfg(not(windows))]
fn host_working_set() -> Option<u64> {
    None
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn current_process_has_a_working_set() {
        let result = super::snapshot();
        assert!(result.host_working_set_bytes.is_some_and(|bytes| bytes > 0));
    }
}
