import type { ApiCollection, ApiProfile } from '../collections';
import type { Variable } from '../../environments/resolution';
export type ImportPreview = {format:string;collections:ApiCollection[];warnings:string[]};
export const sensitive=(key:string)=>/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key.trim());
export function object(value:unknown,label='object'):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`Expected ${label}.`);return value as Record<string,unknown>;}
export function text(value:unknown,fallback=''):string{return typeof value==='string'?value:fallback;}
export function description(value:unknown):string{return typeof value==='string'?value:value&&typeof value==='object'?text((value as Record<string,unknown>).content):'';}
export function list(value:unknown,label:string,max=2000):unknown[]{if(value===undefined)return[];if(!Array.isArray(value)||value.length>max)throw Error(`Invalid ${label} (maximum ${max}).`);return value;}
export function warning(messages:string[],message:string){if(messages.length<200&&!messages.includes(message))messages.push(message);}
export function variables(value:unknown):Variable[]{return list(value,'variables',1000).map(raw=>{const row=object(raw,'variable');const key=text(row.key??row.name);if(!key)throw Error('Variable name required.');const secret=row.type==='secret'||row.secret===true;return{key,value:secret?'':typeof row.value==='string'?row.value:JSON.stringify(row.value??''),secret};});}
export function profile(name:string,method:string,url:string):ApiProfile {if(!/^[A-Z-]{1,30}$/.test(method))throw Error('Unsupported HTTP method.');return{id:crypto.randomUUID(),name:name.slice(0,80)||'Imported request',method,url,headers:[],body:'',notes:'',requestConfig:{params:[]}};}
export function enforceLimits(preview:ImportPreview):ImportPreview {if(preview.collections.length>500||preview.collections.reduce((sum,row)=>sum+row.profiles.length,0)>2000)throw Error('Import exceeds 500 folders or 2000 requests.');return preview;}
