import { useEffect,useRef,useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge,bridgeError } from '../../bridge';
import type { WorkspaceRecord } from '../../domain/workspace';
import { collectionDocuments } from './nativeDocuments';
import { importPostman,importOpenApi,exportPostman,type ImportPreview } from './adapters';
import { readCollections,writeCollections } from './collections';
export function ApiFormatTransfer(){
  const [format,setFormat]=useState('Postman v2.1 JSON');const [text,setText]=useState('');const [preview,setPreview]=useState<ImportPreview|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [workspaceId,setWorkspaceId]=useState('');const [workspaces,setWorkspaces]=useState<WorkspaceRecord[]>([]);const [target,setTarget]=useState<'browser'|'native'>('browser');const alive=useRef(true);
  useEffect(()=>{alive.current=true;if(isTauri())void bridge.command('workspace_list',undefined).then(rows=>{if(alive.current)setWorkspaces(rows);}).catch(e=>{if(alive.current)setError(bridgeError(e).message);});return()=>{alive.current=false;};},[]);
  function validate(){try{if(new Blob([text]).size>10*1024*1024)throw Error('File exceeds 10 MiB import limit.');const raw=JSON.parse(text);setPreview(format==='Postman v2.1 JSON'?importPostman(raw):importOpenApi(raw));setError('');}catch(e){setPreview(null);setError(e instanceof Error?e.message:'Invalid import.');}}
  async function apply(){if(!preview)return;setBusy(true);setError('');try{
    if(target==='browser')writeCollections([...readCollections(),...preview.collections]);
    else {if(!workspaceId)throw Error('Select a native workspace.');const documents=collectionDocuments(preview.collections,workspaceId);
      await bridge.command('entity_import',{input:{workspaceId,documents}});
    }
    if(alive.current){setPreview(null);setError(target==='native'?'Imported atomically to native repository. Select this workspace and load requests in the API editor.':'Imported to browser Collections.');}
  }catch(e){if(alive.current)setError(bridgeError(e).message);}finally{if(alive.current)setBusy(false);}}
  return <details className="api-format-transfer" aria-label="API format adapters"><summary>Postman / OpenAPI import and export</summary><p>JSON import is a reviewed conversion into request drafts. No URL is fetched and imported scripts never execute. Credentials/file paths are excluded; review bodies and URLs for private data.</p>
    <select aria-label="API import format" value={format} disabled={busy} onChange={e=>{setFormat(e.target.value);setPreview(null);}}><option>Postman v2.1 JSON</option><option>OpenAPI 3.0/3.1 JSON</option></select>
    <textarea aria-label="API format JSON" disabled={busy} value={text} onChange={e=>{setText(e.target.value);setPreview(null);}}/>
    <button disabled={busy||!text} onClick={validate}>Preview conversion</button><button disabled={busy} onClick={()=>{try{setText(JSON.stringify(exportPostman(readCollections()),null,2));setFormat('Postman v2.1 JSON');setPreview(null);setError('Postman export prepared from browser Collections; auth/scripts/native-only options excluded.');}catch(e){setError(bridgeError(e).message);}}}>Prepare Postman export</button>
    <select aria-label="Import storage target" disabled={busy} value={target} onChange={e=>setTarget(e.target.value as 'browser'|'native')}><option value="browser">Browser Collections</option><option value="native" disabled={!isTauri()}>Native SQLite repository</option></select>
    {target==='native'&&<select aria-label="API import native workspace" disabled={busy} value={workspaceId} onChange={e=>setWorkspaceId(e.target.value)}><option value="">Select workspace</option>{workspaces.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>}
    {preview&&<><p>{preview.format}: {preview.collections.length} folders · {preview.collections.reduce((sum,c)=>sum+c.profiles.length,0)} requests</p><ul>{preview.warnings.map((message,index)=><li key={index}>{message}</li>)}</ul><details><summary>Converted folders and requests</summary><ul>{preview.collections.map(c=><li key={c.id}>{c.name}<ul>{c.profiles.map(p=><li key={p.id}>{p.method} {p.name} · {p.url}</li>)}</ul></li>)}</ul></details><button disabled={busy||(target==='native'&&!workspaceId)} onClick={()=>void apply()}>Import reviewed drafts</button></>}
    {error&&<p role="status">{error}</p>}
  </details>;
}
