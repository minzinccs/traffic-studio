import { UiText } from '../localization';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import { entityKinds, type EntityKind, type RuntimeInfo, type StoredEntity, type WorkspaceRecord } from '../../domain/workspace';
import './storage.css';
import { SelectField } from '../../shell/SelectField';
import { NativeResources } from './NativeResources';

export function RepositoryPanel() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [newName, setNewName] = useState('');
  const [kind, setKind] = useState<EntityKind>('request');
  const [entities, setEntities] = useState<StoredEntity[]>([]);
  const [selected, setSelected] = useState<StoredEntity | null>(null);
  const [name, setName] = useState('Untitled document');
  const [text, setText] = useState('{}');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revisionNotice, setRevisionNotice] = useState('');
  const [migration, setMigration] = useState<Record<string,string> | null>(null);
  const generation = useRef(0);
  const selection = useRef({ workspaceId, kind }); selection.current = { workspaceId, kind };
  const refresh = useCallback(async () => {
    const operation = ++generation.current;
    try {
      const [info, list] = await Promise.all([bridge.command('runtime_info', undefined), bridge.command('workspace_list', undefined)]);
      if (generation.current !== operation) return;
      setRuntime(info); setWorkspaces(list);
      const current = selection.current;
      if (current.workspaceId) {
        const rows = await bridge.command('entity_query', { workspaceId: current.workspaceId, kind: current.kind, limit: 200, offset: 0 });
        if (generation.current === operation) setEntities(rows);
      } else setEntities([]);
    } catch (error) { if (generation.current === operation) setMessage(bridgeError(error).message); }
  }, []);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh,workspaceId,kind]);
  useEffect(() => {
    let disposed = false; let stop: (() => void) | undefined;
    void bridge.onRevision(event => { if (event.workspaceId === selection.current.workspaceId || event.kind === 'workspace' || event.kind === 'migration') { setRevisionNotice('Storage changed. Reload a document before overwriting edits from another window.'); void refresh(); } }).then(unsubscribe => { if (disposed) unsubscribe(); else stop = unsubscribe; }).catch(error => setMessage(bridgeError(error).message));
    return () => { disposed = true; stop?.(); };
  }, [refresh]);
  async function action(run: () => Promise<void>) { setBusy(true); setMessage(''); try { await run(); } catch (error) { setMessage(bridgeError(error).message); } finally { setBusy(false); } }
  function mayLeave() { return !dirty || window.confirm('Discard unsaved repository editor changes?'); }
  function load(entity: StoredEntity | null) { if (!mayLeave()) return; setSelected(entity); setName(entity?.name ?? 'Untitled document'); setText(JSON.stringify(entity?.payload ?? {},null,2)); setDirty(false); setRevisionNotice(''); }
  function previewMigration() {
    try {
      const entries = Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('traffic-studio-')).map(key => [key,localStorage.getItem(key)!]));
      const size = new Blob(Object.values(entries)).size;
      if (size > 20 * 1024 * 1024) throw Error('Snapshot exceeds 20 MB. Export large sessions separately.');
      setMigration(entries); setMessage(`${Object.keys(entries).length} entries ready to archive. Source stays untouched. Auth/secret fields are removed, but URLs and bodies can contain private data.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read browser storage.'); }
  }
  return <section className="repository-panel"><h4><UiText text={"Repository and native bridge"}/></h4><p>{runtime?.message ?? 'Loading runtime capabilities…'}</p><div className="settings-status">{runtime ? `${runtime.mode.toUpperCase()} · ${runtime.mode === 'native' ? 'SQLite / file body store' : 'IndexedDB preview'} · engine disconnected` : 'Runtime unavailable'}</div><p>This repository is separate from legacy browser workspace snapshots. Existing editors remain browser-local until their repositories are migrated; archiving does not automatically switch their persistence.</p>
    <div className="repository-actions"><input aria-label="Repository workspace name" maxLength={80} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New repository workspace"/><button disabled={busy || !newName.trim()} onClick={()=>void action(async()=>{ const workspace=await bridge.command('workspace_create',{name:newName});setNewName('');await refresh();if(mayLeave()){setSelected(null);setDirty(false);setText('{}');setWorkspaceId(workspace.id);} })}><UiText text={"Create repository workspace"}/></button><button disabled={busy} onClick={()=>void refresh()}><UiText text={"Refresh repository"}/></button></div>
    <label><UiText text={"Repository workspace"}/><SelectField label="Repository workspace" value={workspaceId} options={[{value:'',label:'Select workspace'},...workspaces.map(w=>({value:w.id,label:w.name}))]} onChange={value=>{if(mayLeave()){setWorkspaceId(value);setSelected(null);setDirty(false);setText('{}');}}} /></label>
    <label><UiText text={"Record type"}/><SelectField label="Repository record type" value={kind} options={entityKinds.map(k=>({value:k,label:k}))} onChange={value=>{if(mayLeave()){setKind(value as EntityKind);setSelected(null);setDirty(false);setText('{}');}}} /></label>
    {workspaceId && <><div className="repository-actions"><button disabled={busy} onClick={()=>load(null)}><UiText text={"New document"}/></button>{entities.map(e=><button key={e.id} disabled={busy} aria-pressed={selected?.id===e.id} onClick={()=>load(e)}>{e.name} · r{e.revision}</button>)}</div>{!entities.length && <p>No records in this workspace/type. Create a document or archive a browser snapshot.</p>}<label><UiText text={"Document name"}/><input aria-label="Repository document name" value={name} maxLength={80} onChange={e=>{setName(e.target.value);setDirty(true);}}/></label><textarea aria-label="Repository document JSON" spellCheck={false} value={text} onChange={e=>{setText(e.target.value);setDirty(true);}}/><p>{dirty?'Unsaved changes':'Editor synchronized'} · JSON metadata limit 1 MB · Auth/secret values excluded</p><button disabled={busy || !name.trim()} onClick={()=>void action(async()=>{ const payload: unknown=JSON.parse(text);if(!payload || typeof payload!=='object' || Array.isArray(payload))throw Error('Document must be a JSON object.');const saved=await bridge.command('entity_save',{input:{workspaceId,id:selected?.id ?? crypto.randomUUID(),kind,name,expectedRevision:selected?.revision ?? 0,payload:payload as StoredEntity['payload']}});setSelected(saved);setText(JSON.stringify(saved.payload,null,2));setDirty(false);setMessage('Document committed.');await refresh(); })}><UiText text={"Save repository document"}/></button><button disabled={busy || !selected} onClick={()=>void action(async()=>{if(selected && mayLeave()){const latest=await bridge.command('entity_get',{workspaceId,id:selected.id});setSelected(latest);setName(latest.name);setText(JSON.stringify(latest.payload,null,2));setDirty(false);setRevisionNotice('');}})}><UiText text={"Reload document"}/></button></>}
    {revisionNotice && <p role="status">{revisionNotice}</p>}
    <h4><UiText text={"Browser → native migration archive"}/></h4><p>Preview first. Import creates a new native workspace with a sanitized, versioned browser archive; it does not delete the source or silently convert legacy records into production domain records.</p><button disabled={busy || runtime?.mode!=='native'} onClick={previewMigration}><UiText text={"Preview browser migration"}/></button>{migration && <><p>{Object.keys(migration).length} entries · {new Blob(Object.values(migration)).size.toLocaleString()} bytes</p><button disabled={busy} onClick={()=>void action(async()=>{const result=await bridge.command('migration_import',{input:{sourceId:`browser:${location.origin}`,name:'Browser migration archive',entries:migration}});setMigration(null);setMessage(result.alreadyImported?'This exact snapshot was already imported.':'Snapshot archived transactionally into a new native workspace.');setWorkspaceId(result.workspaceId);setKind('legacy_snapshot');await refresh();})}><UiText text={"Import archive into native workspace"}/></button><button onClick={()=>setMigration(null)}><UiText text={"Cancel migration"}/></button></>}
    <p role="status">{busy?'Saving…':message}</p><NativeResources workspaceId={workspaceId} native={runtime?.mode === 'native'}/></section>;
}
