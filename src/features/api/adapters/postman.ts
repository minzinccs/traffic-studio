import type { ApiCollection, ApiProfile } from '../collections';
import { sanitizeVariables } from '../../environments/resolution';
import { description,enforceLimits,list,object,profile,sensitive,text,variables,warning,type ImportPreview } from './common';
const schema='https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
export function importPostman(raw:unknown):ImportPreview {
  const root=object(raw,'Postman collection'),info=object(root.info,'collection info');
  if(!/\/v2\.1\.0\//.test(text(info.schema)))throw Error('Only Postman collection v2.1 JSON is supported.');
  const warnings:string[]=[];const collections:ApiCollection[]=[];let requests=0;
  function folder(name:string,items:unknown,vars:unknown,parentId:string|null,depth:number):void{
    if(depth>24||collections.length>=500)throw Error('Folder nesting or count exceeds limit.');
    const current:ApiCollection={id:crypto.randomUUID(),name:name.slice(0,80)||'Imported folder',parentId,variables:variables(vars),profiles:[]};collections.push(current);
    for(const rawItem of list(items,'collection items')){
      const item=object(rawItem,'collection item');
      if(item.item!==undefined){folder(text(item.name,'Folder'),item.item,item.variable,current.id,depth+1);if(item.auth)warning(warnings,'Folder authentication is excluded; configure credentials manually.');if(item.event)warning(warnings,'Folder scripts are not imported.');continue;}
      if(++requests>2000)throw Error('Import exceeds 2000 requests.');
      const request=typeof item.request==='string'?{url:item.request,method:'GET'}:object(item.request,'request');
      const url=request.url;let endpoint=typeof url==='string'?url:text(object(url,'request URL').raw);
      const config=profile(text(item.name,'Request'),text(request.method,'GET').toUpperCase(),endpoint);
      config.variables=variables(item.variable);
      if(typeof url==='object'&&url){const value=object(url);if(!endpoint){const host=Array.isArray(value.host)?value.host.map(v=>text(v)).join('.'):text(value.host);const path=Array.isArray(value.path)?value.path.map(v=>text(v)).join('/'):text(value.path);endpoint=`${text(value.protocol,'https')}://${host}${value.port?':'+text(value.port):''}/${path}`;config.url=endpoint;}
        // Raw URLs already contain query; split it so disabled structured fields
        // do not leak into Send and active query fields are not duplicated.
        if(value.query!==undefined){config.url=config.url.split('?')[0].split('#')[0];config.requestConfig!.params=list(value.query,'query rows',1000).map((raw,index)=>{const row=object(raw);return{id:index+1,key:text(row.key),value:text(row.value),enabled:row.disabled!==true};});}
        const pathVars=variables(value.variable);if(pathVars.length){config.variables=[...(config.variables??[]),...pathVars];for(const variable of pathVars)config.url=config.url.replace(new RegExp(':'+variable.key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=/|\\?|$)','g'),`{{${variable.key}}}`);}
      }
      if(/^(https?:\/\/)[^\/@]+@/i.test(config.url)){config.url=config.url.replace(/^(https?:\/\/)[^\/@]+@/i,'$1');warning(warnings,'Embedded URL credentials were removed.');}
      config.headers=list(request.header,'headers',1000).map(raw=>{const row=object(raw);return{key:text(row.key),value:text(row.value),disabled:row.disabled===true};}).filter(row=>!row.disabled&&!sensitive(row.key)).map(({key,value})=>({key,value}));
      config.notes=description(request.description);
      config.requestConfig!.docs=config.notes;
      if(request.auth||root.auth)warning(warnings,'Authentication is excluded; configure credentials manually.');
      if(item.event||root.event)warning(warnings,'Postman scripts are not executed or translated; this app uses ts.* APIs.');
      if(item.response)warning(warnings,'Saved response examples are summarized in docs; they are not real run history.');
      for(const example of list(item.response,'response examples',100)){const row=object(example);config.notes+=`\nExample: ${text(row.name)} · status ${typeof row.code==='number'?row.code:'unknown'}`;}
      if(request.body){const body=object(request.body,'body');const mode=text(body.mode);
        if(mode==='raw'){config.body=text(body.raw);const options=body.options?object(body.options):undefined;const language=options?.raw&&text(object(options.raw).language);config.requestConfig!.bodyMode=language==='json'?'JSON':language==='xml'?'XML':'Text';}
        else if(mode==='urlencoded'||mode==='formdata'){config.body=JSON.stringify(list(body[mode],'form rows',1000).filter(raw=>{const row=object(raw);if(row.type==='file'){warning(warnings,'File paths are excluded. Reselect multipart files locally.');return false;}return true;}).map((raw,index)=>{const row=object(raw);return{id:index+1,key:text(row.key),value:text(row.value),enabled:row.disabled!==true};}));config.requestConfig!.bodyMode=mode==='urlencoded'?'Form URL encoded':'Multipart draft';if(mode==='formdata'){config.headers=config.headers.filter(h=>h.key.toLowerCase()!=='content-type');}}
        else if(mode!=='')warning(warnings,`Body mode ${mode} is not imported.`);
      }
      current.profiles.push(config);
    }
  }
  folder(text(info.name,'Imported Postman'),root.item,root.variable,null,0);
  return enforceLimits({format:'Postman v2.1',collections,warnings});
}
export function exportPostman(collections:ApiCollection[]):unknown {
  const seen=new Set<string>();
  function request(p:ApiProfile){const cfg=p.requestConfig;const headers=p.headers.filter(h=>!sensitive(h.key));let body:unknown;
    if(cfg?.bodyMode==='Form URL encoded'||cfg?.bodyMode==='Multipart draft'){let rows:unknown=[];try{rows=JSON.parse(p.body);}catch{/* Export invalid form as raw rather than losing text. */}if(Array.isArray(rows)){const mode=cfg.bodyMode==='Multipart draft'?'formdata':'urlencoded';body={mode,[mode]:rows.map(raw=>{const row=object(raw);return{key:text(row.key),value:text(row.value),type:'text',disabled:row.enabled===false};})};}else body={mode:'raw',raw:p.body};}
    else if(p.body)body={mode:'raw',raw:p.body,options:{raw:{language:cfg?.bodyMode==='JSON'?'json':cfg?.bodyMode==='XML'?'xml':'text'}}};
    const withoutFragment=p.url.split('#')[0];const question=withoutFragment.indexOf('?');
    const rawQuery=question>=0?Array.from(new URLSearchParams(withoutFragment.slice(question+1)),([key,value])=>({key,value,disabled:false})):[];
    const query=[...rawQuery,...(cfg?.params??[]).map(v=>({key:v.key,value:v.value,disabled:!v.enabled}))];
    const encode=(value:string)=>encodeURIComponent(value).replace(/%7B%7B/g,'{{').replace(/%7D%7D/g,'}}');
    const enabled=query.filter(row=>!row.disabled).map(row=>`${encode(row.key)}=${encode(row.value)}`).join('&');
    const raw=(question>=0?withoutFragment.slice(0,question):withoutFragment)+(enabled?'?'+enabled:'');
    return{name:p.name,variable:sanitizeVariables(p.variables).map(v=>({key:v.key,value:v.value,type:v.secret?'secret':'string'})),request:{method:p.method,url:{raw,query},header:headers,description:cfg?.docs||p.notes,auth:{type:'noauth'},body}};
  }
  function folder(c:ApiCollection,depth:number):unknown {if(depth>24||seen.has(c.id))throw Error('Folder graph cannot be exported: cycle or excessive nesting.');seen.add(c.id);return{name:c.name,variable:sanitizeVariables(c.variables).map(v=>({key:v.key,value:v.value,type:v.secret?'secret':'string'})),item:[...c.profiles.map(request),...collections.filter(v=>v.parentId===c.id).map(v=>folder(v,depth+1))]};}
  const item=collections.filter(c=>!c.parentId).map(c=>folder(c,0));if(seen.size!==collections.length)throw Error('Folder graph has missing parents.');
  return{info:{name:'Traffic Studio export',schema},item};
}
