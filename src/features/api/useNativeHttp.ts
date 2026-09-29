import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge, bridgeError } from '../../bridge';
import type { HttpInput, ApiResponse } from '../../domain/http';
import type { WorkspaceRecord } from '../../domain/workspace';
import type { MultipartFile } from './MultipartFiles';
import type { ScriptResult } from '../../domain/scripts';
import type { JsonValue } from '../../domain/workspace';
import { createVariableResolver } from '../environments/resolution';
import { responseText } from './responseText';
const credential=(key:string)=>/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key);

export function useNativeHttp() {
  const [native, setNative] = useState(isTauri);
  const [available, setAvailable] = useState(false);
  const [workspaces,setWorkspaces]=useState<WorkspaceRecord[]>([]);
  const [workspaceId,setWorkspaceId]=useState('');
  const [error,setError]=useState('');
  const [progress,setProgress]=useState(0);
  const active=useRef<{workspaceId:string;runId:string;abort:AbortController;started:boolean;scriptId?:string}|null>(null);
  const alive=useRef(true);
  async function refresh() {
    try {const [runtime,rows]=await Promise.all([bridge.command('runtime_info',undefined),bridge.command('workspace_list',undefined)]);if(!alive.current)return;setAvailable(runtime.http);setWorkspaces(rows);setError('');}
    catch(error){if(alive.current)setError(bridgeError(error).message);}
  }
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;void cancel();};},[]);
  async function cancel() {
    const run=active.current;if(!run)return;run.abort.abort();
    if(run.scriptId)await bridge.command('script_cancel',{id:run.scriptId}).catch(()=>{});
    if(run.started)try{await bridge.command('http_cancel',{workspaceId:run.workspaceId,runId:run.runId});}catch(error){if(alive.current&&bridgeError(error).code!=='not_found')setError(bridgeError(error).message);}
  }
  async function createWorkspace() {
    try {const row=await bridge.command('workspace_create',{name:'HTTP workspace'});if(alive.current){setWorkspaceId(row.id);await refresh();}}catch(error){if(alive.current)setError(bridgeError(error).message);}
  }
  async function send(input:Omit<HttpInput,'workspaceId'|'runId'|'bodyRef'>,file:File|null,attachments:MultipartFile[]=[],scripts?:{pre?:string;post?:string}):Promise<ApiResponse> {
    if(!available||!workspaceId)throw Error('Select a native repository workspace before sending.');
    if(active.current)throw Error('A run is already active in this editor.');
    const run:{workspaceId:string;runId:string;abort:AbortController;started:boolean;scriptId?:string}={workspaceId,runId:crypto.randomUUID(),abort:new AbortController(),started:false};active.current=run;setProgress(0);
    const results:ScriptResult[]=[];
    let variables:Record<string,string>={};
    async function script(source:string,response:JsonValue=null){if(run.abort.signal.aborted)throw Error('Script run cancelled.');run.scriptId=crypto.randomUUID();try{const result=await bridge.command('script_run',{input:{id:run.scriptId,source,context:{request:{method:input.method,url:input.url,body:input.body,headers:input.headers.filter(h=>!credential(h.key))},response,variables}}});results.push(result);variables=result.variables;return result;}finally{run.scriptId=undefined;}}
    let upload:string|null=null;let uploaded=false;
    async function uploadFile(file:File):Promise<string>{
      if(file.size>1024*1024*1024)throw Error('File exceeds 1 GiB native body-store limit.');
      const id=await bridge.command('body_begin',{workspaceId,size:file.size,mimeType:file.type||'application/octet-stream'});let finished=false;
      try{for(let offset=0;offset<file.size;offset+=256*1024){if(run.abort.signal.aborted)throw Error('File upload cancelled.');const bytes=new Uint8Array(await file.slice(offset,offset+256*1024).arrayBuffer());let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));const count=await bridge.command('body_append',{workspaceId,id,offset,data:btoa(binary)});if(alive.current)setProgress(Math.round(count/file.size*100));}if(run.abort.signal.aborted)throw Error('File upload cancelled.');await bridge.command('body_finish',{workspaceId,id});finished=true;return id;}finally{if(!finished)await bridge.command('body_cancel',{workspaceId,id}).catch(()=>{});}
    }
    try {
      if(scripts?.pre?.trim()){
        const result=await script(scripts.pre);
        if(result.assertions.some(row=>!row.passed))throw Error('A pre-request script assertion failed; HTTP was not sent.');
        const request=result.request as {method?:unknown;url?:unknown;body?:unknown;headers?:unknown};
        if(!request||typeof request.method!=='string'||typeof request.url!=='string'||typeof request.body!=='string'||!Array.isArray(request.headers)||request.headers.some(h=>!h||typeof h.key!=='string'||typeof h.value!=='string'))throw Error('Script returned an invalid request.');
        const resolver=createVariableResolver([Object.entries(variables).map(([key,value])=>({key,value,secret:false}))]);
        input={...input,method:request.method,url:resolver.interpolate(request.url),body:resolver.interpolate(request.body),headers:[...request.headers.filter(h=>!credential(h.key)).map(h=>({key:resolver.interpolate(h.key),value:resolver.interpolate(h.value)})),...input.headers.filter(h=>credential(h.key))]};
        if(resolver.errors.size)throw Error([...resolver.errors].join('; '));
      }
      if(file){
        upload=await bridge.command('body_begin',{workspaceId,size:file.size,mimeType:file.type||'application/octet-stream'});
        for(let offset=0;offset<file.size;offset+=256*1024){
          if(run.abort.signal.aborted)throw Error('File upload cancelled.');
          const bytes=new Uint8Array(await file.slice(offset,offset+256*1024).arrayBuffer());let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
          const count=await bridge.command('body_append',{workspaceId,id:upload,offset,data:btoa(binary)});if(alive.current)setProgress(Math.round(count/file.size*100));
        }
        if(run.abort.signal.aborted)throw Error('File upload cancelled.');
        await bridge.command('body_finish',{workspaceId,id:upload});uploaded=true;
      }
      if(run.abort.signal.aborted)throw Error('HTTP run cancelled.');
      const multipartFiles:NonNullable<HttpInput['multipartFiles']>=[];
      for(const attachment of attachments){if(!attachment.key.trim())throw Error('Multipart file field name is required.');const id=await uploadFile(attachment.file);multipartFiles.push({key:attachment.key,filename:attachment.file.name,mimeType:attachment.file.type||'application/octet-stream',bodyRef:id});}
      if(run.abort.signal.aborted)throw Error('HTTP run cancelled.');
      run.started=true;
      const response=await bridge.command('http_send',{input:{...input,workspaceId,runId:run.runId,bodyRef:upload,multipartFiles}});
      const bytes=Uint8Array.from(atob(response.previewBase64),value=>value.charCodeAt(0));
      const body=responseText(bytes,response.headers);let scriptError:string|undefined;
      if(scripts?.post?.trim())try{await script(scripts.post,{status:response.status,headers:response.headers.filter(h=>!credential(h.key)),body,previewTruncated:response.previewTruncated});}catch(error){scriptError=bridgeError(error).message;}
      if(results.length||scriptError){const summaries=results.map((result,index)=>({phase:scripts?.pre?.trim()&&index===0?'pre':'post',assertions:result.assertions,failed:result.assertions.some(row=>!row.passed)}));if(scriptError)summaries.push({phase:'post',assertions:[],failed:true});try{await bridge.command('http_record_scripts',{workspaceId,runId:run.runId,summaries});}catch(error){scriptError=[scriptError,`Script summary was not saved: ${bridgeError(error).message}`].filter(Boolean).join(' ');}}
      return {simulated:false,status:response.status,statusText:response.statusText,headers:response.headers,durationMs:response.durationMs,size:`${response.size.toLocaleString()} bytes`,body,native:response,scripts:results,scriptError};
    } finally {
      if(upload&&!uploaded)await bridge.command('body_cancel',{workspaceId,id:upload}).catch(()=>{});
      if(active.current===run)active.current=null;
    }
  }
  return {native,setNative,available,workspaces,workspaceId,setWorkspaceId,error,progress,refresh,createWorkspace,send,cancel};
}
