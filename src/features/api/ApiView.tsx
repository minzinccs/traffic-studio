import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Database, Plus, Save, Trash2 } from 'lucide-react';
import type { MockResponse } from '../../domain/types';
import { sendMockRequest } from '../../bridge/mockBridge';
import { readProfile, updateProfile } from './collections';
import './apiEditorExtras.css';

type Pair = { id: number; key: string; value: string; enabled: boolean };
type RequestDraft = { name: string; method: string; url: string; params: Pair[]; headers: Pair[]; body: string; auth: string; script?: string; docs?: string; timeoutMs?: number; followRedirects?: boolean };
const sensitiveHeader = (key: string) => /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key.trim());
const persistableDraft = (draft: RequestDraft): RequestDraft => ({ ...draft, auth: '', headers: draft.headers.filter((header) => !sensitiveHeader(header.key)) });
const blank: RequestDraft = { name: 'New request', method: 'GET', url: '', params: [{ id: 1, key: '', value: '', enabled: true }], headers: [{ id: 2, key: '', value: '', enabled: true }], body: '', auth: '' };
const storageKey = 'traffic-studio-api-requests';
function readSaved(): RequestDraft[] { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as RequestDraft[]; } catch { return []; } }

export function ApiView({ flash, requestName, profileId, tabId, onDirty }: { flash: (m: string) => void; requestName: string; profileId?: string; tabId: number; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<RequestDraft>(() => {
    try { const session = sessionStorage.getItem(`traffic-studio-api-draft-${tabId}`); if (session) return JSON.parse(session) as RequestDraft; } catch { /* fall back */ }
    const profile = profileId ? readProfile(profileId) : undefined;
    if (profile) return { name: profile.name, method: profile.method, url: profile.url, params: [{ id: 1, key: '', value: '', enabled: true }], headers: profile.headers.map((header, index) => ({ id: index + 2, ...header, enabled: true })), body: profile.body, auth: '' };
    return readSaved().find((item) => item.name === requestName) ?? { ...blank, name: requestName.startsWith('API ') ? 'New request' : requestName };
  });
  const [saved, setSaved] = useState<RequestDraft[]>(readSaved);
  const [subtab, setSubtab] = useState('Query');
  const [showCollection, setShowCollection] = useState(false);
  const [response, setResponse] = useState<MockResponse | null>(null);
  const [responseTab, setResponseTab] = useState<'Body' | 'Headers' | 'Timing'>('Body');
  const [editorWidth, setEditorWidth] = useState(() => { const saved = Number(localStorage.getItem('traffic-studio-api-editor-width')); return saved >= 30 && saved <= 75 ? saved : 48; });
  const [responseCollapsed, setResponseCollapsed] = useState(false);

  useEffect(() => { sessionStorage.setItem(`traffic-studio-api-draft-${tabId}`, JSON.stringify(persistableDraft(draft))); }, [draft, tabId]);
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
    if (!draft.url.trim()) { flash('Enter a URL first.'); return; }
    setResponse(sendMockRequest({ method: draft.method, url: draft.url, headers: draft.headers, body: draft.body }));
    flash('Response is a simulated mock — no real HTTP was sent.');
  };
  const copyBody = () => { if (response?.body) { void navigator.clipboard.writeText(response.body); flash('Copied response body.'); } };

  const activeHeaders = draft.headers.filter((h) => h.key.trim());
  const activeParams = draft.params.filter((p) => p.key.trim());

  return <div className="api-view">
    <div className="api-topline"><div><span className="eyebrow">{profileId ? 'COLLECTION PROFILE · LOCAL DRAFT' : 'API WORKSPACE · LOCAL DRAFT'}</span><input className="api-title-input" aria-label="Request name" value={draft.name} onChange={(event) => update({ name: event.target.value })}/></div>
      <div className="api-top-actions">
        <button className="outline-button" onClick={() => setShowCollection((value) => !value)}><Database size={15}/> Saved requests {saved.length > 0 && <span className="count-label">{saved.length}</span>}</button>
        <button className="outline-button" onClick={save}><Save size={15}/> Save locally</button>
        {profileId && <button className="outline-button" onClick={saveProfile}><Save size={15}/> Save to profile</button>}
      </div></div>
    {showCollection && <div className="collection-strip"><span>SAVED REQUESTS</span>{saved.length === 0 ? <small>No saved requests yet.</small> : saved.map((item) => <button key={item.name} onClick={() => { setDraft(item); setShowCollection(false); setResponse(null); onDirty(false); }}><strong>{item.method}</strong> {item.name}</button>)}</div>}

    <div className="request-compose">
      <select aria-label="HTTP method" className={`method-select method-${draft.method.toLowerCase()}`} value={draft.method} onChange={(event) => update({ method: event.target.value })}>{['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map((name) => <option key={name}>{name}</option>)}</select>
      <input aria-label="Request URL" placeholder="https://api.example.com/v1/resources" value={draft.url} onChange={(event) => update({ url: event.target.value })}/>
      <button className="primary-action" onClick={send}><ArrowUpRight size={16}/> Send</button>
    </div>

    <div className="request-tabs">{['Query','Headers','Body','Authorization','Script','Docs','Settings'].map((name) => <button className={subtab === name ? 'active' : ''} key={name} onClick={() => setSubtab(name)}>{name}{(name === 'Query' || name === 'Headers') && <small>{(name === 'Query' ? activeParams : activeHeaders).length}</small>}</button>)}</div>

    <div className="api-workspace">
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
            <button className="pair-add" onClick={addRow}><Plus size={14}/> Add {subtab.toLowerCase().slice(0, -1)}</button>
          </> : subtab === 'Body' ? <label className="api-field-body"><textarea spellCheck={false} aria-label="Request body" placeholder={'{\n  "key": "value"\n}'} value={draft.body} onChange={(event) => update({ body: event.target.value })}/></label>
            : subtab === 'Authorization' ? <div className="api-field-body"><input className="auth-input" aria-label="Authorization value" placeholder="Bearer … (never saved)" value={draft.auth} onChange={(event) => update({ auth: event.target.value })}/><p className="auth-note">Auth and common credential headers are excluded from local saves and session drafts. Review body and notes before saving.</p></div>
              : subtab === 'Script' ? <div className="api-field-body"><p>Script draft only. Execution needs the API core.</p><textarea aria-label="Request script draft" spellCheck={false} placeholder="// Add a pre-request or test script" value={draft.script ?? ''} onChange={(event) => update({ script: event.target.value })}/></div>
                : subtab === 'Docs' ? <div className="api-field-body"><p>Local notes for this request.</p><textarea aria-label="Request documentation" placeholder="Describe this endpoint, examples, and expected results" value={draft.docs ?? ''} onChange={(event) => update({ docs: event.target.value })}/></div>
                  : <div className="api-settings"><label>Timeout (ms)<input aria-label="Request timeout" type="number" min={100} max={120000} value={draft.timeoutMs ?? 30000} onChange={(event) => update({ timeoutMs: Number(event.target.value) })}/></label><label><input type="checkbox" checked={draft.followRedirects ?? true} onChange={(event) => update({ followRedirects: event.target.checked })}/> Follow redirects</label><p>These settings are saved with the local draft. Mock Send does not use them.</p></div>}
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
          {responseTab === 'Headers' ? <div className="mock-headers">{response.headers.map((h) => <div className="kv-row" key={h.key}><span className="kv-key">{h.key}</span><span className="kv-val">{h.value}</span></div>)}</div> : responseTab === 'Timing' ? <div className="api-timing"><strong>{response.durationMs} ms</strong><span>Simulated duration · no network timing captured.</span></div> : response.body ? <pre className="mock-body">{response.body}</pre> : <div className="editor-empty"><Check size={18}/><h3>No body</h3><p>This simulated status returns an empty response.</p></div>}
        </div> : <div className="response-empty"><ArrowUpRight size={22}/><h3>No response yet</h3><p>Press Send to receive a simulated response. No real request leaves this device.</p></div>}
      </div>}
    </div>
  </div>;
}
