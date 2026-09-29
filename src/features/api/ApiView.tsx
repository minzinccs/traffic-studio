import { MultipartFiles, type MultipartFile } from './MultipartFiles';
import { OAuthPanel } from './OAuthPanel';
import { ResponseExport } from './ResponseExport';
import { ScriptEditor } from './ScriptEditor';
import { BrowserCollectionMigration } from './BrowserCollectionMigration';
import { NativeEnvironmentPanel } from '../environments';
import type { Variable } from '../environments/resolution';
import { NativeHttpOptions } from './NativeHttpOptions';
import { UiText } from '../localization';
import { KeyValueGrid } from './KeyValueGrid';
import { RequestBodyEditor } from './RequestBodyEditor';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Database, Save } from 'lucide-react';
import type { ApiResponse } from '../../domain/http';
import { useNativeHttp } from './useNativeHttp';
import { NativeRunHistory } from './NativeRunHistory';
import { NativeRequestDocuments } from './NativeRequestDocuments';
import type { DraftPair as Pair, RequestDraft } from './requestDraft';
import { sendMockRequest } from '../../bridge/mockBridge';
import { readProfile, updateProfile, profileVariableLayers } from './collections';
import './apiEditorExtras.css';
import './apiResponsive.css';
import { CurlImport } from './CurlImport';
import { readPreferences } from '../settings/preferences';
import { SelectField } from '../../shell/SelectField';
import { VariableEditor } from '../environments/VariableEditor';
import { createVariableResolver, sanitizeVariables } from '../environments/resolution';
import { readEnvironmentRows } from '../environments/environments';


const sensitiveHeader = (key: string) => /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key.trim());
const persistableDraft = (draft: RequestDraft): RequestDraft => ({ ...draft, auth: '', variables: sanitizeVariables(draft.variables), headers: draft.headers.filter((header) => !sensitiveHeader(header.key)) });
const blank: RequestDraft = { name: 'New request', method: 'GET', url: '', params: [{ id: 1, key: '', value: '', enabled: true }], headers: [{ id: 2, key: '', value: '', enabled: true }], body: '', auth: '' };
const storageKey = 'traffic-studio-api-requests';
function readSaved(): RequestDraft[] { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as RequestDraft[]; } catch { return []; } }

function formatResponseJson(body: string) { try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } }

export function ApiView({ flash, requestName, profileId, tabId, onDirty, environment = 'Global' }: { flash: (m: string) => void; requestName: string; profileId?: string; tabId: number; onDirty: (dirty: boolean) => void; environment?: string }) {
  const [draft, setDraft] = useState<RequestDraft>(() => {
    try { const session = sessionStorage.getItem(`traffic-studio-api-draft-${tabId}`) ?? localStorage.getItem(`traffic-studio-api-draft-${tabId}`); if (session) return JSON.parse(session) as RequestDraft; } catch { /* fall back */ }
    const profile = profileId ? readProfile(profileId) : undefined;
    if (profile) return { name: profile.name, method: profile.method, url: profile.url, params: [{ id: 1, key: '', value: '', enabled: true }], headers: profile.headers.map((header, index) => ({ id: index + 2, ...header, enabled: true })), body: profile.body, auth: '', variables: profile.variables ?? [], ...profile.requestConfig };
    return readSaved().find((item) => item.name === requestName) ?? { ...blank, timeoutMs: readPreferences().api.timeout, followRedirects: readPreferences().api.redirects, tlsVerify:readPreferences().api.tls, name: requestName.startsWith('API ') ? 'New request' : requestName };
  });
  const http=useNativeHttp();
  const [nativeVariables,setNativeVariables]=useState<Variable[]>([]);
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [curlOpen, setCurlOpen] = useState(false);
  const [authUser,setAuthUser]=useState('');const [authPassword,setAuthPassword]=useState('');const [apiKeyName,setApiKeyName]=useState('X-API-Key');const [apiKeyValue,setApiKeyValue]=useState('');
  const [bodyFile,setBodyFile]=useState<File|null>(null);
  const [multipartFiles,setMultipartFiles]=useState<MultipartFile[]>([]);
  const [cookies, setCookies] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [scenario, setScenario] = useState('Success');
  const [responseMode, setResponseMode] = useState('Text');
  const sendTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(sendTimer.current), []);
  const [saved, setSaved] = useState<RequestDraft[]>(readSaved);
  const [subtab, setSubtab] = useState('Query');
  const [showCollection, setShowCollection] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [responseTab, setResponseTab] = useState<'Body' | 'Headers' | 'Timing'>('Body');
  const [editorWidth, setEditorWidth] = useState(() => { const saved = Number(localStorage.getItem('traffic-studio-api-editor-width')); return saved >= 30 && saved <= 75 ? saved : 48; });
  const [responseCollapsed, setResponseCollapsed] = useState(false);

  useEffect(() => { const text=JSON.stringify(persistableDraft(draft)); let stored = false; try { sessionStorage.setItem(`traffic-studio-api-draft-${tabId}`,text); stored = true; } catch { /* Try persistent storage independently. */ } try { localStorage.setItem(`traffic-studio-api-draft-${tabId}`,text); stored = true; } catch { /* Preserve the open editor. */ } if (!stored) setSendError('Draft recovery storage is unavailable. Keep this editor open and copy important content.'); }, [draft, tabId]);
  useEffect(() => { localStorage.setItem('traffic-studio-api-editor-width', String(editorWidth)); }, [editorWidth]);

  const update = (patch: Partial<RequestDraft>) => { setDraft((current) => ({ ...current, ...patch })); onDirty(true); };
  const field = subtab === 'Query' ? 'params' : 'headers';
  const rows = draft[field];
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => { event.preventDefault(); const start = event.clientX; const width = editorWidth; const total = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 800; const move = (next: PointerEvent) => setEditorWidth(Math.min(75, Math.max(30, width + (next.clientX - start) / total * 100))); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); };
  const save = () => {
    const name = draft.name.trim() || 'Untitled request';
    const updated = [...readSaved().filter((item) => item.name !== name), persistableDraft({ ...draft, name })];
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch { setSendError('Could not save request. Browser storage is unavailable or full; your draft remains open.'); return; }
    setSaved(updated); update({ name }); onDirty(false);
    flash(`Saved “${name}” locally. Auth and credential headers were excluded.`);
  };
  const saveProfile = () => {
    if (!profileId) return;
    const current = readProfile(profileId);
    if (!current) { flash('This profile was removed from Collections.'); return; }
    let saved = false;
    try { saved = updateProfile(profileId, { name: draft.name.trim() || 'Untitled profile', method: draft.method, url: draft.url, headers: draft.headers.filter((header) => header.enabled && header.key.trim() && !sensitiveHeader(header.key)).map(({ key, value }) => ({ key, value })), body: draft.body, variables: draft.variables, requestConfig: { params: draft.params, bodyMode: draft.bodyMode, script: draft.script, testScript: draft.testScript, docs: draft.docs, timeoutMs: draft.timeoutMs, followRedirects: draft.followRedirects, protocol: draft.protocol, proxyUrl:draft.proxyUrl, customCaPem:draft.customCaPem, tlsVerify:draft.tlsVerify, cookiesEnabled:draft.cookiesEnabled }, notes: current.notes }); } catch { setSendError('Could not save profile. Browser storage is unavailable or full; your draft remains open.'); return; }
    if (saved) { onDirty(false); flash('API profile saved locally. Auth and credential headers were excluded.'); }
  };
  const send = async () => {
    setSendError('');
    const environmentRows = readEnvironmentRows();
    const { interpolate, errors } = createVariableResolver([
      environmentRows.Global ?? [],
      environment === 'Global' ? [] : environmentRows[environment] ?? [],
      ...(http.native?[nativeVariables]:[]),...profileVariableLayers(profileId), draft.variables ?? [],
    ]);
    let url: URL;
    try { url = new URL(interpolate(draft.url)); if (!['http:','https:'].includes(url.protocol)) throw Error(); } catch { setSendError(errors.size ? [...errors].join('; ') : 'Enter a valid http(s) URL.'); return; }
    draft.params.filter(p => p.enabled && p.key).forEach(p => url.searchParams.append(interpolate(p.key), interpolate(p.value)));
    const headers = draft.headers.filter(h => h.enabled && h.key).map(h => ({ key: interpolate(h.key), value: interpolate(h.value) }));
    let body = ['None','Binary file','Form URL encoded'].includes(draft.bodyMode??'') || (http.native&&draft.bodyMode==='Multipart draft') ? '' : interpolate(draft.body);
    if(draft.bodyMode==='Binary file'){if(!bodyFile){setSendError('Select a binary file before Send.');return;}body=http.native?'':JSON.stringify({file:bodyFile.name,size:bodyFile.size,simulated:true,bytesUploaded:false});}
    if(draft.bodyMode==='Form URL encoded'){try{const rows=JSON.parse(draft.body) as Pair[];if(!Array.isArray(rows))throw Error();const form=new URLSearchParams();rows.filter(row=>row.enabled&&row.key).forEach(row=>form.append(interpolate(row.key),interpolate(row.value)));body=form.toString();if(!headers.some(h=>h.key.toLowerCase()==='content-type'))headers.push({key:'Content-Type',value:'application/x-www-form-urlencoded'});}catch{setSendError('Add valid structured form fields.');return;}}
    if (draft.bodyMode === 'JSON' && body) { try { JSON.parse(body); } catch { setSendError('Request body is not valid JSON.'); return; } }
    if(draft.authMode==='Basic')headers.push({key:'Authorization',value:`Basic ${btoa(Array.from(new TextEncoder().encode(`${interpolate(authUser)}:${interpolate(authPassword)}`),b=>String.fromCharCode(b)).join(''))}`});if(draft.authMode==='API key'&&apiKeyName&&apiKeyValue)headers.push({key:interpolate(apiKeyName),value:interpolate(apiKeyValue)});
    if (draft.auth && !['None','Basic','API key','Digest draft'].includes(draft.authMode??'')) headers.push({ key: 'Authorization', value: ['Bearer','OAuth 2 token'].includes(draft.authMode??'') ? `Bearer ${interpolate(draft.auth)}` : interpolate(draft.auth) });
    if (cookies) headers.push({ key: 'Cookie', value: interpolate(cookies) });
    if (errors.size) { setSendError([...errors].join('; ')); return; }
    if(http.native){

      if(draft.bodyMode==='Binary file'&&!headers.some(h=>h.key.toLowerCase()==='content-type'))headers.push({key:'Content-Type',value:bodyFile?.type||'application/octet-stream'});
      if(!headers.some(h=>h.key.toLowerCase()==='content-type')&&['JSON','XML','Text'].includes(draft.bodyMode??''))headers.push({key:'Content-Type',value:draft.bodyMode==='JSON'?'application/json':draft.bodyMode==='XML'?'application/xml':'text/plain; charset=utf-8'});
      let multipart:{key:string;value:string}[]|null=null;
      if(draft.bodyMode==='Multipart draft'){try{const fields=JSON.parse(draft.body) as Pair[];if(!Array.isArray(fields))throw Error();multipart=fields.filter(row=>row.enabled&&row.key).map(row=>({key:interpolate(row.key),value:interpolate(row.value)}));body='';}catch{setSendError('Add valid multipart fields.');return;}}
      if(errors.size){setSendError([...errors].join('; '));return;}
      setSending(true);setResponse(null);
      try{const result=await http.send({method:draft.method,url:url.toString(),headers,body,multipart,timeoutMs:draft.timeoutMs??30000,followRedirects:draft.followRedirects??true,protocol:draft.protocol??'Automatic',proxyUrl:draft.proxyUrl||null,customCaPem:draft.customCaPem||null,tlsVerify:draft.tlsVerify??true,cookiesEnabled:draft.cookiesEnabled??false,digest:draft.authMode==='Digest draft'?{username:interpolate(authUser),password:interpolate(authPassword)}:null},draft.bodyMode==='Binary file'?bodyFile:null,draft.bodyMode==='Multipart draft'?multipartFiles:[],{pre:draft.script,post:draft.testScript});if(mounted.current){setResponse(result);flash('Native HTTP response received; run stored locally.');}}
      catch(error){if(mounted.current)setSendError(error instanceof Error?error.message:'Native HTTP run failed.');}
      finally{if(mounted.current)setSending(false);}return;
    }
    setSending(true); setResponse(null);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      if (scenario === 'Network error') { setSendError('Simulated network error. No HTTP request was sent. Change the scenario and retry.'); flash('Simulated request failed.'); return; }
      const result = sendMockRequest({ method: draft.method, url: url.toString(), headers, body });
      if (scenario === 'HTTP 500') { result.status = 500; result.statusText = 'Internal Server Error'; result.body = '{"simulated":true,"error":"server_error"}'; }
      setResponse(result); flash('Response is simulated — no real HTTP was sent.');
    }, 350);
  };
  const cancel = () => { if(http.native){void http.cancel();return;} window.clearTimeout(sendTimer.current); setSending(false); setSendError('Mock request cancelled.'); };
  const copyBody = async () => {if(response?.body){try{await navigator.clipboard.writeText(response.body);flash('Copied response body.');}catch{flash('Clipboard unavailable. Select the response text manually.');}}};

  const activeHeaders = draft.headers.filter((h) => h.key.trim());
  const activeParams = draft.params.filter((p) => p.key.trim());

  return <div className="api-view">{curlOpen && <CurlImport onClose={() => setCurlOpen(false)} onApply={v => update({ ...v, params:[], headers: v.headers.map((h,i) => ({ ...h, id: Date.now()+i, enabled:true })) })}/>}
    <div className="api-topline"><div><span className="eyebrow">{profileId ? 'COLLECTION PROFILE · LOCAL DRAFT' : 'API WORKSPACE · LOCAL DRAFT'}</span><input className="api-title-input" aria-label="Request name" value={draft.name} onChange={(event) => update({ name: event.target.value })}/></div>
      <div className="api-top-actions">
        <button className="outline-button" onClick={() => setShowCollection((value) => !value)}><Database size={15}/> Saved requests {saved.length > 0 && <span className="count-label">{saved.length}</span>}</button>
        <button className="outline-button" onClick={() => setCurlOpen(true)}><UiText text={"Import cURL"}/></button><button className="outline-button" onClick={save}><Save size={15}/> <UiText text={"Save locally"}/></button>
        {profileId && <button className="outline-button" onClick={saveProfile}><Save size={15}/> <UiText text={"Save to profile"}/></button>}
      </div></div>
    {showCollection && <div className="collection-strip"><span>SAVED REQUESTS</span>{saved.length === 0 ? <small>No saved requests yet.</small> : saved.map((item) => <button key={item.name} onClick={() => { setDraft(item); setShowCollection(false); setResponse(null); onDirty(false); }}><strong>{item.method}</strong> {item.name}</button>)}</div>}

    <div className="api-preview-controls"><label>Transport <SelectField label="API transport" disabled={sending} value={http.native?'native':'preview'} onChange={value=>http.setNative(value==='native')} options={[{value:'preview',label:'Simulated sample'},{value:'native',label:'Native HTTP',disabled:!http.available}]}/></label>{http.native&&<><label>Native workspace <SelectField label="HTTP native workspace" disabled={sending} value={http.workspaceId} onChange={http.setWorkspaceId} options={[{value:'',label:'Select workspace'},...http.workspaces.map(w=>({value:w.id,label:w.name}))]}/></label><button disabled={sending} onClick={()=>void http.createWorkspace()}>Create HTTP workspace</button><button disabled={sending} onClick={()=>void http.refresh()}>Refresh</button><span>Per-request transport · response limit 64 MiB</span></>}{http.error&&<span role="alert">{http.error}</span>}</div>
    {http.native && <><NativeEnvironmentPanel workspaceId={http.workspaceId} onChange={setNativeVariables}/><BrowserCollectionMigration workspaceId={http.workspaceId}/><NativeRequestDocuments workspaceId={http.workspaceId} draft={persistableDraft(draft)} onSaved={()=>onDirty(false)} onLoad={next=>{setDraft(next);setBodyFile(null);setAuthUser('');setAuthPassword('');setApiKeyValue('');setCookies('');setResponse(null);onDirty(false);}}/><NativeRunHistory workspaceId={http.workspaceId} onLoad={setResponse}/></>}
    <div className="request-compose">
      <select aria-label="HTTP method" className={`method-select method-${draft.method.toLowerCase()}`} value={draft.method} onChange={(event) => update({ method: event.target.value })}>{Array.from(new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS', draft.method])).map((name) => <option key={name}>{name}</option>)}</select>
      <input aria-label="Custom HTTP method" title="Custom method" style={{ width: 70, flex: "none" }} value={draft.method} onChange={e => update({ method: e.target.value.toUpperCase().replace(/[^A-Z-]/g, "") })}/><input aria-label="Request URL" placeholder="https://api.example.com/v1/resources" value={draft.url} onChange={(event) => update({ url: event.target.value })}/>
      <button className="primary-action" disabled={sending || !draft.method || (http.native && (!http.available || !http.workspaceId))} onClick={send}><ArrowUpRight size={16}/> {sending ? (http.native?"Sending HTTP…":"Sending mock…") : (http.native?"Send HTTP":"Send mock")}</button>{sending && <button className="outline-button" onClick={cancel}><UiText text={"Cancel"}/></button> }
    </div>

    {sending && http.native && draft.bodyMode==='Binary file' && <p role="status">File upload: {http.progress}% · HTTP response pending</p>}<div className="request-tabs">{['Query','Headers','Body','Authorization','Cookies','Script','Docs','Settings'].map((name) => <button className={subtab === name ? 'active' : ''} key={name} onClick={() => setSubtab(name)}><UiText text={name}/>{(name === 'Query' || name === 'Headers') && <small>{(name === 'Query' ? activeParams : activeHeaders).length}</small>}</button>)}</div>

    {!http.native && <div className="api-preview-controls"><label><UiText text={"Mock scenario"}/> <SelectField label="Mock scenario" value={scenario} onChange={setScenario} options={["Success","HTTP 500","Network error"].map(value=>({value,label:value}))}/></label><span>Environment: {environment} · Global → Workspace → Collection/folder → Request · SIMULATED</span></div>}{response?.scriptError&&<p role="alert">Post-response script: {response.scriptError}. HTTP response was preserved.</p>}{response?.scripts?.map((result,index)=><div key={index} aria-label="Script assertions">{result.assertions.map((item,i)=><p key={i}>{item.passed?"PASS":"FAIL"} · {item.name}</p>)}</div>)}{sendError && <p className="tool-error" role="alert">{sendError}</p>}<div className="api-workspace">
      <div className="api-editor" style={{ width: responseCollapsed ? '100%' : `${editorWidth}%` }}>
        <div className="panel-heading">{subtab === 'Body' ? 'REQUEST BODY' : subtab === 'Authorization' ? 'AUTHORIZATION' : subtab === 'Query' || subtab === 'Headers' ? 'KEY / VALUE' : subtab.toUpperCase()}<span>{subtab === 'Query' || subtab === 'Headers' ? 'Edit locally' : http.native?'Native request':'Preview'}</span></div>
        <div className="pair-editor" key={subtab}>
          {subtab === 'Query' || subtab === 'Headers' ? <KeyValueGrid key={field} label={field==='params'?'query parameter':'header'} rows={rows} onChange={next=>update({[field]:next})}/>
            : subtab === 'Body' ? <><RequestBodyEditor native={http.native} body={draft.body} mode={draft.bodyMode??'Text'} file={bodyFile} onFile={setBodyFile} onChange={update}/>{http.native&&draft.bodyMode==='Multipart draft'&&<MultipartFiles files={multipartFiles} onChange={setMultipartFiles} disabled={sending}/>}</>
            : subtab === 'Authorization' ? <div className="api-field-body"><select aria-label="Auth type" value={draft.authMode ?? "Raw"} onChange={e => update({ authMode: e.target.value })}>{["None","Raw","Bearer","Basic","Digest draft","OAuth 2 token","API key"].map(v => <option key={v}>{v}</option>)}</select>{['Basic','Digest draft'].includes(draft.authMode??'')?<><input aria-label="Auth username" autoComplete="off" placeholder="Username (memory only)" value={authUser} onChange={e=>setAuthUser(e.target.value)}/><input aria-label="Auth password" type="password" autoComplete="off" placeholder="Password (memory only)" value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/></>:draft.authMode==='API key'?<><input aria-label="API key header name" value={apiKeyName} onChange={e=>setApiKeyName(e.target.value)}/><input aria-label="API key value" type="password" autoComplete="off" value={apiKeyValue} onChange={e=>setApiKeyValue(e.target.value)}/></>:<input className="auth-input" type="password" autoComplete="off" aria-label="Authorization value" placeholder="Bearer … (never saved)" value={draft.auth} onChange={(event) => update({ auth: event.target.value })}/>}{draft.authMode==='Digest draft'&&<p>Native Digest makes one challenge retry within the run timeout. File/multipart streams reopen for qop=auth; auth-int-only stream challenges are rejected. Redirects are disabled; stale-nonce retries are pending. Preview does not authenticate.</p>}{draft.authMode==='OAuth 2 token'&&<OAuthPanel native={http.native} onToken={token=>update({auth:token})}/>}<p className="auth-note">Auth and common credential headers are excluded from local saves and session drafts. Review body and notes before saving.</p></div>
              : subtab === 'Cookies' ? <div className="api-field-body"><textarea aria-label="Request cookies" value={cookies} onChange={e => setCookies(e.target.value)} placeholder="name=value; other=value"/><p>Cookie draft stays in memory and is excluded from saves.</p></div> : subtab === 'Script' ? <ScriptEditor draft={draft} onChange={update} native={http.native}/>
                : subtab === 'Docs' ? <div className="api-field-body"><p>Local notes for this request.</p><textarea aria-label="Request documentation" placeholder="Describe this endpoint, examples, and expected results" value={draft.docs ?? ''} onChange={(event) => update({ docs: event.target.value })}/></div>
                  : <div className="api-settings">{http.native&&<NativeHttpOptions draft={draft} onChange={update} workspaceId={http.workspaceId}/>}<VariableEditor label="Request variables" rows={draft.variables ?? []} onChange={variables => update({ variables })}/><label>HTTP protocol<select aria-label="Request HTTP protocol" value={draft.protocol??'Automatic'} onChange={e=>update({protocol:e.target.value})}>{['Automatic','HTTP/1.1','HTTP/2','HTTP/3'].map(v=><option key={v}>{v}</option>)}</select></label><label><UiText text={"Timeout (ms)"}/><input aria-label="Request timeout" type="number" min={100} max={120000} value={draft.timeoutMs ?? 30000} onChange={(event) => update({ timeoutMs: Number(event.target.value) })}/></label><label><input type="checkbox" checked={draft.followRedirects ?? true} onChange={(event) => update({ followRedirects: event.target.checked })}/> <UiText text={"Follow redirects"}/></label><p>{http.native?'Native transport settings are applied to Send HTTP and retained in native request documents.':'These settings are saved with the local draft. Mock Send does not use them.'}</p></div>}
        </div>
      </div>

      {!responseCollapsed && <div className="api-split-resizer" role="separator" aria-label="Resize API editor and response" aria-orientation="vertical" aria-valuenow={editorWidth} aria-valuemin={30} aria-valuemax={75} tabIndex={0} onPointerDown={startResize} onDoubleClick={() => setEditorWidth(48)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setEditorWidth((value) => Math.max(30, value - 2)); if (event.key === 'ArrowRight') setEditorWidth((value) => Math.min(75, value + 2)); }}/>}<button className="api-response-toggle" onClick={() => setResponseCollapsed((value) => !value)}>{responseCollapsed ? 'Show response pane' : 'Hide response pane'}</button>
      {!responseCollapsed && <div className="api-response">
        <div className="panel-heading">RESPONSE {response && <span className="mock-flag">{response.simulated?'SIMULATED':'NATIVE HTTP'}</span>}</div>
        {response ? <div className="mock-resp">
          <div className="mock-status">
            <span className={`code ${response.status >= 400 ? 'err' : ''}`}>{response.status} {response.statusText}</span>
            <span className="meta">{response.durationMs} ms</span>
            <span className="meta">{response.size}</span>
            <button className="outline-button" onClick={copyBody}><Copy size={14}/> <UiText text={"Copy"}/></button>
          </div>
          {response.native&&<ResponseExport body={response.native.body}/>} {response.native && <p style={{overflowWrap:'anywhere'}}>Run {response.native.runId} · {response.native.protocol} · {response.native.finalUrl}</p>}{response.native?.previewTruncated && <p>Preview shows the first 64 KiB. Full bytes are stored in the body file referenced by this run.</p>}<div className="api-response-tabs">{(['Body','Headers','Timing'] as const).map((name) => <button key={name} className={responseTab === name ? 'active' : ''} onClick={() => setResponseTab(name)}><UiText text={name}/></button>)}</div>
          {responseTab === 'Headers' ? <div className="mock-headers">{response.headers.map((h) => <div className="kv-row" key={`${h.key}-${response.headers.indexOf(h)}`}><span className="kv-key">{h.key}</span><span className="kv-val">{h.value}</span></div>)}</div> : responseTab === 'Timing' ? <div className="api-timing"><strong>{response.durationMs} ms</strong>{response.native?.timings&&<><span>Through response headers: {response.native.timings.headersMs} ms (includes Digest challenge when used)</span><span>Body download and file finalization: {response.native.timings.bodyMs} ms</span><span>DNS, TCP and TLS phases are not separately measured.</span></>}<span>{response.simulated?'Simulated duration · no network timing captured.':`Total native duration · ${response.native?.protocol} · ${response.native?.finalUrl}`}</span></div> : response.body ? <div><select aria-label="Response view" value={responseMode} onChange={e => setResponseMode(e.target.value)}>{["Text","JSON","Hex"].map(v => <option key={v}>{v}</option>)}</select><pre className="mock-body">{responseMode === "Hex" ? Array.from(response.native?Uint8Array.from(atob(response.native.previewBase64),value=>value.charCodeAt(0)):new TextEncoder().encode(response.body), b => b.toString(16).padStart(2,"0")).join(" ") : responseMode === "JSON" ? formatResponseJson(response.body) : response.body}</pre></div> : <div className="editor-empty"><Check size={18}/><h3><UiText text={"No body"}/></h3><p>{response.simulated?'This simulated status returns an empty response.':'The native response contains no body.'}</p></div>}
        </div> : <div className="response-empty"><ArrowUpRight size={22}/><h3><UiText text={"No response yet"}/></h3><p>{http.native?'Select a native workspace and Send HTTP to contact the entered URL.':'Press Send mock for a simulated response.'}</p></div>}
      </div>}
    </div>
  </div>;
}
