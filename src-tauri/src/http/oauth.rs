use crate::domain::*;
use serde::{Deserialize,Serialize};
use std::{collections::HashMap,sync::Mutex,time::Duration};
use tokio::sync::oneshot;
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct OAuthInput {pub id:String,pub endpoint:String,pub grant:String,pub client_id:String,pub client_secret:String,pub client_auth:String,pub scope:String,pub code:String,pub redirect_uri:String,pub verifier:String,pub refresh_token:String}
impl Drop for OAuthInput {fn drop(&mut self){unsafe {self.client_secret.as_bytes_mut().fill(0);self.code.as_bytes_mut().fill(0);self.verifier.as_bytes_mut().fill(0);self.refresh_token.as_bytes_mut().fill(0);}}}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct OAuthToken {pub access_token:String,pub refresh_token:Option<String>,pub expires_in:Option<u64>,pub scope:Option<String>}
#[derive(Default)]
pub struct OAuthRuntime {active:Mutex<HashMap<String,Option<oneshot::Sender<()>>>>}
impl OAuthRuntime {
    pub fn cancel(&self,id:&str)->ApiResult<()>{valid_id(id)?;let mut active=self.active.lock().map_err(|_|ApiError::new("runtime","OAuth worker unavailable."))?;if let Some(Some(sender))=active.get_mut(id).map(Option::take){let _=sender.send(());}Ok(())}
    pub async fn exchange(&self,input:OAuthInput)->ApiResult<OAuthToken>{
        valid_id(&input.id)?;
        if [&input.endpoint,&input.client_id,&input.client_secret,&input.scope,&input.code,&input.redirect_uri,&input.verifier,&input.refresh_token].iter().any(|value|value.len()>65536){return Err(ApiError::new("validation","OAuth field exceeds 64 KiB."));}
        let url=reqwest::Url::parse(&input.endpoint).map_err(|_|ApiError::new("validation","Invalid OAuth token endpoint."))?;
        let local=matches!(url.host_str(),Some("127.0.0.1")|Some("[::1]")|Some("::1"));
        if !(url.scheme()=="https"||url.scheme()=="http"&&local)||!url.username().is_empty()||url.password().is_some()||url.fragment().is_some(){return Err(ApiError::new("validation","Token endpoint must use HTTPS (HTTP allowed only on literal loopback), without URL credentials/fragment."));}
        if input.client_id.trim().is_empty(){return Err(ApiError::new("validation","OAuth client ID is required."));}
        let mut fields=vec![("grant_type",input.grant.as_str()),("client_id",input.client_id.as_str())];
        if !input.scope.is_empty(){fields.push(("scope",input.scope.as_str()));}
        match input.grant.as_str(){
            "client_credentials"=>{},
            "authorization_code"=>{if input.code.is_empty()||input.redirect_uri.is_empty()||input.verifier.len()<43||input.verifier.len()>128||!input.verifier.bytes().all(|byte|byte.is_ascii_alphanumeric()||b"-._~".contains(&byte)){return Err(ApiError::new("validation","Authorization-code exchange requires code, redirect URI and valid PKCE verifier."));}fields.extend([("code",input.code.as_str()),("redirect_uri",input.redirect_uri.as_str()),("code_verifier",input.verifier.as_str())]);},
            "refresh_token"=>{if input.refresh_token.is_empty(){return Err(ApiError::new("validation","Refresh token is required."));}fields.push(("refresh_token",input.refresh_token.as_str()));},
            _=>return Err(ApiError::new("unsupported","Unsupported OAuth grant."))
        }
        if !["body","basic","none"].contains(&input.client_auth.as_str()){return Err(ApiError::new("validation","Unsupported client authentication."));}
        if input.client_auth=="body"&&!input.client_secret.is_empty(){fields.push(("client_secret",input.client_secret.as_str()));}
        let client=reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(30)).build().map_err(|_|ApiError::new("runtime","OAuth TLS transport unavailable."))?;
        let mut request=client.post(url).header(reqwest::header::ACCEPT,"application/json");
        if input.client_auth=="basic" {fields.retain(|(key,_)|*key!="client_id");fn encoded(value:&str)->String{reqwest::Url::parse_with_params("http://localhost/",[("x",value)]).unwrap().query().unwrap()[2..].to_string()}request=request.basic_auth(encoded(&input.client_id),Some(encoded(&input.client_secret)));}
        request=request.form(&fields);
        let (sender,receiver)=oneshot::channel();
        {let mut active=self.active.lock().map_err(|_|ApiError::new("runtime","OAuth worker unavailable."))?;if active.len()>=4||active.contains_key(&input.id){return Err(ApiError::new("busy","OAuth request limit reached."));}active.insert(input.id.clone(),Some(sender));}
        struct Guard<'a>{runtime:&'a OAuthRuntime,id:String}impl Drop for Guard<'_>{fn drop(&mut self){if let Ok(mut active)=self.runtime.active.lock(){active.remove(&self.id);}}}let _guard=Guard{runtime:self,id:input.id.clone()};
        tokio::select!{biased;_=receiver=>Err(ApiError::new("cancelled","OAuth exchange cancelled.")),result=tokio::time::timeout(Duration::from_secs(30),read_token(request))=>result.map_err(|_|ApiError::new("timeout","OAuth exchange timed out.")).and_then(|result|result)}
    }
}
async fn read_token(request:reqwest::RequestBuilder)->ApiResult<OAuthToken>{
    let mut response=request.send().await.map_err(|_|ApiError::new("network","OAuth request failed; verify endpoint and TLS trust."))?;
    let status=response.status();if !status.is_success(){return Err(ApiError::new("auth",&format!("OAuth endpoint returned HTTP {}. Error body is suppressed to avoid exposing tokens.",status.as_u16())));}
    let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|ApiError::new("network","OAuth response read failed."))?{if bytes.len()+chunk.len()>256*1024{return Err(ApiError::new("quota","OAuth response exceeds 256 KiB."));}bytes.extend_from_slice(&chunk);}
    let value:serde_json::Value=serde_json::from_slice(&bytes).map_err(|_|ApiError::new("auth","OAuth endpoint did not return token JSON."))?;bytes.fill(0);
    let access_token=value["access_token"].as_str().filter(|token|!token.is_empty()&&token.len()<=65536&&!token.chars().any(char::is_control)).ok_or_else(||ApiError::new("auth","OAuth response has no valid access token."))?.to_string();
    if !value["token_type"].as_str().is_some_and(|kind|kind.eq_ignore_ascii_case("bearer")){return Err(ApiError::new("unsupported","Only Bearer OAuth tokens are supported."));}
    Ok(OAuthToken{access_token,refresh_token:value["refresh_token"].as_str().filter(|value|value.len()<=65536).map(String::from),expires_in:value["expires_in"].as_u64(),scope:value["scope"].as_str().map(String::from)})
}
