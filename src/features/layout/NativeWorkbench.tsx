import {useEffect,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import type {StoredEntity} from '../../domain/workspace';
import {NativeCaptureWorkspace} from '../capture/NativeCaptureWorkspace';
import {NativeTrackerView} from '../tracker/NativeTrackerView';
import {NativeAnalyticsView} from '../analytics/NativeAnalyticsView';
import {ApiView} from '../api/ApiView';
import {useNativeWorkspace} from '../storage/useNativeWorkspace';
import {useNativeEntities} from '../storage/useNativeEntities';
import { SelectField } from '../../shell/SelectField';
import './nativeWorkbench.css';

type Pane='Traffic'|'API'|'Tracker'|'Analytics';
type Slot={id:number;type:Pane};
const kinds:Pane[]=['Traffic','API','Tracker','Analytics'];
const windowId=(window as unknown as {__TRAFFIC_STUDIO_WORKBENCH_ID__?:string}).__TRAFFIC_STUDIO_WORKBENCH_ID__??'main';
const sessionKey=`traffic-studio-native-workbench-slot-ids-v1-${windowId}`;
function createId(){const bytes=crypto.getRandomValues(new Uint32Array(2));return (bytes[0]&0x1fffff)*0x100000000+bytes[1];}
function initialSlots():Slot[]{
 let ids:number[]=[];
 try{const stored=JSON.parse(sessionStorage.getItem(sessionKey)??'[]');if(Array.isArray(stored)&&stored.length===4&&stored.every((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>1000000)&&new Set(stored).size===4)ids=stored;}catch{/* use new IDs */}
 if(ids.length!==4){ids=Array.from({length:4},createId);try{sessionStorage.setItem(sessionKey,JSON.stringify(ids));}catch{/* drafts stay in memory */}}
 return kinds.map((type,index)=>({id:ids[index],type}));
}
export function NativeWorkbench({onClose}:{onClose:()=>void}){
 const {workspaces,workspaceId,setWorkspaceId}=useNativeWorkspace();
 const layouts=useNativeEntities(workspaceId,'layout');
 const [slots,setSlots]=useState<Slot[]>(initialSlots);
 const [count,setCount]=useState(2);
 const [horizontal,setHorizontal]=useState(50);
 const [vertical,setVertical]=useState(50);
 const [name,setName]=useState('Mixed workspace');
 const [layout,setLayout]=useState<StoredEntity|null>(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [dirty,setDirty]=useState<Record<number,boolean>>({});
 const hasDirty=slots.some(slot=>dirty[slot.id]);
 useEffect(()=>{if(!hasDirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[hasDirty]);
 function blocked(){setMessage('An API pane has unsaved changes. Save its request draft before changing or closing this layout.');}
 function changeCount(next:number){if(next<count&&slots.slice(next,count).some(slot=>dirty[slot.id])){blocked();return;}setCount(next);}
 function changeType(index:number,type:Pane){const current=slots[index];if(current.type==='API'&&type!=='API'&&dirty[current.id]){blocked();return;}setSlots(items=>items.map((slot,i)=>i===index?{...slot,type}:slot));}
 function moveLeft(index:number){setSlots(items=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];return next;});}
 async function save(){setBusy(true);try{const record=await bridge.command('entity_save',{input:{workspaceId,id:layout?.id??crypto.randomUUID(),kind:'layout',name,expectedRevision:layout?.revision??0,payload:{documentType:'native_workbench',panes:slots.slice(0,count).map(slot=>slot.type),horizontal,vertical}}});setLayout(record);setMessage('Layout geometry and pane types saved. API drafts keep their own recovery store.');await layouts.reload();}catch(error){setMessage(bridgeError(error).message);}finally{setBusy(false);}}
 function load(row:StoredEntity){if(hasDirty){blocked();return;}const types=row.payload.panes;if(!Array.isArray(types)||types.length<1||types.length>4||types.some(type=>!kinds.includes(type as Pane))){setMessage('Invalid saved pane configuration.');return;}setLayout(row);setName(row.name);setSlots(items=>items.map((slot,index)=>({...slot,type:(types[index] as Pane|undefined)??slot.type})));setCount(types.length);setHorizontal(Math.min(75,Math.max(25,Number(row.payload.horizontal)||50)));setVertical(Math.min(75,Math.max(25,Number(row.payload.vertical)||50)));}
 const cols=count===1?'1fr':`${horizontal}% minmax(0,1fr)`;
 const rows=count<3?'minmax(0,1fr)':`${vertical}% minmax(0,1fr)`;
 return <div className="native-workbench" role="dialog" aria-label="Mixed native workspace">
  <header><h2>Mixed workspace</h2><button onClick={()=>void bridge.command('workbench_detach',undefined).catch(error=>setMessage(bridgeError(error).message))}>Open detached window</button><button onClick={()=>hasDirty?blocked():onClose()}>Hide workspace</button></header>
  <div className="page-toolbar"><SelectField label="Layout storage workspace" disabled={busy||hasDirty} value={workspaceId} onChange={value=>{setWorkspaceId(value);setLayout(null);}} options={workspaces.map(workspace=>({value:workspace.id,label:workspace.name}))}/><SelectField label="Mixed pane count" value={String(count)} onChange={value=>changeCount(Number(value))} options={[1,2,3,4].map(number=>({value:String(number),label:`${number} panes`}))}/><label>Column width<input type="range" min={25} max={75} value={horizontal} onChange={event=>setHorizontal(Number(event.target.value))}/></label><label>Row height<input type="range" min={25} max={75} value={vertical} onChange={event=>setVertical(Number(event.target.value))}/></label><input aria-label="Native layout name" value={name} onChange={event=>setName(event.target.value)}/><button disabled={busy||!workspaceId||!name.trim()} onClick={()=>void save()}>Save layout</button>{layouts.rows.filter(row=>row.payload.documentType==='native_workbench').map(row=><button key={row.id} disabled={hasDirty} onClick={()=>load(row)}>{row.name}</button>)}</div>
  <p role="status">{message || (hasDirty ? 'One or more API panes have unsaved changes.' : '')}</p><div className="native-workbench-grid" style={{gridTemplateColumns:cols,gridTemplateRows:rows}}>{slots.slice(0,count).map((slot,index)=><section className="native-workbench-pane" key={slot.id}><header><SelectField label={`Pane ${index+1} type`} value={slot.type} onChange={value=>changeType(index,value as Pane)} options={kinds.map(type=>({value:type,label:type}))}/><button disabled={index===0} onClick={()=>moveLeft(index)}>Move left</button>{dirty[slot.id]&&<span role="status">Unsaved API draft</span>}</header><div className="native-workbench-content">{slot.type==='Traffic'?<NativeCaptureWorkspace/>:slot.type==='Tracker'?<NativeTrackerView/>:slot.type==='Analytics'?<NativeAnalyticsView/>:<ApiView flash={setMessage} environment="Global" tabId={slot.id} requestName={`Workbench request ${index+1}`} onDirty={value=>setDirty(current=>current[slot.id]===value?current:{...current,[slot.id]:value})}/>}</div></section>)}</div>
 </div>;
}
