import { useEffect, useRef, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { StoredEntity, BodyReference } from '../../domain/workspace';
import type { ApiResponse, HttpResult } from '../../domain/http';
import { responseText } from './responseText';
export function NativeRunHistory({workspaceId,onLoad}:{workspaceId:string;onLoad:(response:ApiResponse)=>void}) {
  const [rows,setRows]=useState<StoredEntity[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [open,setOpen]=useState(false);
  const generation=useRef(0);
  const [offset,setOffset]=useState(0);
  const [selected,setSelected]=useState<StoredEntity|null>(null);
  useEffect(()=>{generation.current++;setRows([]);setError('');setOpen(false);setBusy(false);return()=>{generation.current++;};},[workspaceId]);
  async function loadRows(nextOffset=0){const operation=generation.current;setBusy(true);setError('');try{const rows=await bridge.command('entity_query',{workspaceId,kind:'api_run',limit:100,offset:nextOffset});if(generation.current===operation){setRows(rows);setOffset(nextOffset);setSelected(null);setOpen(true);}}catch(error){if(generation.current===operation)setError(bridgeError(error).message);}finally{if(generation.current===operation)setBusy(false);}}
  async function load(row:StoredEntity){const operation=generation.current;
    setSelected(row);
    setBusy(true);setError('');try{
      const metadata=row.payload.response as unknown as Omit<HttpResult,'runId'|'previewBase64'|'previewTruncated'|'size'>;
      if(!metadata?.body || typeof metadata.status!=='number')throw Error(`Run is ${row.payload.state??'unsupported'}; no completed response is available.`);
      const body=metadata.body as BodyReference;if(body.workspaceId!==workspaceId)throw Error('Body belongs to another workspace.');
      const chunk=await bridge.command('body_read',{workspaceId,id:body.id,offset:0,length:64*1024});
      const result:HttpResult={...metadata,body,runId:row.id,size:body.size,previewBase64:chunk.data,previewTruncated:!chunk.eof};
      if(generation.current===operation)onLoad({simulated:false,status:result.status,statusText:result.statusText??'',headers:result.headers,durationMs:result.durationMs,size:`${body.size.toLocaleString()} bytes`,body:responseText(Uint8Array.from(atob(chunk.data),value=>value.charCodeAt(0)),result.headers),native:result});
    }catch(error){if(generation.current===operation)setError(bridgeError(error).message);}finally{if(generation.current===operation)setBusy(false);}
  }
  function exportPage(){const url=URL.createObjectURL(new Blob([JSON.stringify({format:'traffic-studio-run-metadata',version:1,workspaceId,offset,runs:rows},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`http-runs-${workspaceId}-${offset}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="native-run-history"><button disabled={busy||!workspaceId} onClick={()=>void loadRows()}>Load native run history</button>{open&&<><button onClick={()=>setOpen(false)}>Close history</button><p>Native runs, page {Math.floor(offset/100)+1}. Failed/cancelled/interrupted states are retained. New runs can shift pages; refresh to start again. Loading a response keeps the current request draft. Metadata exports contain URLs and body references, without body files or cookie jar contents.</p><button disabled={busy||offset===0} onClick={()=>void loadRows(Math.max(0,offset-100))}>Previous page</button><button disabled={busy||rows.length<100} onClick={()=>void loadRows(offset+100)}>Next page</button><button disabled={busy||!rows.length} onClick={exportPage}>Export this page's metadata</button>{!rows.length&&<p>No native runs on this page.</p>}{rows.map(row=><button key={row.id} disabled={busy} onClick={()=>void load(row)}>{row.name} · {new Date(row.updatedAt).toLocaleString()}</button>)}{selected&&<details open><summary>Run {selected.id} · {String(selected.payload.state??'unknown')}</summary><pre>{JSON.stringify(selected.payload,null,2)}</pre></details>}</>}{error&&<p role="alert">{error}</p>}</section>;
}
