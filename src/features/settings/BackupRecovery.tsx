import { UiText } from '../localization';
import { validateVariables } from '../environments/resolution';
import { useState } from 'react';
import { validateCollections } from '../api/CollectionTransfer';
import { environmentNamesKey, environmentRowsKey, withoutSecretValues, type EnvironmentRows } from '../environments/environments';

type Recovery = { entries: Record<string, string>; ignored: string[]; summary: string };
export function validateBackup(text: string): Recovery {
  if (new Blob([text]).size > 5 * 1024 * 1024) throw Error('Document recovery supports backups up to 5 MB.');
  const raw = JSON.parse(text);
  if (raw?.version !== 1 || !raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) throw Error('Expected version 1 browser backup with an entries object.');
  const entries: Record<string, string> = {};
  const ignored: string[] = [];
  const recoveredDrafts: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(raw.entries)) {
    if (typeof value !== 'string') throw Error(`Invalid backup value: ${key}`);
    if (key === 'traffic-studio-api-collections-v1') {
      entries[key] = JSON.stringify(validateCollections(value));
      entries['traffic-studio-explorer-migrated-v1'] = 'true';
    } else if (key === environmentNamesKey) {
      const names = JSON.parse(value);
      if (!Array.isArray(names) || names.length > 1000 || !names.includes('Global') || names.some(n => typeof n !== 'string' || !n.trim()) || new Set(names).size !== names.length) throw Error('Invalid environment names.');
      entries[key] = JSON.stringify(names);
    } else if (key === environmentRowsKey) {
      const rows = JSON.parse(value);
      if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw Error('Invalid environment rows.');
      const validated: EnvironmentRows = {};
      for (const [name, variables] of Object.entries(rows)) {
        if (!Array.isArray(variables) || variables.length > 1000 || variables.some(row => !row || typeof row.key !== 'string' || typeof row.value !== 'string' || typeof row.secret !== 'boolean')) throw Error(`Invalid variables in ${name}.`);
        validated[name] = variables.map((row, i) => ({ id: i + 1, key: row.key, value: row.value, secret: row.secret }));
      }
      entries[key] = JSON.stringify(withoutSecretValues(validated));
    } else if (key === 'traffic-studio-api-requests' || /^traffic-studio-api-draft-\d+$/.test(key)) {
      const data = JSON.parse(value);
      const documents = key === 'traffic-studio-api-requests' ? data : [data];
      if (!Array.isArray(documents) || documents.length > 2000) throw Error('Invalid request documents.');
      const safe = documents.map(document => {
        if (!document || typeof document.name !== 'string' || typeof document.url !== 'string' || typeof document.body !== 'string' || typeof document.method !== 'string' || !/^[A-Z-]{1,30}$/.test(document.method)) throw Error('Invalid HTTP draft.');
        const pairs = (rows: unknown) => {
          if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row || typeof row.key !== 'string' || typeof row.value !== 'string' || typeof row.enabled !== 'boolean')) throw Error('Invalid request key/value rows.');
          return rows.map((row, i) => ({ id: i + 1, key: row.key, value: row.value, enabled: row.enabled }));
        };
        // Copy only validated document fields; auth, cookies and unknown fields stay out.
        return { name: document.name, method: document.method, url: document.url, body: document.body, auth: '', variables: validateVariables(document.variables), docs: typeof document.docs === 'string' ? document.docs : '', script: typeof document.script === 'string' ? document.script : '', testScript: typeof document.testScript === 'string' ? document.testScript : '', bodyMode: ['None','Text','JSON','XML','Form URL encoded','Multipart draft'].includes(document.bodyMode) ? document.bodyMode : 'Text', params: pairs(document.params), headers: pairs(document.headers).filter(h => !/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key.trim())) };
      });
      if (key === 'traffic-studio-api-requests') entries[key] = JSON.stringify(safe);
      else {
        recoveredDrafts.push(...safe.map(d => ({ ...d, name: `${d.name} (recovered ${key.split('-').at(-1)})` })));
      }
    } else ignored.push(key);
  }
  if (recoveredDrafts.length) entries['traffic-studio-api-requests'] = JSON.stringify([...JSON.parse(entries['traffic-studio-api-requests'] ?? '[]'), ...recoveredDrafts]);
  if (Boolean(entries[environmentNamesKey]) !== Boolean(entries[environmentRowsKey])) throw Error('Environment names and rows must be backed up together.');
  if (entries[environmentNamesKey]) {
    const names: string[] = JSON.parse(entries[environmentNamesKey]);
    const rows = JSON.parse(entries[environmentRowsKey]);
    if (names.some(name => !Object.hasOwn(rows, name))) throw Error('Missing environment rows.');
  }
  if (!Object.keys(entries).length) throw Error('No supported API documents, collections or environments in this backup.');
  return { entries, ignored, summary: `${Object.keys(entries).length} validated entries. Recovery creates a separate workspace; existing data is preserved.` };
}

export function BackupRecovery({ flash }: { flash: (message: string) => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Recovery | null>(null);
  const [message, setMessage] = useState('');
  function apply() {
    if (!preview) return;
    try {
      const key = 'ts-workspaces-v1';
      const registry = JSON.parse(localStorage.getItem(key) ?? '{"active":"default","items":[{"id":"default","name":"Main workspace","local":{},"session":{}}]}');
      if (!Array.isArray(registry.items) || registry.items.length >= 8 || !registry.items.some((w: { id: string }) => w.id === registry.active)) throw Error('Workspace registry is invalid or already has 8 workspaces.');
      registry.items.push({ id: crypto.randomUUID(), name: `Recovered ${new Date().toLocaleString()}`, local: preview.entries, session: {} });
      localStorage.setItem(key, JSON.stringify(registry));
      setPreview(null); setMessage('Recovered into a new workspace. Open Manage workspaces to switch; API drafts appear under Saved requests.');
      flash('Backup documents recovered into a separate workspace.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery failed. Storage may be full.'); }
  }
  return <section><h4><UiText text={"Recover documents from browser backup"}/></h4><p>Restores API drafts, collections and environments into a new workspace. Layout, traffic sessions, rules, tracker and preferences are skipped. Credential values are excluded; review bodies and URLs before sharing backups.</p><textarea aria-label="Browser backup JSON" value={text} onChange={e => { setText(e.target.value); setPreview(null); setMessage(''); }}/><button onClick={() => { try { const result = validateBackup(text); setPreview(result); setMessage(result.summary); } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'Invalid backup'); } }}><UiText text={"Validate backup"}/></button><button disabled={!preview} onClick={apply}><UiText text={"Recover into new workspace"}/></button>{preview && <p>Skipped {preview.ignored.length} entries: {preview.ignored.map(k => k.replace('traffic-studio-', '')).join(', ') || 'none'}</p>}<p role="status">{message}</p></section>;
}
