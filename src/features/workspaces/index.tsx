import { useEffect, useRef, useState } from 'react';
import App from '../../App';
import { useDialogFocus } from '../../shell/useDialogFocus';
import './workspaces.css';

type Workspace = { id:string; name:string; local:Record<string,string>; session:Record<string,string> };
type Registry = { active:string; items:Workspace[] };
const key='ts-workspaces-v1';
const empty=():Registry=>({active:'default',items:[{id:'default',name:'Main workspace',local:{},session:{}}]});
function read():Registry { try {const v=JSON.parse(localStorage.getItem(key)??'null'); return v&&Array.isArray(v.items)&&v.items.length&&v.items.every((w:Workspace)=>typeof w.id==='string'&&typeof w.name==='string'&&w.local&&w.session)&&v.items.some((w:Workspace)=>w.id===v.active)?v:empty();}catch{return empty();} }
function snapshot(storage:Storage) {return Object.fromEntries(Object.keys(storage).filter(k=>k.startsWith('traffic-studio-')).map(k=>[k,storage.getItem(k)!]));}
function restore(storage:Storage,data:Record<string,string>) {Object.keys(storage).filter(k=>k.startsWith('traffic-studio-')).forEach(k=>storage.removeItem(k));Object.entries(data).forEach(([k,v])=>{if(k.startsWith('traffic-studio-')&&typeof v==='string')storage.setItem(k,v);});}

export function WorkspaceRoot() {
  const [open,setOpen]=useState(false);
  const [registry,setRegistry]=useState(read);
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const root=useRef<HTMLDivElement>(null);
  useDialogFocus(root,()=>setOpen(false),open);
  useEffect(()=>{const show=()=>{setRegistry(read());setOpen(true);};window.addEventListener('traffic-studio-workspaces',show);return()=>window.removeEventListener('traffic-studio-workspaces',show);},[]);
  function save(next:Registry) {try{localStorage.setItem(key,JSON.stringify(next));setRegistry(next);setError('');return true;}catch{setError('Storage is full or unavailable. Workspace was not changed.');return false;}}
  function create() {if(!name.trim()){setError('Enter a workspace name.');return;}if(registry.items.length>=8){setError('This preview supports up to 8 workspaces.');return;}if(save({...registry,items:[...registry.items,{id:crypto.randomUUID(),name:name.trim(),local:{},session:{}}]}))setName('');}
  function switchTo(id:string) {
    if(id===registry.active)return;
    const local=snapshot(localStorage),session=snapshot(sessionStorage);
    const target=registry.items.find(w=>w.id===id)!;
    const next={active:id,items:registry.items.map(w=>w.id===registry.active?{...w,local,session}:w)};
    try {localStorage.setItem(key,JSON.stringify(next));restore(localStorage,target.local);restore(sessionStorage,target.session);location.reload();}
    catch {try{restore(localStorage,local);restore(sessionStorage,session);localStorage.setItem(key,JSON.stringify(registry));}catch{/* Storage remains unavailable; show recovery guidance. */}setError('Could not switch. Keep this page open and export important drafts before clearing browser storage.');}
  }
  return <><App/>{open&&<div className="settings-backdrop"><div className="workspace-manager" ref={root} role="dialog" aria-modal="true" aria-labelledby="workspace-manager-title"><header><div><span className="eyebrow">BROWSER LOCAL · MOCK</span><h2 id="workspace-manager-title">Workspaces</h2></div><button aria-label="Close workspaces" onClick={()=>setOpen(false)}>×</button></header><p>Each workspace keeps its own drafts, collections, rules, tracker, layout and preferences. Switching saves this workspace and reloads the preview. Unsaved dialog edits and in-memory secrets are not transferred.</p><div className="workspace-list">{registry.items.map(w=><div className="workspace-entry" key={w.id}><label>Workspace name<input maxLength={40} value={w.name} onChange={e=>setRegistry(r=>({...r,items:r.items.map(v=>v.id===w.id?{...v,name:e.target.value}:v)}))}/></label><button onClick={()=>{if(!w.name.trim()){setError('Workspace names cannot be empty.');return;}save(registry);}}>Save name</button><button disabled={w.id===registry.active} onClick={()=>switchTo(w.id)}>{w.id===registry.active?'Current':'Switch'}</button></div>)}</div><div className="workspace-create"><input aria-label="New workspace name" placeholder="New workspace name" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><button onClick={create}>Create workspace</button></div>{error&&<p role="alert">{error}</p>}<footer><span>{registry.items.length}/8 workspaces · local browser storage</span><button onClick={()=>setOpen(false)}>Done</button></footer></div></div>}</>;
}
