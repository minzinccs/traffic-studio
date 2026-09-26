import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Database, Plus, Save, Trash2 } from 'lucide-react';
import type { MockResponse } from '../../domain/types';
import { sendMockRequest } from '../../bridge/mockBridge';
import { readProfile, updateProfile } from './collections';
import './apiEditorExtras.css';
import { CurlImport } from './CurlImport';
import { readPreferences } from '../settings/preferences';
import { readEnvironmentRows } from '../environments/environments';


type Pair = { id: number; key: string; value: string; enabled: boolean };
type RequestDraft = { name: string; method: string; url: string; params: Pair[]; headers: Pair[]; body: string; auth: string; script?: string; docs?: string; timeoutMs?: number; followRedirects?: boolean; bodyMode?: string; authMode?: string; protocol?: string; testScript?: string };
const sensitiveHeader = (key: string) => /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key.trim());
const persistableDraft = (draft: RequestDraft): RequestDraft => ({ ...draft, auth: '', headers: draft.headers.filter((header) => !sensitiveHeader(header.key)) });
const blank: RequestDraft = { name: 'New request', method: 'GET', url: '', params: [{ id: 1, key: '', value: '', enabled: true }], headers: [{ id: 2, key: '', value: '', enabled: true }], body: '', auth: '' };
const storageKey = 'traffic-studio-api-requests';
function readSaved(): RequestDraft[] { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as RequestDraft[]; } catch { return []; } }

export function ApiView({ flash, requestName, profileId, tabId, onDirty, environment = 'Global' }: { flash: (m: string) => void; requestName: string; profileId?: string; tabId: number; onDirty: (dirty: boolean) => void; environment?: string }) {
  const [draft, setDraft] = useState<RequestDraft>(() => {
    try { const session = sessionStorage.getItem(`traffic-studio-api-draft-${tabId}`) ?? localStorage.getItem(`traffic-studio-api-draft-${tabId}`); if (session) return JSON.parse(session) as RequestDraft; } catch { /* fall back */ }
    const profile = profileId ? readProfile(profileId) : undefined;
    if (profile) return { name: profile.name, method: profile.method, url: profile.url, params: [{ id: 1, key: '', value: '', enabled: true }], headers: profile.headers.map((header, index) => ({ id: index + 2, ...header, enabled: true })), body: profile.body, auth: '' };
    return readSaved().find((item) => item.name === requestName) ?? { ...blank, timeoutMs: readPreferences().api.timeout, followRedirects: readPreferences().api.redirects, name: requestName.startsWith('API ') ? 'New request' : requestName };
  });
  const [curlOpen, setCurlOpen] = useState(false);
  const [authUser,setAuthUser]=useState('');const [authPassword,setAuthPassword]=useState('');const [apiKeyName,setApiKeyName]=useState('X-API-Key');const [apiKeyValue,setApiKeyValue]=useState('');const [scriptPhase,setScriptPhase]=useState('Pre-request');
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
  const [response, setResponse] = useState<MockResponse | null>(null);
  const [responseTab, setResponseTab] = useState<'Body' | 'Headers' | 'Timing'>('Body');
  const [editorWidth, setEditorWidth] = useState(() => { const saved = Number(localStorage.getItem('traffic-studio-api-editor-width')); return saved >= 30 && saved <= 75 ? saved : 48; });
  const [responseCollapsed, setResponseCollapsed] = useState(false);

  useEffect(() => { const text=JSON.stringify(persistableDraft(draft)); sessionStorage.setItem(`traffic-studio-api-draft-${tabId}`,text);localStorage.setItem(`traffic-studio-api-draft-${tabId}`,text); }, [draft, tabId]);
  useEffect(() => { localStorage.setItem('traffic-studio-api-editor-width', String(editorWidth)); }, [editorWidth]);

  const update = (patch: Partial<RequestDraft>) => { setDraft((current) => ({ ...current, ...patch })); onDirty(true); };
  const field = subtab === 'Query' ? 'params' : 'headers';
  const rows = draft[field];
  const updateRow = (id: number, patch: Partial<Pair>) => update({ [field]: rows.map((row) => row.id === id ? { ...row, ...patch } : row) });
  const addRow = () => update({ [field]: [...rows, { id: Date.now(), key: '', value: '', enabled: true }] });
  const removeRow = (id: number) => update({ [field]: rows.filter((row) => row.id !== id) });
  const moveRow = (id: number, direction: -1 | 1) => { const index = rows.findIndex((row) => row.id === id); const target = index + direction; if (target < 0 || target >= rows.length) return; const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; update({ [field]: next }); };
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => { event.preventDefault(); const start = event.clientX; const width = editorWidth; const total = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 800; const move = (next: PointerEvent) => setEditorWidth(Math.min(75, Math.max(30, width + (next.clientX - start) / total * 100))); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); };
  const save = () => {
    const name = draft.name.trim() || 'Untitled request';
    const updated = [...readSaved().filter((item) => item.name !== name), persistableDraft({ ...draft, name })];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setSaved(updated); update({ name }); onDirty(false);
    flash(`Saved “${name}” locally. Auth and credential headers were excluded.`);
  };
  const saveProfile = () => {
    if (!profileId) return;
    const current = readProfile(profileId);
    if (!current) { flash('This profile was removed from Collections.'); return; }
    const saved = updateProfile(profileId, { name: draft.name.trim() || 'Untitled profile', method: draft.method, url: draft.url, headers: draft.headers.filter((header) => header.enabled && header.key.trim() && !sensitiveHeader(header.key)).map(({ key, value }) => ({ key, value })), body: draft.body, notes: current.notes });
    if (saved) { onDirty(false); flash('API profile saved locally. Auth and credential headers were excluded.'); }
  };
  const send = () => {
    setSendError('');
    const variables = { ...(Object.fromEntries((readEnvironmentRows().Global ?? []).filter(v=>!v.secret||v.value).map(v => [v.key, v.value]))), ...Object.fromEntries((readEnvironmentRows()[environment] ?? []).filter(v=>!v.secret||v.value).map(v => [v.key, v.value])) };
    const unresolved = new Set<string>();
    const interpolate = (text: string) => text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => { const value = variables[key.trim()]; if (!Object.hasOwn(variables,key.trim()) || value === undefined) { unresolved.add(key.trim()); return `{{${key}}}`; } return value; });
    let url: URL;
    try { url = new URL(interpolate(draft.url)); if (!['http:','https:'].includes(url.protocol)) throw Error(); } catch { setSendError(unresolved.size ? `Unresolved variables: ${[...unresolved].join(', ')}` : 'Enter a valid http(s) URL.'); return; }
    draft.params.filter(p => p.enabled && p.key).forEach(p => url.searchParams.append(interpolate(p.key), interpolate(p.value)));
    const headers = draft.headers.filter(h => h.enabled && h.key).map(h => ({ key: h.key, value: interpolate(h.value) }));
    const body = draft.bodyMode === 'None' ? '' : interpolate(draft.body);
    if (unresolved.size) { setSendError(`Unresolved variables: ${[...unresolved].join(', ')}`); return; }
    if (draft.bodyMode === 'JSON' && body) { try { JSON.parse(body); } catch { setSendError('Request body is not valid JSON.'); return; } }
    if(draft.authMode==='Basic')headers.push({key:'Authorization',value:`Basic ${btoa(Array.from(new TextEncoder().encode(`${authUser}:${authPassword}`),b=>String.fromCharCode(b)).join(''))}`});if(draft.authMode==='API key'&&apiKeyName&&apiKeyValue)headers.push({key:apiKeyName,value:apiKeyValue});
    if (draft.auth && !['None','Basic','API key','Digest draft'].includes(draft.authMode??'')) headers.push({ key: 'Authorization', value: ['Bearer','OAuth 2 token'].includes(draft.authMode??'') ? `Bearer ${draft.auth}` : draft.auth });
    if (cookies) headers.push({ key: 'Cookie', value: cookies });
    setSending(true); setResponse(null);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      if (scenario === 'Network error') { setSendError('Simulated network error. No HTTP request was sent. Change the scenario and retry.'); flash('Simulated request failed.'); return; }
      const result = sendMockRequest({ method: draft.method, url: url.toString(), headers, body });
      if (scenario === 'HTTP 500') { result.status = 500; result.statusText = 'Internal Server Error'; result.body = '{"simulated":true,"error":"server_error"}'; }
      setResponse(result); flash('Response is simulated — no real HTTP was sent.');
    }, 350);
  };
  const cancel = () => { window.clearTimeout(sendTimer.current); setSending(false); setSendError('Mock request cancelled.'); };
  const copyBody = async () => {if(response?.body){try{await navigator.clipboard.writeText(response.body);flash('Copied response body.');}catch{flash('Clipboard unavailable. Select the response text manually.');}}};

  const activeHeaders = draft.headers.filter((h) => h.key.trim());
  const activeParams = draft.params.filter((p) => p.key.trim());

  return <div className="api-view">{curlOpen && <CurlImport onClose={() => setCurlOpen(false)} onApply={v => update({ ...v, params:[], headers: v.headers.map((h,i) => ({ ...h, id: Date.now()+i, enabled:true })) })}/>}
    <div className="api-topline"><div><span className="eyebrow">{profileId ? 'COLLECTION PROFILE · LOCAL DRAFT' : 'API WORKSPACE · LOCAL DRAFT'}</span><input className="api-title-input" aria-label="Request name" value={draft.name} onChange={(event) => update({ name: event.target.value })}/></div>
      <div className="api-top-actions">
        <button className="outline-button" onClick={() => setShowCollection((value) => !value)}><Database size={15}/> Saved requests {saved.length > 0 && <span className="count-label">{saved.length}</span>}</button>
        <button className="outline-button" onClick={() => setCurlOpen(true)}>Import cURL</button><button className="outline-button" onClick={save}><Save size={15}/> Save locally</button>
        {profileId && <button className="outline-button" onClick={saveProfile}><Save size={15}/> Save to profile</button>}
      </div></div>
    {showCollection && <div className="collection-strip"><span>SAVED REQUESTS</span>{saved.length === 0 ? <small>No saved requests yet.</small> : saved.map((item) => <button key={item.name} onClick={() => { setDraft(item); setShowCollection(false); setResponse(null); onDirty(false); }}><strong>{item.method}</strong> {item.name}</button>)}</div>}

    <div className="request-compose">
      <select aria-label="HTTP method" className={`method-select method-${draft.method.toLowerCase()}`} value={draft.method} onChange={(event) => update({ method: event.target.value })}>{Array.from(new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS', draft.method])).map((name) => <option key={name}>{name}</option>)}</select>
      <input aria-label="Custom HTTP method" title="Custom method" style={{ width: 70, flex: "none" }} value={draft.method} onChange={e => update({ method: e.target.value.toUpperCase().replace(/[^A-Z-]/g, "") })}/><input aria-label="Request URL" placeholder="https://api.example.com/v1/resources" value={draft.url} onChange={(event) => update({ url: event.target.value })}/>
      <button className="primary-action" disabled={sending || !draft.method} onClick={send}><ArrowUpRight size={16}/> {sending ? "Sending mock…" : "Send mock"}</button>{sending && <button className="outline-button" onClick={cancel}>Cancel</button> }
    </div>

    <div className="request-tabs">{['Query','Headers','Body','Authorization','Cookies','Script','Docs','Settings'].map((name) => <button className={subtab === name ? 'active' : ''} key={name} onClick={() => setSubtab(name)}>{name}{(name === 'Query' || name === 'Headers') && <small>{(name === 'Query' ? activeParams : activeHeaders).length}</small>}</button>)}</div>

    <div className="api-preview-controls"><label>Mock scenario <select value={scenario} onChange={e => setScenario(e.target.value)}>{["Success","HTTP 500","Network error"].map(v => <option key={v}>{v}</option>)}</select></label><span>Environment: {environment} · SIMULATED</span></div>{sendError && <p className="tool-error" role="alert">{sendError}</p>}<div className="api-workspace">
      <div className="api-editor" style={{ width: responseCollapsed ? '100%' : `${editorWidth}%` }}>
        <div className="panel-heading">{subtab === 'Body' ? 'REQUEST BODY' : subtab === 'Authorization' ? 'AUTHORIZATION' : subtab === 'Query' || subtab === 'Headers' ? 'KEY / VALUE' : subtab.toUpperCase()}<span>{subtab === 'Query' || subtab === 'Headers' ? 'Edit locally' : 'Preview'}</span></div>
        <div className="pair-editor" key={subtab}>
          {subtab === 'Query' || subtab === 'Headers' ? <>
            <div className="pair-head"><span></span><span>KEY</span><span>VALUE</span><span>ACTIONS</span></div>
            {rows.map((row) => <div className="pair-row" key={row.id}>
              <input type="checkbox" checked={row.enabled} aria-label={`Enable ${row.key}`} onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}/>
              <input placeholder="key" value={row.key} onChange={(event) => updateRow(row.id, { key: event.target.value })}/>
              <input placeholder="value" value={row.value} onChange={(event) => updateRow(row.id, { value: event.target.value })}/>
              <div className="pair-row-actions"><button title="Move row up" aria-label="Move row up" onClick={() => moveRow(row.id, -1)}>↑</button><button title="Move row down" aria-label="Move row down" onClick={() => moveRow(row.id, 1)}>↓</button><button title="Remove row" aria-label="Remove row" onClick={() => removeRow(row.id)}><Trash2 size={13}/></button></div>
            </div>)}
            <button className="pair-add" onClick={addRow}><Plus size={14}/> Add {subtab==='Query'?'query parameter':'header'}</button>
          </> : subtab === 'Body' ? <label className="api-field-body"><select aria-label="Body type" value={draft.bodyMode ?? 'Text'} onChange={e => update({ bodyMode: e.target.value })}>{['None','Text','JSON','XML','Form URL encoded','Multipart draft'].map(v => <option key={v}>{v}</option>)}</select><textarea disabled={draft.bodyMode === 'None'} spellCheck={false} aria-label="Request body" placeholder={'{\n  "key": "value"\n}'} value={draft.body} onChange={(event) => update({ body: event.target.value })}/></label>
            : subtab === 'Authorization' ? <div className="api-field-body"><select aria-label="Auth type" value={draft.authMode ?? "Raw"} onChange={e => update({ authMode: e.target.value })}>{["None","Raw","Bearer","Basic","Digest draft","OAuth 2 token","API key"].map(v => <option key={v}>{v}</option>)}</select>{['Basic','Digest draft'].includes(draft.authMode??'')?<><input aria-label="Auth username" autoComplete="off" placeholder="Username (memory only)" value={authUser} onChange={e=>setAuthUser(e.target.value)}/><input aria-label="Auth password" type="password" autoComplete="off" placeholder="Password (memory only)" value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/></>:draft.authMode==='API key'?<><input aria-label="API key header name" value={apiKeyName} onChange={e=>setApiKeyName(e.target.value)}/><input aria-label="API key value" type="password" autoComplete="off" value={apiKeyValue} onChange={e=>setApiKeyValue(e.target.value)}/></>:<input className="auth-input" type="password" autoComplete="off" aria-label="Authorization value" placeholder="Bearer … (never saved)" value={draft.auth} onChange={(event) => update({ auth: event.target.value })}/>}{draft.authMode==='Digest draft'&&<p>Digest challenge/response is a configuration preview and requires the native HTTP client.</p>}<p className="auth-note">Auth and common credential headers are excluded from local saves and session drafts. Review body and notes before saving.</p></div>
              : subtab === 'Cookies' ? <div className="api-field-body"><textarea aria-label="Request cookies" value={cookies} onChange={e => setCookies(e.target.value)} placeholder="name=value; other=value"/><p>Cookie draft stays in memory and is excluded from saves.</p></div> : subtab === 'Script' ? <div className="api-field-body"><p>Script draft only. Execution needs the API core.</p><select aria-label="Script phase" value={scriptPhase} onChange={e=>setScriptPhase(e.target.value)}><option>Pre-request</option><option>Tests</option></select><textarea aria-label="Request script draft" spellCheck={false} placeholder="// Add a pre-request or test script" value={scriptPhase==='Tests'?draft.testScript??'':draft.script??''} onChange={event=>update(scriptPhase==='Tests'?{testScript:event.target.value}:{script:event.target.value})}/></div>
                : subtab === 'Docs' ? <div className="api-field-body"><p>Local notes for this request.</p><textarea aria-label="Request documentation" placeholder="Describe this endpoint, examples, and expected results" value={draft.docs ?? ''} onChange={(event) => update({ docs: event.target.value })}/></div>
                  : <div className="api-settings"><label>HTTP protocol<select aria-label="Request HTTP protocol" value={draft.protocol??'Automatic'} onChange={e=>update({protocol:e.target.value})}>{['Automatic','HTTP/1.1','HTTP/2','HTTP/3'].map(v=><option key={v}>{v}</option>)}</select></label><label>Timeout (ms)<input aria-label="Request timeout" type="number" min={100} max={120000} value={draft.timeoutMs ?? 30000} onChange={(event) => update({ timeoutMs: Number(event.target.value) })}/></label><label><input type="checkbox" checked={draft.followRedirects ?? true} onChange={(event) => update({ followRedirects: event.target.checked })}/> Follow redirects</label><p>These settings are saved with the local draft. Mock Send does not use them.</p></div>}
        </div>
      </div>

      {!responseCollapsed && <div className="api-split-resizer" role="separator" aria-label="Resize API editor and response" aria-orientation="vertical" aria-valuenow={editorWidth} aria-valuemin={30} aria-valuemax={75} tabIndex={0} onPointerDown={startResize} onDoubleClick={() => setEditorWidth(48)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setEditorWidth((value) => Math.max(30, value - 2)); if (event.key === 'ArrowRight') setEditorWidth((value) => Math.min(75, value + 2)); }}/>}<button className="api-response-toggle" onClick={() => setResponseCollapsed((value) => !value)}>{responseCollapsed ? 'Show response pane' : 'Hide response pane'}</button>
      {!responseCollapsed && <div className="api-response">
        <div className="panel-heading">RESPONSE {response && <span className="mock-flag">SIMULATED</span>}</div>
        {response ? <div className="mock-resp">
          <div className="mock-status">
            <span className={`code ${response.status >= 400 ? 'err' : ''}`}>{response.status} {response.statusText}</span>
            <span className="meta">{response.durationMs} ms</span>
            <span className="meta">{response.size}</span>
            <button className="outline-button" onClick={copyBody}><Copy size={14}/> Copy</button>
          </div>
          <div className="api-response-tabs">{(['Body','Headers','Timing'] as const).map((name) => <button key={name} className={responseTab === name ? 'active' : ''} onClick={() => setResponseTab(name)}>{name}</button>)}</div>
          {responseTab === 'Headers' ? <div className="mock-headers">{response.headers.map((h) => <div className="kv-row" key={h.key}><span className="kv-key">{h.key}</span><span className="kv-val">{h.value}</span></div>)}</div> : responseTab === 'Timing' ? <div className="api-timing"><strong>{response.durationMs} ms</strong><span>Simulated duration · no network timing captured.</span></div> : response.body ? <div><select aria-label="Response view" value={responseMode} onChange={e => setResponseMode(e.target.value)}>{["Text","JSON","Hex"].map(v => <option key={v}>{v}</option>)}</select><pre className="mock-body">{responseMode === "Hex" ? Array.from(new TextEncoder().encode(response.body), b => b.toString(16).padStart(2,"0")).join(" ") : response.body}</pre></div> : <div className="editor-empty"><Check size={18}/><h3>No body</h3><p>This simulated status returns an empty response.</p></div>}
        </div> : <div className="response-empty"><ArrowUpRight size={22}/><h3>No response yet</h3><p>Press Send to receive a simulated response. No real request leaves this device.</p></div>}
      </div>}
    </div>
  </div>;
}
