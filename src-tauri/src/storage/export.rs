use super::*;
#[cfg(windows)]
impl Database {
    pub fn body_export(&self,workspace_id:&str,id:&str)->ApiResult<Option<u64>> {
        use std::{io::{Read,Write},sync::atomic::{AtomicBool,Ordering}};
        static ACTIVE:AtomicBool=AtomicBool::new(false);
        if ACTIVE.swap(true,Ordering::SeqCst){return Err(ApiError::new("busy","Another native export dialog is open."));}
        struct Guard;impl Drop for Guard{fn drop(&mut self){ACTIVE.store(false,Ordering::SeqCst);}}let _guard=Guard;
        valid_id(id)?;
        let (hash,size):(String,i64)={let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;connection.query_row("SELECT sha256,size FROM blobs WHERE workspace_id=?1 AND id=?2",params![workspace_id,id],|row|Ok((row.get(0)?,row.get(1)?)))?};
        if hash.len()!=64||!hash.bytes().all(|byte|byte.is_ascii_hexdigit())||!(0..=1024*1024*1024).contains(&size){return Err(ApiError::new("storage","Invalid body export metadata."));}
        let source=self.root.join("bodies").join(workspace_id).join(&hash);let mut file=std::fs::File::open(source)?;
        let Some(destination)=rfd::FileDialog::new().set_title("Export full body bytes").set_file_name(format!("traffic-studio-body-{id}.bin")).save_file()else{return Ok(None)};
        let parent=destination.parent().ok_or_else(||ApiError::new("validation","Choose a local file destination."))?.canonicalize()?;
        // Do not allow Save As to replace app databases, vaults or body files.
        if parent.starts_with(self.root.canonicalize()?){return Err(ApiError::new("permission","Export outside the app's private data directory."));}
        let mut output=tempfile::NamedTempFile::new_in(&parent)?;let mut buffer=[0u8;65536];let mut count=0u64;let mut digest=Sha256::new();
        loop{let length=file.read(&mut buffer)?;if length==0{break;}count+=length as u64;if count>size as u64{return Err(ApiError::new("storage","Body size changed; export was not committed."));}digest.update(&buffer[..length]);output.write_all(&buffer[..length])?;}
        if count!=size as u64||format!("{:x}",digest.finalize())!=hash{return Err(ApiError::new("storage","Body checksum failed; export was not committed."));}
        output.as_file().sync_all()?;
        output.persist(destination).map_err(|_|ApiError::new("storage","Could not save export. Existing file was not intentionally removed."))?;
        Ok(Some(count))
    }
}
#[cfg(not(windows))]
impl Database {pub fn body_export(&self,_:&str,_:&str)->ApiResult<Option<u64>>{Err(ApiError::new("unsupported","Native body export is implemented for Windows."))}}
