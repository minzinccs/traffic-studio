use crate::{domain::*, storage::Database};
use rusqlite::params;

#[cfg(windows)]
mod dpapi {
    use super::*;
    use std::{ffi::c_void, ptr};
    #[repr(C)]
    struct Blob {
        len: u32,
        data: *mut u8,
    }
    #[link(name = "crypt32")]
    unsafe extern "system" {
        fn CryptProtectData(
            input: *const Blob,
            description: *const u16,
            entropy: *const Blob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const Blob,
            description: *mut *mut u16,
            entropy: *const Blob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LocalFree(value: *mut c_void) -> *mut c_void;
    }
    pub fn transform(bytes: &[u8], workspace_id: &str, protect: bool) -> ApiResult<Vec<u8>> {
        if bytes.len() > if protect { 65536 } else { 131072 } {
            return Err(ApiError::new("validation", "Secret exceeds 64 KiB."));
        }
        let input = Blob {
            len: bytes.len() as u32,
            data: bytes.as_ptr() as *mut u8,
        };
        let entropy = Blob {
            len: workspace_id.len() as u32,
            data: workspace_id.as_ptr() as *mut u8,
        };
        let mut output = Blob {
            len: 0,
            data: ptr::null_mut(),
        };
        // Current Windows user scope, no LOCAL_MACHINE flag, no UI prompt.
        let ok = unsafe {
            if protect {
                CryptProtectData(
                    &input,
                    ptr::null(),
                    &entropy,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    1,
                    &mut output,
                )
            } else {
                CryptUnprotectData(
                    &input,
                    ptr::null_mut(),
                    &entropy,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    1,
                    &mut output,
                )
            }
        };
        if ok == 0 {
            return Err(ApiError::new(
                "permission",
                "Windows credential protection failed for this user/workspace.",
            ));
        }
        let data = unsafe { std::slice::from_raw_parts(output.data, output.len as usize).to_vec() };
        unsafe {
            std::ptr::write_bytes(output.data, 0, output.len as usize);
            LocalFree(output.data as *mut c_void);
        }
        Ok(data)
    }
}
#[cfg(not(windows))]
mod dpapi {
    use super::*;
    pub fn transform(_: &[u8], _: &str, _: bool) -> ApiResult<Vec<u8>> {
        Err(ApiError::new(
            "unsupported",
            "Credential vault is implemented only for Windows. No plaintext fallback is allowed.",
        ))
    }
}
impl Database {
    pub fn secret_put(&self, workspace_id: &str, id: &str, mut value: String) -> ApiResult<()> {
        valid_id(id)?;
        let connection = self.lock()?;
        Self::require_workspace(&connection, workspace_id)?;
        if value.is_empty() {
            return Err(ApiError::new("validation", "Secret cannot be empty."));
        }
        let protected = dpapi::transform(value.as_bytes(), workspace_id, true);
        // Best-effort in-memory cleanup, not a guarantee that every allocator/IPC copy is erased.
        unsafe {
            value.as_bytes_mut().fill(0);
        }
        connection.execute("INSERT INTO secrets(workspace_id,id,protected,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(workspace_id,id) DO UPDATE SET protected=excluded.protected,updated_at=excluded.updated_at",params![workspace_id,id,protected?,now()])?;
        Ok(())
    }
    pub fn secret_get(&self, workspace_id: &str, id: &str) -> ApiResult<String> {
        valid_id(id)?;
        let connection = self.lock()?;
        Self::require_workspace(&connection, workspace_id)?;
        let protected: Vec<u8> = connection.query_row(
            "SELECT protected FROM secrets WHERE workspace_id=?1 AND id=?2",
            params![workspace_id, id],
            |r| r.get(0),
        )?;
        String::from_utf8(dpapi::transform(&protected, workspace_id, false)?)
            .map_err(|_| ApiError::new("storage", "Credential could not be decoded."))
    }
    pub fn secret_delete(&self, workspace_id: &str, id: &str) -> ApiResult<()> {
        valid_id(id)?;
        let connection = self.lock()?;
        Self::require_workspace(&connection, workspace_id)?;
        connection.execute(
            "DELETE FROM secrets WHERE workspace_id=?1 AND id=?2",
            params![workspace_id, id],
        )?;
        Ok(())
    }
}

pub(crate) fn protect_bytes(bytes: &[u8], entropy: &str) -> ApiResult<Vec<u8>> {
    dpapi::transform(bytes, entropy, true)
}
pub(crate) fn unprotect_bytes(bytes: &[u8], entropy: &str) -> ApiResult<Vec<u8>> {
    dpapi::transform(bytes, entropy, false)
}
