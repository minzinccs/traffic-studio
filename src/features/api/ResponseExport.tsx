import { useRef,useEffect,useState } from 'react';
import { bridge,bridgeError } from '../../bridge';
import type { BodyReference } from '../../domain/workspace';
import { Button } from '../../shell/Button';
export function ResponseExport({body}:{body:BodyReference}){
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const generation=useRef(0);
  useEffect(()=>{generation.current++;setBusy(false);setMessage('');return()=>{generation.current++;};},[body.id]);
  async function save(){const operation=generation.current;setBusy(true);setMessage('');try{const size=await bridge.command('body_export',{workspaceId:body.workspaceId,id:body.id});if(generation.current===operation)setMessage(size===null?'Export cancelled.':`Exported ${size.toLocaleString()} original bytes after checksum verification.`);}catch(e){if(generation.current===operation)setMessage(bridgeError(e).message);}finally{if(generation.current===operation)setBusy(false);}}
  return <span><Button size="sm" disabled={busy} onClick={()=>void save()}>{busy?'Saving body…':'Save full body bytes'}</Button><span role="status">{message}</span></span>;
}
