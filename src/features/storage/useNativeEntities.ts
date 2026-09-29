import {useCallback,useEffect,useRef,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import type {EntityKind,StoredEntity} from '../../domain/workspace';
export function useNativeEntities(workspaceId:string,kind:EntityKind){
 const [rows,setRows]=useState<StoredEntity[]>([]);const [error,setError]=useState('');const [offset,setOffset]=useState(0);const generation=useRef(0);
 const reload=useCallback(async()=>{const ticket=++generation.current;if(!workspaceId){setRows([]);return;}try{const result=await bridge.command('entity_query',{workspaceId,kind,limit:200,offset});if(ticket===generation.current){setRows(result);setError('');}}catch(e){if(ticket===generation.current)setError(bridgeError(e).message);}},[workspaceId,kind,offset]);
 useEffect(()=>{void reload();return()=>{generation.current++;};},[reload]);
 useEffect(()=>{setOffset(0);},[workspaceId,kind]);
 useEffect(()=>{let gone=false;let stop:(()=>void)|undefined;let timer:ReturnType<typeof setTimeout>|undefined;void bridge.onRevision(event=>{if(event.workspaceId===workspaceId){clearTimeout(timer);timer=setTimeout(()=>void reload(),150);}}).then(fn=>{if(gone)fn();else stop=fn;}).catch(e=>setError(bridgeError(e).message));return()=>{gone=true;stop?.();clearTimeout(timer);};},[reload,workspaceId]);
 return {rows,setRows,error,reload,offset,setOffset};
}
