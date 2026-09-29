use crate::domain::*;
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct WindowsProxyState {pub scope:String,pub enabled:bool,pub server:Option<String>,pub bypass:Option<String>,pub pac_url:Option<String>,pub observed_at:i64,pub message:String}
#[cfg(windows)]
pub fn read()->ApiResult<WindowsProxyState> {
    use winreg::{RegKey,enums::{HKEY_CURRENT_USER,KEY_READ}};
    let key=RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",KEY_READ).map_err(|_|ApiError::new("permission","Current-user Windows Internet Settings cannot be read."))?;
    fn text(key:&RegKey,name:&str)->ApiResult<Option<String>> {match key.get_value::<String,_>(name){Ok(value)=>Ok(Some(value)),Err(error) if error.kind()==std::io::ErrorKind::NotFound=>Ok(None),Err(_)=>Err(ApiError::new("permission","Windows proxy setting cannot be read."))}}
    let enabled=match key.get_value::<u32,_>("ProxyEnable"){Ok(value)=>value!=0,Err(error) if error.kind()==std::io::ErrorKind::NotFound=>false,Err(_)=>return Err(ApiError::new("permission","Windows proxy enable state cannot be read."))};
    Ok(WindowsProxyState{scope:"current-user WinINet".into(),enabled,server:text(&key,"ProxyServer")?,bypass:text(&key,"ProxyOverride")?,pac_url:text(&key,"AutoConfigURL")?,observed_at:now(),message:"Read-only observation. WinHTTP, environment proxies, per-process overrides and automatic discovery are separate; this does not confirm Traffic Studio capture.".into()})
}
#[cfg(not(windows))]
pub fn read()->ApiResult<WindowsProxyState>{Err(ApiError::new("unsupported","Windows proxy observation is available only on Windows."))}
