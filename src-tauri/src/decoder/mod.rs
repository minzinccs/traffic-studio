use crate::domain::*;
use rquickjs::{Context,Runtime};
use serde::{Deserialize,Serialize};
use sha2::{Digest,Sha224,Sha256,Sha384,Sha512};
use std::{io::Read,path::PathBuf,time::{Duration,Instant}};

#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct DecodeInput {pub source:String,pub data:String,pub key:String}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct DecodeOutput {pub text:String,pub sha256:String,pub bytes:usize}

pub fn run(input:DecodeInput)->ApiResult<DecodeOutput>{
 if input.source.len()>65536||input.data.len()>256*1024||input.key.len()>4096{return Err(ApiError::new("validation","Decoder source, data or key exceeds the local limit."));}
 let runtime=Runtime::new().map_err(|_|ApiError::new("script","Decoder runtime unavailable."))?;
 runtime.set_memory_limit(16*1024*1024);runtime.set_max_stack_size(256*1024);
 let deadline=Instant::now()+Duration::from_secs(1);
 runtime.set_interrupt_handler(Some(Box::new(move||Instant::now()>=deadline)));
 let context=Context::full(&runtime).map_err(|_|ApiError::new("script","Decoder context unavailable."))?;
 let text=context.with(|ctx|->ApiResult<String>{
  ctx.globals().set("__source",input.source).map_err(|_|ApiError::new("script","Decoder source unavailable."))?;
  ctx.globals().set("__data",input.data).map_err(|_|ApiError::new("script","Decoder input unavailable."))?;
  ctx.globals().set("__key",input.key).map_err(|_|ApiError::new("script","Decoder key unavailable."))?;
  ctx.eval::<String,_>(include_str!("runner.js")).map_err(|_|ApiError::new("script","Decoder failed or exceeded limits. No exception text or key was logged."))
 })?;
 if text.len()>1024*1024{return Err(ApiError::new("quota","Decoded output exceeds 1 MiB."));}
 let sha256=format!("{:x}",Sha256::digest(text.as_bytes()));
 Ok(DecodeOutput{bytes:text.len(),text,sha256})
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct FileHash {pub name:String,pub bytes:u64,pub sha224:String,pub sha256:String,pub sha384:String,pub sha512:String}
pub fn hash_file()->ApiResult<Option<FileHash>>{
 #[cfg(windows)]{
  let Some(path)=rfd::FileDialog::new().pick_file()else{return Ok(None)};
  let result=hash_path(path)?;Ok(Some(result))
 }
 #[cfg(not(windows))]{Err(ApiError::new("unsupported","Native file hashing is Windows-only."))}
}
fn hash_path(path:PathBuf)->ApiResult<FileHash>{
 let name=path.file_name().map(|v|v.to_string_lossy().to_string()).unwrap_or_else(||"Selected file".into());
 let mut file=std::fs::File::open(path)?;
 let (mut a,mut b,mut c,mut d)=(Sha224::new(),Sha256::new(),Sha384::new(),Sha512::new());
 let mut size=0u64;let mut buffer=[0u8;65536];
 loop{let read=file.read(&mut buffer)?;if read==0{break}size=size.saturating_add(read as u64);for hash in [&mut a as &mut dyn DigestWrapper,&mut b,&mut c,&mut d]{hash.update(&buffer[..read]);}}
 Ok(FileHash{name,bytes:size,sha224:format!("{:x}",a.finalize()),sha256:format!("{:x}",b.finalize()),sha384:format!("{:x}",c.finalize()),sha512:format!("{:x}",d.finalize())})
}
trait DigestWrapper{fn update(&mut self,data:&[u8]);}
impl DigestWrapper for Sha224{fn update(&mut self,data:&[u8]){Digest::update(self,data)}}
impl DigestWrapper for Sha256{fn update(&mut self,data:&[u8]){Digest::update(self,data)}}
impl DigestWrapper for Sha384{fn update(&mut self,data:&[u8]){Digest::update(self,data)}}
impl DigestWrapper for Sha512{fn update(&mut self,data:&[u8]){Digest::update(self,data)}}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn bounded_decoder_and_file_hash(){
  let output=run(DecodeInput{source:"return data.split('').reverse().join('') + key;".into(),data:"abc".into(),key:"!".into()}).unwrap();
  assert_eq!(output.text,"cba!");assert_eq!(output.bytes,4);
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("sample.bin");std::fs::write(&path,b"abc").unwrap();let hash=hash_path(path).unwrap();
  assert_eq!(hash.bytes,3);assert_eq!(hash.sha256,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
 }
}
