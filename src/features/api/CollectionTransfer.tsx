import { UiText } from '../localization';
import { ApiFormatTransfer } from './ApiFormatTransfer';
import { sanitizeVariables, validateVariables } from '../environments/resolution';
import { useDialogFocus } from '../../shell/useDialogFocus';
import { useRef, useState } from 'react';
import { readCollections, writeCollections, type ApiCollection, type ApiProfile, type RequestConfig } from './collections';
const sensitive = (key: string) => /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key.trim());
function validateConfig(raw: unknown): RequestConfig | undefined {
  if (raw === undefined) return undefined;
  const value = raw as RequestConfig;
  if (!value || !Array.isArray(value.params) || value.params.length > 1000 || value.params.some(row => !row || typeof row.key !== 'string' || typeof row.value !== 'string' || typeof row.enabled !== 'boolean')) throw Error('Invalid profile query parameters.');
  for (const field of ['bodyMode','script','testScript','docs','protocol','proxyUrl','customCaPem'] as const) if (value[field] !== undefined && typeof value[field] !== 'string') throw Error(`Invalid profile ${field}.`);
  if (value.timeoutMs !== undefined && (!Number.isFinite(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 120000)) throw Error('Invalid profile timeout.');
  if (value.followRedirects !== undefined && typeof value.followRedirects !== 'boolean') throw Error('Invalid profile redirects setting.');
  for (const field of ['tlsVerify','cookiesEnabled'] as const) if (value[field] !== undefined && typeof value[field] !== 'boolean') throw Error('Invalid TLS or cookies setting.');
  return { params: value.params.map((row, i) => ({ id: i + 1, key: row.key, value: row.value, enabled: row.enabled })), bodyMode: value.bodyMode, script: value.script, testScript: value.testScript, docs: value.docs, protocol: value.protocol, timeoutMs: value.timeoutMs, followRedirects: value.followRedirects, proxyUrl:value.proxyUrl, customCaPem:value.customCaPem, tlsVerify:value.tlsVerify, cookiesEnabled:value.cookiesEnabled };
}
export function validateCollections(text: string): ApiCollection[] {
  const raw = JSON.parse(text); if(!Array.isArray(raw)&&raw.version!==1)throw Error("Unsupported Traffic Studio collection version.");
  const list = Array.isArray(raw) ? raw : raw.collections;
  if (!Array.isArray(list) || list.length > 500) throw Error('Expected a collections array (maximum 500 collections).');
  const ids=new Map<string,string>();for(const item of list){if(item?.id){if(ids.has(item.id))throw Error('Duplicate collection IDs.');ids.set(item.id,crypto.randomUUID());}}
  for(const item of list){const seen=new Set<string>();let node=item;while(node?.parentId){if(seen.has(node.parentId))throw Error('Folder hierarchy contains a cycle.');seen.add(node.parentId);node=list.find((v:{id:string})=>v.id===node.parentId);}}
  return list.map((item: Record<string, unknown>) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.profiles) || item.profiles.length > 2000) throw Error('Each collection needs a name and profiles array.');
    const profiles = item.profiles.map((p: Record<string, unknown>): ApiProfile => {
      if (!p || typeof p.name !== 'string' || typeof p.method !== 'string' || !/^[A-Z-]{1,30}$/.test(p.method) || typeof p.url !== 'string' || (p.headers !== undefined && !Array.isArray(p.headers))) throw Error('Invalid profile name, method, URL or headers.');
      const headers = (p.headers as { key: string; value: string }[] ?? []).map(h => { if (!h || typeof h.key !== 'string' || typeof h.value !== 'string') throw Error('Headers must contain string key/value pairs.'); return { key: h.key, value: h.value }; }).filter(h => !sensitive(h.key));
      return { id: crypto.randomUUID(), name: p.name, method: p.method, url: p.url, headers, body: typeof p.body === 'string' ? p.body : '', notes: typeof p.notes === 'string' ? p.notes : '', variables: validateVariables(p.variables), requestConfig: validateConfig(p.requestConfig) };
    });
    const parentId=typeof item.parentId==='string'?ids.get(item.parentId):null;if(item.parentId&&!parentId)throw Error('Missing parent folder.');if(item.id===item.parentId)throw Error('A folder cannot contain itself.');return { id:typeof item.id==='string'?ids.get(item.id)!:crypto.randomUUID(), name:item.name,profiles,parentId,variables:validateVariables(item.variables) };
  });
}
export function CollectionTransfer({ onClose }: { onClose: () => void }) {
  const dialogRoot=useRef<HTMLDivElement>(null); useDialogFocus(dialogRoot,onClose);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ApiCollection[] | null>(null);
  const [error, setError] = useState('');
  return <div className="settings-backdrop"><div ref={dialogRoot} className="layout-manager" role="dialog" aria-modal="true" aria-label="Import export collections"><ApiFormatTransfer/><h2>Traffic Studio Collections JSON</h2><p>Imports append new IDs after validation. Existing collections are preserved. Credential headers are stripped; review body and notes.</p><textarea aria-label="Collections JSON" value={text} style={{ width: '100%', height: 220, background: '#303030', color: '#ddd' }} onChange={e => { setText(e.target.value); setPreview(null); setError(''); }}/><div><button onClick={() => { try { setPreview(validateCollections(text)); setError(''); } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : 'Invalid JSON'); } }}><UiText text={"Validate import"}/></button><button onClick={() => { const collections = readCollections().map(c => ({ ...c, variables: sanitizeVariables(c.variables), profiles: c.profiles.map(p => ({ ...p, variables: sanitizeVariables(p.variables), headers: p.headers.filter(h => !sensitive(h.key)) })) })); setText(JSON.stringify({ version: 1, collections }, null, 2)); setPreview(null); }}><UiText text={"Prepare export"}/></button><button disabled={!text} onClick={async () => { try { await navigator.clipboard.writeText(text); setError('JSON copied.'); } catch { setError('Clipboard unavailable; select the JSON manually.'); } }}><UiText text={"Copy JSON"}/></button></div>{preview && <div><p>{preview.length} collections · {preview.reduce((n, c) => n + c.profiles.length, 0)} profiles ready to append.</p><button onClick={() => { try { writeCollections([...readCollections(), ...preview]); setPreview(null); setError('Import complete locally.'); } catch { setError('Import failed. Browser storage is unavailable or full.'); } }}>Import validated collections</button></div>}{error && <p role="status">{error}</p>}<button onClick={onClose}><UiText text={"Close"}/></button></div></div>;
}
