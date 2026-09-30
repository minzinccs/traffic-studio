use crate::{domain::*, storage::Database};
use rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName, DnType, IsCa, KeyPair, KeyUsagePurpose,
};
use rusqlite::params;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CertificateInfo {
    pub id: String,
    pub fingerprint: String,
    pub pem: String,
    pub created_at: i64,
    pub expires_at: i64,
    pub trusted_current_user: bool,
    pub capture_attached: bool,
    pub installed_by_app: bool,
    pub operation: String,
}
impl Database {
    pub fn certificate_list(&self) -> ApiResult<Vec<CertificateInfo>> {
        let connection = self.lock()?;
        let mut statement=connection.prepare("SELECT id,fingerprint,pem,created_at,expires_at,der,installed_by_app,operation FROM device_certificates ORDER BY created_at DESC")?;
        let rows = statement.query_map([], |r| {
            Ok((
                CertificateInfo {
                    id: r.get(0)?,
                    fingerprint: r.get(1)?,
                    pem: r.get(2)?,
                    created_at: r.get(3)?,
                    expires_at: r.get(4)?,
                    trusted_current_user: false,
                    capture_attached: false,
                    installed_by_app: r.get(6)?,
                    operation: r.get(7)?,
                },
                r.get::<_, Vec<u8>>(5)?,
            ))
        })?;
        let records = rows.collect::<Result<Vec<_>, _>>()?;
        records
            .into_iter()
            .map(|(mut info, der)| {
                info.trusted_current_user = trusted(&der)?;
                Ok(info)
            })
            .collect()
    }
    pub fn certificate_create(&self) -> ApiResult<CertificateInfo> {
        // Serialize generation across windows with a SQLite write transaction.
        let mut connection = self.lock()?;
        let tx = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let count: i64 =
            tx.query_row("SELECT count(*) FROM device_certificates", [], |r| r.get(0))?;
        if count >= 8 {
            return Err(ApiError::new(
                "validation",
                "Eight local CAs already exist. Reuse an existing CA.",
            ));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let created = time::OffsetDateTime::now_utc();
        let expires = created + time::Duration::days(365);
        let mut options = CertificateParams::default();
        options.not_before = created - time::Duration::minutes(5);
        options.not_after = expires;
        options.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
        options.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, format!("Traffic Studio Local CA {id}"));
        options.distinguished_name = dn;
        let key = KeyPair::generate()
            .map_err(|_| ApiError::new("certificate", "Could not generate local signing key."))?;
        let cert = options
            .self_signed(&key)
            .map_err(|_| ApiError::new("certificate", "Could not generate local CA."))?;
        let mut private_pem = key.serialize_pem();
        let protected = crate::platform::secrets::protect_bytes(private_pem.as_bytes(), &id);
        // Best effort: rcgen and allocator may retain other in-memory copies.
        unsafe {
            private_pem.as_bytes_mut().fill(0);
        }
        let protected = protected?;
        let der = cert.der().as_ref();
        let fingerprint = format!("{:x}", Sha256::digest(der));
        let pem = cert.pem();
        let created_at = (created.unix_timestamp_nanos() / 1_000_000) as i64;
        let expires_at = (expires.unix_timestamp_nanos() / 1_000_000) as i64;
        tx.execute("INSERT INTO device_certificates(id,fingerprint,pem,der,protected_key,created_at,expires_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![id,fingerprint,pem,der,protected,created_at,expires_at])?;
        tx.commit()?;
        Ok(CertificateInfo {
            id,
            fingerprint,
            pem,
            created_at,
            expires_at,
            trusted_current_user: false,
            capture_attached: false,
            installed_by_app: false,
            operation: "idle".into(),
        })
    }
    pub fn certificate_trust(
        &self,
        id: &str,
        fingerprint: &str,
        acknowledged: bool,
        install: bool,
    ) -> ApiResult<()> {
        valid_id(id)?;
        if !acknowledged {
            return Err(ApiError::new(
                "permission",
                "Explicit acknowledgement of Windows trust changes is required.",
            ));
        }
        let mut connection = self.lock()?;
        let tx = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let (stored,der,owned,operation,expires):(String,Vec<u8>,bool,String,i64)=tx.query_row("SELECT fingerprint,der,installed_by_app,operation,expires_at FROM device_certificates WHERE id=?1",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?)))?;
        if fingerprint != stored {
            return Err(ApiError::new(
                "conflict",
                "CA fingerprint changed. Refresh before modifying trust.",
            ));
        }
        if operation != "idle" {
            return Err(ApiError::new("conflict","An unfinished CA trust operation needs manual fingerprint inspection in Windows certificate manager. Automatic removal is disabled."));
        }
        if install {
            if expires <= now() {
                return Err(ApiError::new("validation", "Cannot install an expired CA."));
            }
            // A certificate installed by someone else must not become app-owned.
            if trusted(&der)? {
                return Ok(());
            }
        } else if !owned {
            return Err(ApiError::new(
                "permission",
                "App removal is limited to a CA installed by this app.",
            ));
        }
        tx.execute(
            "UPDATE device_certificates SET operation=?2 WHERE id=?1",
            params![id, if install { "installing" } else { "removing" }],
        )?;
        tx.commit()?;
        // Intent is durable before the OS mutation. A crash leaves an explicit
        // unresolved operation instead of claiming success or adopting a root.
        let result = change_trust(&der, install);
        match result {
            Ok(()) => {
                connection.execute("UPDATE device_certificates SET installed_by_app=?2,operation='idle' WHERE id=?1",params![id,install])?;
                Ok(())
            }
            Err(error) => {
                connection.execute(
                    "UPDATE device_certificates SET operation='uncertain' WHERE id=?1",
                    [id],
                )?;
                Err(error)
            }
        }
    }
}

#[cfg(windows)]
fn change_trust(der: &[u8], install: bool) -> ApiResult<()> {
    use windows_sys::Win32::Security::Cryptography::*;
    let root: Vec<u16> = "Root\0".encode_utf16().collect();
    unsafe {
        let store = CertOpenStore(
            CERT_STORE_PROV_SYSTEM_REGISTRY_W,
            0,
            0,
            CERT_SYSTEM_STORE_CURRENT_USER | CERT_STORE_OPEN_EXISTING_FLAG,
            root.as_ptr().cast(),
        );
        if store.is_null() {
            return Err(ApiError::new(
                "permission",
                "Cannot open the current user's physical Root store for writing.",
            ));
        }
        let ok = if install {
            CertAddEncodedCertificateToStore(
                store,
                X509_ASN_ENCODING,
                der.as_ptr(),
                der.len() as u32,
                CERT_STORE_ADD_NEW,
                std::ptr::null_mut(),
            ) != 0
        } else {
            let mut context = CertEnumCertificatesInStore(store, std::ptr::null());
            let mut removed = true;
            while !context.is_null() {
                let bytes = std::slice::from_raw_parts(
                    (*context).pbCertEncoded,
                    (*context).cbCertEncoded as usize,
                );
                if bytes == der {
                    removed = CertDeleteCertificateFromStore(context) != 0;
                    break;
                }
                context = CertEnumCertificatesInStore(store, context);
            }
            if context.is_null() && windows_sys::Win32::Foundation::GetLastError() != 0x80092004 {
                removed = false;
            }
            removed
        };
        CertCloseStore(store, 0);
        if ok {
            Ok(())
        } else {
            Err(ApiError::new("certificate","Windows trust change could not be confirmed. Inspect the displayed fingerprint manually before retrying."))
        }
    }
}
#[cfg(not(windows))]
fn change_trust(_: &[u8], _: bool) -> ApiResult<()> {
    Err(ApiError::new(
        "unsupported",
        "Trust management is Windows-only.",
    ))
}

#[cfg(windows)]
fn trusted(der: &[u8]) -> ApiResult<bool> {
    use windows_sys::Win32::Security::Cryptography::*;
    // Physical HKCU store only; logical Root would merge machine policy roots.
    let root: Vec<u16> = "Root\0".encode_utf16().collect();
    unsafe {
        let store = CertOpenStore(
            CERT_STORE_PROV_SYSTEM_REGISTRY_W,
            0,
            0,
            CERT_SYSTEM_STORE_CURRENT_USER
                | CERT_STORE_READONLY_FLAG
                | CERT_STORE_OPEN_EXISTING_FLAG,
            root.as_ptr().cast(),
        );
        if store.is_null() {
            return Err(ApiError::new(
                "certificate",
                "Cannot read the current Windows user's Root store.",
            ));
        }
        let mut context = CertEnumCertificatesInStore(store, std::ptr::null());
        let mut found = false;
        while !context.is_null() {
            let bytes = std::slice::from_raw_parts(
                (*context).pbCertEncoded,
                (*context).cbCertEncoded as usize,
            );
            if bytes == der {
                found = true;
                CertFreeCertificateContext(context);
                break;
            }
            context = CertEnumCertificatesInStore(store, context);
        }
        let enumeration_failed =
            !found && windows_sys::Win32::Foundation::GetLastError() != 0x80092004;
        CertCloseStore(store, 0);
        if enumeration_failed {
            Err(ApiError::new(
                "certificate",
                "Windows root enumeration failed; trust status is unknown.",
            ))
        } else {
            Ok(found)
        }
    }
}
#[cfg(not(windows))]
fn trusted(_: &[u8]) -> ApiResult<bool> {
    Err(ApiError::new(
        "unsupported",
        "Windows certificate store is unavailable on this platform.",
    ))
}
