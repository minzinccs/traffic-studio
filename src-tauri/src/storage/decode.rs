use super::Database;
use crate::domain::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedBody {
    pub base64: String,
    pub decoded_size: usize,
    pub truncated: bool,
    pub protobuf: Option<serde_json::Value>,
}
impl Database {
    pub fn decode_body(
        &self,
        workspace: &str,
        id: &str,
        encoding: &str,
        protobuf: bool,
    ) -> ApiResult<DecodedBody> {
        valid_id(id)?;
        let connection = self.lock()?;
        Self::require_workspace(&connection, workspace)?;
        let (hash, size): (String, i64) = connection.query_row(
            "SELECT sha256,size FROM blobs WHERE workspace_id=?1 AND id=?2",
            rusqlite::params![workspace, id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        drop(connection);
        if !(0..=8 * 1024 * 1024).contains(&size)
            || hash.len() != 64
            || !hash.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(ApiError::new(
                "quota",
                "Decode supports original bodies up to 8 MiB; export larger originals.",
            ));
        }
        let input = std::fs::read(self.root.join("bodies").join(workspace).join(&hash))?;
        if input.len() != size as usize || format!("{:x}", Sha256::digest(&input)) != hash {
            return Err(ApiError::new("storage", "Body checksum failed."));
        }
        let reader: Box<dyn Read> = match encoding.trim().to_lowercase().as_str() {
            "" | "identity" => Box::new(std::io::Cursor::new(input)),
            "gzip" => Box::new(flate2::read::MultiGzDecoder::new(std::io::Cursor::new(
                input,
            ))),
            "deflate" => Box::new(flate2::read::ZlibDecoder::new(std::io::Cursor::new(input))),
            "br" => Box::new(brotli::Decompressor::new(std::io::Cursor::new(input), 4096)),
            _ => {
                return Err(ApiError::new(
                    "unsupported",
                    "Unsupported or stacked Content-Encoding.",
                ))
            }
        };
        let mut decoded = Vec::new();
        reader
            .take(8 * 1024 * 1024 + 1)
            .read_to_end(&mut decoded)
            .map_err(|_| ApiError::new("validation", "Compressed body is malformed."))?;
        if decoded.len() > 8 * 1024 * 1024 {
            return Err(ApiError::new("quota", "Decoded body exceeds 8 MiB."));
        }
        let fields = if protobuf {
            if decoded.len() > 256 * 1024 {
                return Err(ApiError::new(
                    "quota",
                    "Protobuf wire preview is limited to 256 KiB.",
                ));
            }
            Some(wire_fields(&decoded)?)
        } else {
            None
        };
        let preview = &decoded[..decoded.len().min(256 * 1024)];
        Ok(DecodedBody {
            base64: STANDARD.encode(preview),
            decoded_size: decoded.len(),
            truncated: decoded.len() > preview.len(),
            protobuf: fields,
        })
    }
}
fn varint(bytes: &[u8], position: &mut usize) -> ApiResult<u64> {
    let mut value = 0u64;
    for index in 0..10 {
        let byte = *bytes
            .get(*position)
            .ok_or_else(|| ApiError::new("validation", "Truncated protobuf varint."))?;
        *position += 1;
        if index == 9 && byte > 1 {
            return Err(ApiError::new("validation", "Protobuf varint overflow."));
        }
        value |= ((byte & 127) as u64) << (index * 7);
        if byte < 128 {
            return Ok(value);
        }
    }
    Err(ApiError::new("validation", "Invalid protobuf varint."))
}
fn wire_fields(bytes: &[u8]) -> ApiResult<serde_json::Value> {
    let mut position = 0;
    let mut fields = Vec::new();
    while position < bytes.len() {
        if fields.len() >= 10000 {
            return Err(ApiError::new("quota", "Too many protobuf fields."));
        }
        let tag = varint(bytes, &mut position)?;
        let number = tag >> 3;
        if number == 0 || number > 536870911 {
            return Err(ApiError::new(
                "validation",
                "Invalid protobuf field number.",
            ));
        }
        let wire = tag & 7;
        let value = match wire {
            0 => serde_json::json!({"unsignedVarint":varint(bytes,&mut position)?.to_string()}),
            1 | 5 => {
                let n = if wire == 1 { 8 } else { 4 };
                let data = bytes
                    .get(position..position + n)
                    .ok_or_else(|| ApiError::new("validation", "Truncated fixed field."))?;
                position += n;
                serde_json::json!({"littleEndianBase64":STANDARD.encode(data)})
            }
            2 => {
                let count = usize::try_from(varint(bytes, &mut position)?)
                    .map_err(|_| ApiError::new("validation", "Length overflow."))?;
                let end = position
                    .checked_add(count)
                    .filter(|end| *end <= bytes.len())
                    .ok_or_else(|| {
                        ApiError::new("validation", "Truncated length-delimited field.")
                    })?;
                let data = &bytes[position..end];
                position = end;
                serde_json::json!({"bytesBase64":STANDARD.encode(data),"length":count})
            }
            _ => {
                return Err(ApiError::new(
                    "unsupported",
                    "Deprecated protobuf groups are unsupported in wire preview.",
                ))
            }
        };
        fields.push(serde_json::json!({"field":number,"wireType":wire,"value":value}));
    }
    Ok(
        serde_json::json!({"mode":"schema-less wire preview; signed values/messages require a schema","fields":fields}),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_wire_rejected() {
        assert!(wire_fields(&[0x80]).is_err());
        assert!(wire_fields(&[0x0a, 0xff]).is_err());
        let data = wire_fields(&[0x08, 0x96, 0x01]).unwrap();
        assert_eq!(data["fields"][0]["value"]["unsignedVarint"], "150");
    }
}
