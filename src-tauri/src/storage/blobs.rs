use super::Database;
use crate::domain::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Serialize,Deserialize};
use sha2::{Digest,Sha256};
use rusqlite::params;
use std::{fs::{File,OpenOptions},io::{Read,Write,Seek,SeekFrom},path::PathBuf};
const CHUNK:usize=256*1024;
const MAX_SIZE:u64=1024*1024*1024;
pub struct Upload { workspace_id:String, path:PathBuf, file:File, digest:Sha256, size:u64, expected_size:u64, mime_type:String }
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct BodyRef {pub workspace_id:String,pub id:String,pub sha256:String,pub size:u64,pub mime_type:String}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct BodyChunk {pub data:String,pub offset:u64,pub next_offset:u64,pub eof:bool}
impl Database {
    pub fn body_begin(&self,workspace_id:&str,size:u64,mime_type:&str)->ApiResult<String> {
        if size>MAX_SIZE || mime_type.len()>160 || (mime_type.contains('\r') || mime_type.contains('\n')) {return Err(ApiError::new("validation","Body size or MIME type exceeds allowed limits."));}
        { let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?; }
        let mut uploads=self.uploads.lock().map_err(|_|ApiError::new("storage","Body upload worker unavailable."))?;
        if uploads.len()>=4 {return Err(ApiError::new("busy","Four body uploads are already active. Finish or cancel one."));}
        let id=uuid::Uuid::new_v4().to_string();let path=self.root.join("staging").join(format!("{id}.partial"));
        let file=OpenOptions::new().write(true).create_new(true).open(&path)?;
        uploads.insert(id.clone(),Upload{workspace_id:workspace_id.into(),path,file,digest:Sha256::new(),size:0,expected_size:size,mime_type:mime_type.into()});Ok(id)
    }
    pub fn body_append(&self,workspace_id:&str,id:&str,offset:u64,data:&str)->ApiResult<u64> {
        valid_id(workspace_id)?;valid_id(id)?;
        if data.len()>CHUNK*4/3+8 {return Err(ApiError::new("validation","Chunk exceeds 256 KiB."));}
        let bytes=STANDARD.decode(data).map_err(|_|ApiError::new("validation","Invalid Base64 body chunk."))?;
        if bytes.len()>CHUNK || bytes.is_empty() {return Err(ApiError::new("validation","Expected a nonempty chunk up to 256 KiB."));}
        let mut uploads=self.uploads.lock().map_err(|_|ApiError::new("storage","Body upload worker unavailable."))?;
        let upload=uploads.get_mut(id).filter(|u|u.workspace_id==workspace_id).ok_or_else(||ApiError::new("not_found","Upload not found in this workspace."))?;
        if upload.size!=offset || upload.size+bytes.len() as u64>upload.expected_size {return Err(ApiError::new("conflict","Chunk offset or body size does not match the upload."));}
        // If write_all fails, do not permit retry over partially written bytes.
        if let Err(error)=upload.file.write_all(&bytes) {drop(uploads);let _=self.body_cancel(workspace_id,id);return Err(error.into());}
        upload.digest.update(&bytes);upload.size+=bytes.len() as u64;Ok(upload.size)
    }
    pub fn body_finish(&self,workspace_id:&str,id:&str)->ApiResult<BodyRef> {
        valid_id(workspace_id)?;valid_id(id)?;
        let mut uploads=self.uploads.lock().map_err(|_|ApiError::new("storage","Body upload worker unavailable."))?;
        let upload=uploads.get(id).filter(|u|u.workspace_id==workspace_id).ok_or_else(||ApiError::new("not_found","Upload not found in this workspace."))?;
        if upload.size!=upload.expected_size {return Err(ApiError::new("validation","Body is incomplete. Append remaining chunks or cancel."));}
        upload.file.sync_all()?;
        let upload=uploads.remove(id).ok_or_else(||ApiError::new("not_found","Upload disappeared."))?;drop(uploads);
        let _content=crate::platform::content_lock::ContentLock::enter(&self.root)?;let digest=format!("{:x}",upload.digest.finalize());let dir=self.root.join("bodies").join(workspace_id);std::fs::create_dir_all(&dir)?;
        let destination=dir.join(&digest);drop(upload.file);
        if destination.exists() {std::fs::remove_file(&upload.path)?;} else {std::fs::rename(&upload.path,&destination)?;}
        // An interrupted DB commit leaves only an orphan body file, never a committed truncated body.
        let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
        connection.execute("INSERT INTO blobs(workspace_id,id,sha256,size,mime_type,created_at) VALUES(?1,?2,?3,?4,?5,?6)",params![workspace_id,id,digest,upload.size as i64,upload.mime_type,now()])?;
        Ok(BodyRef{workspace_id:workspace_id.into(),id:id.into(),sha256:digest,size:upload.size,mime_type:upload.mime_type})
    }
    pub fn body_cancel(&self,workspace_id:&str,id:&str)->ApiResult<()> {
        valid_id(workspace_id)?;valid_id(id)?;
        let mut uploads=self.uploads.lock().map_err(|_|ApiError::new("storage","Body upload worker unavailable."))?;
        if uploads.get(id).is_some_and(|u|u.workspace_id!=workspace_id) {return Err(ApiError::new("permission","Upload belongs to another workspace."));}
        if let Some(upload)=uploads.remove(id) {drop(upload.file);std::fs::remove_file(upload.path)?;}Ok(())
    }
    pub fn body_read(&self,workspace_id:&str,id:&str,offset:u64,length:u32)->ApiResult<BodyChunk> {
        valid_id(id)?;
        let connection=self.lock()?;Self::require_workspace(&connection,workspace_id)?;
        let (hash,stored_size):(String,i64)=connection.query_row("SELECT sha256,size FROM blobs WHERE workspace_id=?1 AND id=?2",params![workspace_id,id],|r|Ok((r.get(0)?,r.get(1)?)))?;drop(connection);
        let size=u64::try_from(stored_size).map_err(|_|ApiError::new("storage","Invalid stored body size."))?;
        if offset>size || hash.len()!=64 || !hash.chars().all(|c|c.is_ascii_hexdigit()) {return Err(ApiError::new("validation","Invalid body offset or metadata."));}
        let mut file=File::open(self.root.join("bodies").join(workspace_id).join(hash))?;file.seek(SeekFrom::Start(offset))?;
        let count=(size-offset).min(length.clamp(1,CHUNK as u32) as u64) as usize;let mut data=vec![0;count];file.read_exact(&mut data)?;
        Ok(BodyChunk{data:STANDARD.encode(&data),offset,next_offset:offset+count as u64,eof:offset+count as u64==size})
    }
}
