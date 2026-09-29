use crate::domain::*;
#[cfg(windows)]pub struct ContentLock {handle:usize,_thread:std::marker::PhantomData<std::rc::Rc<()>>}
#[cfg(windows)]impl ContentLock{
 pub fn enter(root:&std::path::Path)->ApiResult<Self>{use sha2::{Digest,Sha256};use windows_sys::Win32::{Foundation::{CloseHandle,WAIT_OBJECT_0,WAIT_ABANDONED},System::Threading::*};let identity=format!("Local\\TrafficStudioContent-{:x}",Sha256::digest(root.canonicalize()?.to_string_lossy().to_lowercase().as_bytes()));let name=identity.encode_utf16().chain(Some(0)).collect::<Vec<_>>();unsafe{let handle=CreateMutexW(std::ptr::null(),0,name.as_ptr());if handle.is_null(){return Err(ApiError::new("runtime","Content store lock unavailable"));}let result=WaitForSingleObject(handle,5000);if result!=WAIT_OBJECT_0&&result!=WAIT_ABANDONED{CloseHandle(handle);return Err(ApiError::new("busy","Content store is busy in another window. Retry after the operation finishes."));}Ok(Self{handle:handle as usize,_thread:std::marker::PhantomData})}}
}
#[cfg(windows)]impl Drop for ContentLock{fn drop(&mut self){unsafe{windows_sys::Win32::System::Threading::ReleaseMutex(self.handle as _);windows_sys::Win32::Foundation::CloseHandle(self.handle as _);}}}
#[cfg(not(windows))]pub struct ContentLock;
#[cfg(not(windows))]impl ContentLock{pub fn enter(_: &std::path::Path)->ApiResult<Self>{Err(ApiError::new("unsupported","Cross-process content store lock is Windows-only"))}}
