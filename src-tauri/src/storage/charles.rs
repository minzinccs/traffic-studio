//! Charles XML exchange subset. Native .chls/.chlz files are not deserialized.
use super::*;
use quick_xml::{events::{BytesStart, Event}, Reader, XmlVersion};
use serde_json::json;
use std::collections::BTreeMap;

#[derive(Default)]
struct Transaction {
    attributes: BTreeMap<String, String>,
    request_attributes: BTreeMap<String, String>,
    response_attributes: BTreeMap<String, String>,
    request_headers: Vec<Value>,
    response_headers: Vec<Value>,
    request_body: String,
    response_body: String,
    request_encoding: String,
    response_encoding: String,
    header_name: String,
    header_value: String,
}

fn xml_error() -> ApiError { ApiError::new("validation", "Invalid or unsupported Charles XML session.") }
fn attributes(tag: &BytesStart<'_>) -> ApiResult<BTreeMap<String, String>> {
    let mut values = BTreeMap::new();
    for item in tag.attributes().with_checks(true) {
        let item = item.map_err(|_| xml_error())?;
        let key = item.key.as_ref().to_string();
        let value = item.normalized_value(XmlVersion::Implicit1_0).map_err(|_| xml_error())?.into_owned();
        if key.len() > 80 || value.len() > 4096 || values.insert(key, value).is_some() { return Err(xml_error()); }
    }
    Ok(values)
}
fn valid_path(path: &[String]) -> bool {
    match path {
        [root] => root == "charles-session",
        [root, transaction] => root == "charles-session" && transaction == "transaction",
        [_, _, side] => side == "request" || side == "response",
        [_, _, side, child] => (side == "request" || side == "response") && (child == "headers" || child == "body"),
        [_, _, side, headers, child] => (side == "request" || side == "response") && headers == "headers" && (child == "first-line" || child == "header"),
        [_, _, side, headers, header, field] => (side == "request" || side == "response") && headers == "headers" && header == "header" && (field == "name" || field == "value"),
        _ => false,
    }
}
fn complete(path: &[String], transaction: &mut Option<Transaction>, entries: &mut Vec<Value>) -> ApiResult<()> {
    if path.len() == 5 && path[4] == "header" {
        let value = transaction.as_mut().ok_or_else(xml_error)?;
        if value.header_name.is_empty() || value.header_name.len() > 256 || value.header_value.len() > 16384 || value.header_name.contains(['\r', '\n']) || value.header_value.contains(['\r', '\n']) { return Err(xml_error()); }
        let header = json!({"name": value.header_name, "value": value.header_value});
        if path[2] == "request" { value.request_headers.push(header); } else { value.response_headers.push(header); }
        value.header_name.clear(); value.header_value.clear();
    }
    if path.len() == 2 && path[1] == "transaction" {
        let value = transaction.take().ok_or_else(xml_error)?;
        let protocol = value.attributes.get("protocol").map(String::as_str).unwrap_or("http");
        if !["http", "https"].contains(&protocol) { return Err(xml_error()); }
        let host = value.attributes.get("host").ok_or_else(xml_error)?;
        let path = value.attributes.get("path").map(String::as_str).unwrap_or("/");
        if !path.starts_with('/') || path.contains(['\r', '\n']) { return Err(xml_error()); }
        let port = value.attributes.get("actualPort").map(String::as_str).unwrap_or(if protocol == "https" { "443" } else { "80" });
        let port: u16 = port.parse().map_err(|_| xml_error())?;
        let url = format!("{protocol}://{host}:{port}{path}");
        let parsed = reqwest::Url::parse(&url).map_err(|_| xml_error())?;
        if !parsed.username().is_empty() || parsed.password().is_some() || parsed.host_str().is_none() { return Err(xml_error()); }
        let method = value.attributes.get("method").map(String::as_str).ok_or_else(xml_error)?;
        if method.is_empty() || method.len() > 20 || !method.bytes().all(|c| c.is_ascii_uppercase() || c == b'-') { return Err(xml_error()); }
        let status: u16 = value.response_attributes.get("status").ok_or_else(xml_error)?.parse().map_err(|_| xml_error())?;
        if !(100..=599).contains(&status) { return Err(xml_error()); }
        let duration: f64 = value.attributes.get("duration").map(String::as_str).unwrap_or("0").parse().map_err(|_| xml_error())?;
        if !duration.is_finite() || duration < 0.0 { return Err(xml_error()); }
        let mut request = json!({"method": method, "url": parsed.to_string(), "httpVersion": value.attributes.get("protocolVersion").map(String::as_str).unwrap_or("HTTP/1.1"), "headers": value.request_headers});
        if !value.request_body.is_empty() { request["postData"] = json!({"mimeType": value.request_attributes.get("mime-type").map(String::as_str).unwrap_or("application/octet-stream"), "text": value.request_body, "encoding": if value.request_encoding == "base64" { "base64" } else { "text" }}); }
        let mut content = json!({"mimeType": value.response_attributes.get("mime-type").map(String::as_str).unwrap_or("application/octet-stream")});
        if !value.response_body.is_empty() { content["text"] = json!(value.response_body); if value.response_encoding == "base64" { content["encoding"] = json!("base64"); } }
        entries.push(json!({"startedDateTime": value.attributes.get("startTime"), "time": duration, "request": request, "response": {"status": status, "headers": value.response_headers, "content": content}, "_charles": {"transactionAttributes": value.attributes, "requestAttributes": value.request_attributes, "responseAttributes": value.response_attributes}}));
    }
    Ok(())
}

pub fn parse_xml(bytes: &[u8]) -> ApiResult<Value> {
    if bytes.len() > 32 * 1024 * 1024 { return Err(ApiError::new("quota", "Charles XML exceeds 32 MiB.")); }
    let input = std::str::from_utf8(bytes).map_err(|_| ApiError::new("unsupported", "Charles XML must be UTF-8. Re-export it as UTF-8 or HAR."))?;
    let mut reader = Reader::from_str(input);
    let mut path = Vec::<String>::new();
    let mut transaction: Option<Transaction> = None;
    let mut entries = Vec::new();
    let mut root_closed = false;
    loop {
        let event = reader.read_event().map_err(|_| xml_error())?;
        match event {
            Event::Start(ref tag) | Event::Empty(ref tag) => {
                if root_closed { return Err(xml_error()); }
                let name = tag.name().as_ref().to_string();
                path.push(name);
                if !valid_path(&path) { return Err(ApiError::new("unsupported", "Charles XML has an unsupported element; import HAR or a supported XML export.")); }
                let attrs = attributes(tag)?;
                match path.as_slice() {
                    [_, name] if name == "transaction" => { if entries.len() >= 10000 { return Err(ApiError::new("quota", "Charles XML exceeds 10000 transactions.")); } transaction = Some(Transaction { attributes: attrs, ..Default::default() }); },
                    [_, _, side] if side == "request" => transaction.as_mut().ok_or_else(xml_error)?.request_attributes = attrs,
                    [_, _, side] if side == "response" => transaction.as_mut().ok_or_else(xml_error)?.response_attributes = attrs,
                    [_, _, side, body] if body == "body" => { let encoding = attrs.get("encoding").cloned().unwrap_or_default(); if side == "request" { transaction.as_mut().ok_or_else(xml_error)?.request_encoding = encoding; } else { transaction.as_mut().ok_or_else(xml_error)?.response_encoding = encoding; } },
                    _ => {},
                }
                if matches!(event, Event::Empty(_)) { complete(&path, &mut transaction, &mut entries)?; path.pop(); }
            }
            Event::End(tag) => { if path.last().is_none_or(|name| name.as_str() != tag.name().as_ref()) { return Err(xml_error()); } complete(&path, &mut transaction, &mut entries)?; if path.len() == 1 { root_closed = true; } path.pop(); }
            Event::Text(text) => { let content=text.xml10_content();let decoded = quick_xml::escape::unescape(&content).map_err(|_| xml_error())?; append_text(&path, &mut transaction, &decoded)?; }
            Event::CData(text) => append_text(&path, &mut transaction, &text.xml10_content())?,
            Event::DocType(text) => { let declaration = text.xml10_content(); if declaration.len() > 512 || declaration.contains('[') || !declaration.starts_with("charles-session SYSTEM") || !declaration.contains("charlesproxy.com/dtd/charles-session-") { return Err(ApiError::new("unsupported", "Charles XML DTD/internal entities are not supported.")); } },
            Event::Decl(_) | Event::Comment(_) => {},
            Event::Eof => break,
            _ => return Err(xml_error()),
        }
    }
    if !root_closed || !path.is_empty() || entries.is_empty() { return Err(xml_error()); }
    Ok(json!({"log": {"version": "1.2", "creator": {"name": "Charles XML exchange", "version": "1"}, "entries": entries, "_trafficStudioImport": "Charles XML subset; native .chls/.chlz are not parsed"}}))
}
fn append_text(path: &[String], transaction: &mut Option<Transaction>, text: &str) -> ApiResult<()> {
    if text.trim().is_empty() && path.len() < 4 { return Ok(()); }
    let value = transaction.as_mut().ok_or_else(xml_error)?;
    let destination = match path {
        [_, _, side, body] if side == "request" && body == "body" => &mut value.request_body,
        [_, _, side, body] if side == "response" && body == "body" => &mut value.response_body,
        [_, _, _, headers, header, field] if headers == "headers" && header == "header" && field == "name" => &mut value.header_name,
        [_, _, _, headers, header, field] if headers == "headers" && header == "header" && field == "value" => &mut value.header_value,
        [_, _, _, headers, first_line] if headers == "headers" && first_line == "first-line" => return Ok(()),
        _ if text.trim().is_empty() => return Ok(()),
        _ => return Err(xml_error()),
    };
    if destination.len().saturating_add(text.len()) > 16 * 1024 * 1024 { return Err(ApiError::new("quota", "Charles XML field exceeds 16 MiB.")); }
    destination.push_str(text);
    Ok(())
}

impl Database {
    pub fn import_charles_xml_bytes(&self, workspace: &str, bytes: &[u8], name: &str) -> ApiResult<String> {
        let har = parse_xml(bytes)?;
        self.import_har_bytes(workspace, &serde_json::to_vec(&har)?, name)
    }
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn xml_exchange_imports_headers_body_and_query_without_fetching_dtd() {
        let xml = br##"<?xml version="1.0"?><!DOCTYPE charles-session SYSTEM "https://www.charlesproxy.com/dtd/charles-session-1_2.dtd"><charles-session><transaction method="GET" protocol="http" host="example.invalid" actualPort="80" path="/a?x=1&amp;y=2" duration="7" protocolVersion="HTTP/1.1"><request><headers><header><name>Authorization</name><value>Bearer local</value></header></headers></request><response status="200" mime-type="text/plain"><headers/><body><![CDATA[hello]]></body></response></transaction></charles-session>"##;
        let temp=tempfile::tempdir().unwrap();let db=Database::open(temp.path()).unwrap();let workspace=db.create_workspace("Charles").unwrap();let session=db.import_charles_xml_bytes(&workspace.id,xml,"Imported Charles XML").unwrap();let flows=db.query(&workspace.id,"flow",10,0).unwrap();assert_eq!(flows.len(),1);assert_eq!(flows[0].payload["url"],"http://example.invalid/a?x=1&y=2");assert_eq!(flows[0].payload["requestHeaders"][0]["value"],"Bearer local");let har=db.export_har_value(&workspace.id,&session,true,true).unwrap();assert_eq!(har["log"]["entries"][0]["response"]["content"]["text"],"hello");
    }
    #[test] fn rejects_internal_entities_and_native_binary() {
        assert!(parse_xml(br#"<!DOCTYPE charles-session [<!ENTITY x SYSTEM "file:///etc/passwd">]><charles-session/>"#).is_err());
        assert!(parse_xml(&[0xac,0xed,0x00,0x05]).is_err());
    }
}
