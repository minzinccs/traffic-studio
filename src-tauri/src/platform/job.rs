use crate::domain::*;
#[cfg(windows)]
pub struct ChildJob(usize);
#[cfg(windows)]
impl ChildJob {
    pub fn attach(child: &std::process::Child) -> ApiResult<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err(ApiError::new(
                    "runtime",
                    "Cannot create child process cleanup job",
                ));
            }
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&limits) as u32,
            ) == 0
                || AssignProcessToJobObject(handle, child.as_raw_handle().cast()) == 0
            {
                CloseHandle(handle);
                return Err(ApiError::new(
                    "runtime",
                    "Cannot bind child process cleanup job",
                ));
            }
            Ok(Self(handle as usize))
        }
    }
}
#[cfg(windows)]
impl Drop for ChildJob {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0 as _);
        }
    }
}
#[cfg(not(windows))]
pub struct ChildJob;
#[cfg(not(windows))]
impl ChildJob {
    pub fn attach(_: &std::process::Child) -> ApiResult<Self> {
        Err(ApiError::new(
            "unsupported",
            "Child process cleanup adapter is Windows-only",
        ))
    }
}
