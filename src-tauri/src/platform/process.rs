#[cfg(windows)]
pub fn stamp(pid:u32)->Option<u64>{
    use windows_sys::Win32::{Foundation::{CloseHandle,FILETIME},System::Threading::{OpenProcess,GetProcessTimes,PROCESS_QUERY_LIMITED_INFORMATION}};
    unsafe {let handle=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,0,pid);if handle.is_null(){return None;}
    let mut create=FILETIME{dwLowDateTime:0,dwHighDateTime:0};let mut exit=create;let mut kernel=create;let mut user=create;
    let ok=GetProcessTimes(handle,&mut create,&mut exit,&mut kernel,&mut user);CloseHandle(handle);
    if ok==0{None}else{Some(((create.dwHighDateTime as u64)<<32)|create.dwLowDateTime as u64)}}
}
#[cfg(windows)]
pub fn owner_dead(pid:u32,created:u64)->bool{
    use windows_sys::Win32::{Foundation::{CloseHandle,GetLastError},System::Threading::{OpenProcess,GetExitCodeProcess,PROCESS_QUERY_LIMITED_INFORMATION}};
    unsafe {let handle=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,0,pid);if handle.is_null(){return GetLastError()==87;}
    let mut code=0;let ok=GetExitCodeProcess(handle,&mut code);CloseHandle(handle);
    if ok==0{return false;}if code!=259{return true;}stamp(pid).is_some_and(|value|value!=created)}
}
#[cfg(not(windows))] pub fn stamp(_:u32)->Option<u64>{None}
#[cfg(not(windows))] pub fn owner_dead(_:u32,_:u64)->bool{false}
