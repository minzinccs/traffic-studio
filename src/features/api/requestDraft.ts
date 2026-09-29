import { validateVariables, type Variable } from '../environments/resolution';
import type { JsonValue } from '../../domain/workspace';
export type DraftPair = {id:number;key:string;value:string;enabled:boolean};
export type RequestDraft = {name:string;method:string;url:string;params:DraftPair[];headers:DraftPair[];body:string;auth:string;script?:string;docs?:string;timeoutMs?:number;followRedirects?:boolean;bodyMode?:string;authMode?:string;protocol?:string;testScript?:string;variables?:Variable[];proxyUrl?:string;customCaPem?:string;tlsVerify?:boolean;cookiesEnabled?:boolean};
export function parseNativeDraft(value:JsonValue|undefined):RequestDraft {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('This record is not a native request draft.');
  const raw=value as Record<string,JsonValue>;
  for(const key of ['name','method','url','body'])if(typeof raw[key]!=='string')throw Error('Native request has unsupported required fields.');
  function pairs(value:JsonValue):DraftPair[]{if(!Array.isArray(value)||value.length>1000)throw Error('Invalid request rows.');return value.map((item,index)=>{if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.key!=='string'||typeof item.value!=='string'||typeof item.enabled!=='boolean')throw Error('Invalid request row.');return{id:index+1,key:item.key,value:item.value,enabled:item.enabled};});}
  const params=pairs(raw.params),headers=pairs(raw.headers);
  for(const key of ['script','docs','bodyMode','authMode','protocol','testScript','proxyUrl','customCaPem'])if(raw[key]!==undefined&&typeof raw[key]!=='string')throw Error('Unsupported request option.');
  if(raw.timeoutMs!==undefined&&(typeof raw.timeoutMs!=='number'||raw.timeoutMs<100||raw.timeoutMs>120000))throw Error('Invalid request timeout.');
  if(raw.followRedirects!==undefined&&typeof raw.followRedirects!=='boolean')throw Error('Invalid redirect option.');
  for(const key of ['tlsVerify','cookiesEnabled'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error('Invalid native transport option.');
  return {...raw,name:raw.name,method:raw.method,url:raw.url,body:raw.body,params,headers,variables:validateVariables(raw.variables),auth:''} as RequestDraft;
}
