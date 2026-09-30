use crate::{domain::*, storage::Database};
use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize, Clone, PartialEq)]
struct Raw {
    kind: u32,
    bytes: Vec<u8>,
}
#[derive(Serialize, Deserialize, Clone, PartialEq)]
struct Snapshot {
    enable: Option<Raw>,
    server: Option<Raw>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Ledger {
    id: String,
    before: Snapshot,
    applied: Snapshot,
    state: String,
    owner_pid: u32,
    owner_stamp: Option<u64>,
    updated_at: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryState {
    pub id: Option<String>,
    pub state: String,
    pub message: String,
    pub updated_at: Option<i64>,
}
impl Database {
    pub fn proxy_recovery(&self) -> ApiResult<RecoveryState> {
        use rusqlite::OptionalExtension;
        let record: Option<String> = self
            .lock()?
            .query_row(
                "SELECT payload FROM device_settings WHERE key='windows_manual_proxy'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        match record {
            None => Ok(RecoveryState {
                id: None,
                state: "none".into(),
                message: "No app-owned manual proxy backup. Capture engine is not connected."
                    .into(),
                updated_at: None,
            }),
            Some(value) => {
                let ledger: Ledger = serde_json::from_str(&value)?;
                Ok(RecoveryState{id:Some(ledger.id),state:ledger.state,message:"A manual WinINet change has a durable backup. Restore checks for external edits; PAC/autodiscovery/WinHTTP are separate. Capture is not implied.".into(),updated_at:Some(ledger.updated_at)})
            }
        }
    }
}
#[cfg(windows)]
mod windows {
    use super::*;
    use rusqlite::OptionalExtension;
    use windows_sys::Win32::Networking::WinInet::*;
    use winreg::{enums::*, RegKey, RegValue};
    fn key() -> ApiResult<RegKey> {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(
                "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                KEY_READ | KEY_SET_VALUE,
            )
            .map_err(|_| {
                ApiError::new(
                    "permission",
                    "Current-user manual proxy settings cannot be opened.",
                )
            })
    }
    fn raw(key: &RegKey, name: &str) -> ApiResult<Option<Raw>> {
        match key.get_raw_value(name) {
            Ok(value) => {
                if value.bytes.len() > 65536
                    || ![REG_SZ, REG_EXPAND_SZ, REG_DWORD].contains(&value.vtype)
                {
                    return Err(ApiError::new(
                        "validation",
                        "Unsupported Windows proxy value type/size. Inspect it manually.",
                    ));
                }
                Ok(Some(Raw {
                    kind: value.vtype as u32,
                    bytes: value.bytes,
                }))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err(ApiError::new(
                "permission",
                "Cannot read Windows manual proxy values.",
            )),
        }
    }
    fn snapshot(key: &RegKey) -> ApiResult<Snapshot> {
        Ok(Snapshot {
            enable: raw(key, "ProxyEnable")?,
            server: raw(key, "ProxyServer")?,
        })
    }
    fn write(key: &RegKey, name: &str, value: &Option<Raw>) -> ApiResult<()> {
        match value {
            None => match key.delete_value(name) {
                Ok(()) => Ok(()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(error.into()),
            },
            Some(value) => {
                let kind = match value.kind {
                    1 => REG_SZ,
                    2 => REG_EXPAND_SZ,
                    4 => REG_DWORD,
                    _ => {
                        return Err(ApiError::new(
                            "validation",
                            "Proxy backup value type is unsupported.",
                        ))
                    }
                };
                if value.bytes.len() > 65536 {
                    return Err(ApiError::new(
                        "validation",
                        "Proxy backup value is oversized.",
                    ));
                }
                key.set_raw_value(
                    name,
                    &RegValue {
                        vtype: kind,
                        bytes: value.bytes.clone(),
                    },
                )?;
                Ok(())
            }
        }
    }
    fn flush(key: &RegKey) -> ApiResult<()> {
        if unsafe { windows_sys::Win32::System::Registry::RegFlushKey(key.raw_handle()) } != 0 {
            return Err(ApiError::new(
                "permission",
                "Windows proxy registry flush failed; recovery backup retained.",
            ));
        }
        Ok(())
    }
    fn notify() -> ApiResult<()> {
        let ok = unsafe {
            InternetSetOptionW(
                std::ptr::null(),
                INTERNET_OPTION_SETTINGS_CHANGED,
                std::ptr::null(),
                0,
            ) != 0
                && InternetSetOptionW(
                    std::ptr::null(),
                    INTERNET_OPTION_REFRESH,
                    std::ptr::null(),
                    0,
                ) != 0
        };
        if ok {
            Ok(())
        } else {
            Err(ApiError::new("permission","Manual settings were written but Windows notification could not be confirmed. Use the recovery backup."))
        }
    }
    fn store(connection: &rusqlite::Connection, ledger: &Ledger) -> ApiResult<()> {
        connection.execute(
            "UPDATE device_settings SET payload=?1 WHERE key='windows_manual_proxy'",
            [serde_json::to_string(ledger)?],
        )?;
        Ok(())
    }
    impl Database {
        pub fn proxy_apply(&self, port: u16, acknowledged: bool) -> ApiResult<RecoveryState> {
            if !acknowledged || port == 0 {
                return Err(ApiError::new(
                    "permission",
                    "Confirm manual Windows proxy changes and a valid localhost port.",
                ));
            }
            let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
            std::net::TcpStream::connect_timeout(&address,std::time::Duration::from_secs(1)).map_err(|_|ApiError::new("network","No TCP listener reachable at this localhost port. This does not verify proxy protocol."))?;
            let key = key()?;
            let mut connection = self.lock()?;
            let tx =
                connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
            if tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM device_settings WHERE key='windows_manual_proxy')",
                [],
                |row| row.get::<_, bool>(0),
            )? {
                return Err(ApiError::new(
                    "conflict",
                    "Restore the previous app change before applying another manual endpoint.",
                ));
            }
            let before = snapshot(&key)?;
            let server = format!("127.0.0.1:{port}");
            let bytes = server
                .encode_utf16()
                .chain(std::iter::once(0))
                .flat_map(u16::to_le_bytes)
                .collect();
            let mut ledger = Ledger {
                id: uuid::Uuid::new_v4().to_string(),
                before,
                applied: Snapshot {
                    enable: Some(Raw {
                        kind: REG_DWORD as u32,
                        bytes: 1u32.to_le_bytes().to_vec(),
                    }),
                    server: Some(Raw {
                        kind: REG_SZ as u32,
                        bytes,
                    }),
                },
                state: "applying".into(),
                owner_pid: std::process::id(),
                owner_stamp: crate::platform::process::stamp(std::process::id()),
                updated_at: now(),
            };
            tx.execute(
                "INSERT INTO device_settings(key,payload) VALUES('windows_manual_proxy',?1)",
                [serde_json::to_string(&ledger)?],
            )?;
            tx.commit()?;
            let result = (|| {
                if snapshot(&key)? != ledger.before {
                    return Err(ApiError::new("conflict","Windows proxy changed before apply. External changes were not overwritten."));
                }
                write(&key, "ProxyServer", &ledger.applied.server)?;
                write(&key, "ProxyEnable", &ledger.applied.enable)?;
                flush(&key)?;
                notify()?;
                if snapshot(&key)? != ledger.applied {
                    return Err(ApiError::new(
                        "conflict",
                        "Windows proxy changed during apply. Inspect recovery state.",
                    ));
                }
                Ok(())
            })();
            ledger.state = if result.is_ok() {
                "applied"
            } else {
                "uncertain"
            }
            .into();
            ledger.updated_at = now();
            store(&connection, &ledger)?;
            drop(connection);
            result?;
            self.proxy_recovery()
        }
        pub fn proxy_restore(&self, id: &str, acknowledged: bool) -> ApiResult<RecoveryState> {
            valid_id(id)?;
            if !acknowledged {
                return Err(ApiError::new(
                    "permission",
                    "Confirm restoration of app-owned manual proxy settings.",
                ));
            }
            let key = key()?;
            let mut connection = self.lock()?;
            let tx =
                connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
            let payload: Option<String> = tx
                .query_row(
                    "SELECT payload FROM device_settings WHERE key='windows_manual_proxy'",
                    [],
                    |row| row.get(0),
                )
                .optional()?;
            let mut ledger: Ledger =
                serde_json::from_str(&payload.ok_or_else(|| {
                    ApiError::new("not_found", "No manual proxy backup exists.")
                })?)?;
            if ledger.id != id {
                return Err(ApiError::new(
                    "conflict",
                    "Recovery backup changed. Refresh first.",
                ));
            }
            if ["applying", "restoring"].contains(&ledger.state.as_str())
                && !ledger.owner_stamp.is_some_and(|stamp| {
                    crate::platform::process::owner_dead(ledger.owner_pid, stamp)
                })
            {
                return Err(ApiError::new("busy","The owning process may still be changing proxy settings. Wait or inspect manually."));
            }
            let current = snapshot(&key)?;
            if (current.enable != ledger.applied.enable && current.enable != ledger.before.enable)
                || (current.server != ledger.applied.server
                    && current.server != ledger.before.server)
            {
                return Err(ApiError::new("conflict","Manual proxy has external edits. Automatic restoration refused; preserve these edits and inspect Windows settings."));
            }
            ledger.state = "restoring".into();
            ledger.owner_pid = std::process::id();
            ledger.owner_stamp = crate::platform::process::stamp(std::process::id());
            ledger.updated_at = now();
            store(&tx, &ledger)?;
            tx.commit()?;
            let result = (|| {
                let observed = snapshot(&key)?;
                if observed != current {
                    return Err(ApiError::new(
                        "conflict",
                        "Windows proxy changed before restore.",
                    ));
                }
                write(&key, "ProxyServer", &ledger.before.server)?;
                write(&key, "ProxyEnable", &ledger.before.enable)?;
                flush(&key)?;
                notify()?;
                if snapshot(&key)? != ledger.before {
                    return Err(ApiError::new(
                        "conflict",
                        "Windows proxy changed during restore.",
                    ));
                }
                Ok(())
            })();
            if let Err(error) = result {
                ledger.state = "uncertain".into();
                ledger.updated_at = now();
                store(&connection, &ledger)?;
                return Err(error);
            }
            connection.execute(
                "DELETE FROM device_settings WHERE key='windows_manual_proxy'",
                [],
            )?;
            drop(connection);
            self.proxy_recovery()
        }
    }
}
#[cfg(not(windows))]
impl Database {
    pub fn proxy_apply(&self, _: u16, _: bool) -> ApiResult<RecoveryState> {
        Err(ApiError::new(
            "unsupported",
            "Windows manual proxy control is unavailable.",
        ))
    }
    pub fn proxy_restore(&self, _: &str, _: bool) -> ApiResult<RecoveryState> {
        Err(ApiError::new(
            "unsupported",
            "Windows manual proxy control is unavailable.",
        ))
    }
}
