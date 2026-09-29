import {useEffect,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import type {WorkspaceRecord} from '../../domain/workspace';
export function useNativeWorkspace(){
 const [workspaces,setWorkspaces]=useState<WorkspaceRecord[]>([]);const [workspaceId,setWorkspaceId]=useState('');const [error,setError]=useState('');
 useEffect(()=>{let alive=true;void bridge.command('workspace_list',undefined).then(rows=>{if(alive){setWorkspaces(rows);setWorkspaceId(current=>rows.some(row=>row.id===current)?current:rows[0]?.id??'');}}).catch(e=>{if(alive)setError(bridgeError(e).message);});return()=>{alive=false;};},[]);
 async function createWorkspace(name:string){const created=await bridge.command('workspace_create',{name:name.trim()});setWorkspaces(current=>[...current,created]);setWorkspaceId(created.id);return created;}
 return {workspaces,workspaceId,setWorkspaceId,createWorkspace,error};
}
