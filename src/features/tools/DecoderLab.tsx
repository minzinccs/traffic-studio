import {isTauri} from '@tauri-apps/api/core';
import {useEffect,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import {decoderEvent,takeDecoderInput} from './decoderInbox';
import { SelectField } from '../../shell/SelectField';
import './decoderLab.css';

type Profile={name:string;source:string;match:string};
const storageKey='traffic-studio-decoder-profiles-v1';
function readProfiles():Profile[]{try{const value=JSON.parse(localStorage.getItem(storageKey)??'[]');return Array.isArray(value)?value.filter((row):row is Profile=>typeof row?.name==='string'&&typeof row?.source==='string').map((row:Profile)=>({...row,match:typeof row.match==='string'?row.match:''})).slice(0,20):[];}catch{return [];}}
function bytes(value:string,format:'base64'|'hex'):Uint8Array<ArrayBuffer>{const text=value.replace(/\s/g,'');if(format==='hex'){if(!/^(?:[\da-f]{2})*$/i.test(text))throw Error('Hex input needs complete byte pairs.');return new Uint8Array(Array.from(text.match(/../g)??[],part=>parseInt(part,16)));}return new Uint8Array(Array.from(atob(text),part=>part.charCodeAt(0)));}
export function DecoderLab(){
 const [source,setSource]=useState('return data;');
 const [data,setData]=useState('');
 const [key,setKey]=useState('');
 const [keyFormat,setKeyFormat]=useState<'hex'|'base64'>('hex');
 const [dataFormat,setDataFormat]=useState<'hex'|'base64'>('base64');
 const [iv,setIv]=useState('');
 const [aad,setAad]=useState('');
 const [name,setName]=useState('');
 const [match,setMatch]=useState('');
 const [sourceUrl,setSourceUrl]=useState('');
 const [profiles,setProfiles]=useState(readProfiles);
 const [output,setOutput]=useState('');
 const [digest,setDigest]=useState('');
 const [fileHash,setFileHash]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const native=isTauri();
 useEffect(()=>{function accept(){const input=takeDecoderInput();if(!input)return;setData(input.data);setSourceUrl(input.sourceUrl);setKey('');setOutput('');const selected=readProfiles().find(profile=>profile.match&&input.sourceUrl.toLowerCase().includes(profile.match.toLowerCase()));if(selected){setName(selected.name);setMatch(selected.match);setSource(selected.source);}}accept();window.addEventListener(decoderEvent,accept);return()=>window.removeEventListener(decoderEvent,accept);},[]);
 async function decode(){setBusy(true);setError('');setOutput('');try{const result=await bridge.command('decode_run',{input:{source,data,key}});setOutput(result.text);setDigest(result.sha256);}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 async function decryptAes(){setBusy(true);setError('');setOutput('');try{const secret=bytes(key,keyFormat);if(![16,24,32].includes(secret.length))throw Error('AES key must contain 16, 24 or 32 bytes.');const nonce=bytes(iv,'hex');if(nonce.length!==12)throw Error('AES-GCM nonce must contain 12 bytes (24 hex digits).');const ciphertext=bytes(data,dataFormat);if(ciphertext.length<16)throw Error('AES-GCM ciphertext must include a 16-byte authentication tag.');const cryptoKey=await crypto.subtle.importKey('raw',secret,'AES-GCM',false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce,additionalData:new TextEncoder().encode(aad),tagLength:128},cryptoKey,ciphertext);const text=new TextDecoder('utf-8',{fatal:true}).decode(plain);setOutput(text);const digestBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));setDigest(Array.from(digestBytes,v=>v.toString(16).padStart(2,'0')).join(''));secret.fill(0);}catch(e){setError(e instanceof Error?e.message:'AES-GCM decryption failed.');}finally{setBusy(false);}}
 async function hashFile(){setBusy(true);setError('');try{const value=await bridge.command('sha_file',undefined);if(value)setFileHash(`${value.name} · ${value.bytes} bytes\nSHA-224 ${value.sha224}\nSHA-256 ${value.sha256}\nSHA-384 ${value.sha384}\nSHA-512 ${value.sha512}`);}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 function save(){const title=name.trim();if(!title||title.length>80||source.length>65536||match.length>180){setError('Profile name must be 1–80 characters, match at most 180 and source at most 64 KiB.');return;}const next=[{name:title,source,match:match.trim()},...profiles.filter(p=>p.name!==title)].slice(0,20);try{localStorage.setItem(storageKey,JSON.stringify(next));setProfiles(next);setError('');}catch{setError('Could not save the code profile locally.');}}
 function remove(title:string){const next=profiles.filter(p=>p.name!==title);try{localStorage.setItem(storageKey,JSON.stringify(next));setProfiles(next);}catch{setError('Could not remove the local profile.');}}
 return <section className="decoder-lab" aria-label="Local decoder script">
  <h2>Decoder script</h2><p>Write a JavaScript function body that returns decoded text or JSON. Inputs are <code>data</code> and <code>key</code>. The native isolated runtime has no file, network or module access. A saved profile contains code and an optional URL match only; keys and output are never saved.</p>
  {sourceUrl&&<p>Flow source: <code>{sourceUrl}</code>. Matching code profile is selected automatically; run it only after checking the supplied key.</p>}
  {!native&&<p role="status">Open the native Windows app to run decoder code or hash files.</p>}
  <div className="decoder-grid"><label>Input data<textarea value={data} onChange={e=>setData(e.target.value)} maxLength={262144} placeholder="Paste ciphertext or encoded payload"/></label><label>Decoder code<textarea className="decoder-source" value={source} onChange={e=>setSource(e.target.value)} maxLength={65536} spellCheck={false} aria-label="Decoder JavaScript code"/></label></div>
  <label>Key (memory only)<input type="password" autoComplete="off" value={key} maxLength={4096} onChange={e=>setKey(e.target.value)}/></label>
  <details><summary>AES-GCM with a supplied raw key</summary><p>Use a key, nonce and ciphertext from the same protocol/session. Ciphertext must include its 16-byte authentication tag. This does not derive TLS session keys.</p><div className="decoder-grid"><label>Key encoding<SelectField label="Key encoding" value={keyFormat} onChange={value=>setKeyFormat(value as 'hex'|'base64')} options={[{value:'hex',label:'Hex'},{value:'base64',label:'Base64'}]}/></label><label>Ciphertext encoding<SelectField label="Ciphertext encoding" value={dataFormat} onChange={value=>setDataFormat(value as 'hex'|'base64')} options={[{value:'base64',label:'Base64'},{value:'hex',label:'Hex'}]}/></label><label>Nonce / IV (hex)<input value={iv} onChange={e=>setIv(e.target.value)} placeholder="24 hex digits"/></label><label>Additional authenticated data (UTF-8, optional)<input value={aad} onChange={e=>setAad(e.target.value)}/></label></div><button disabled={busy||!data||!key||!iv} onClick={()=>void decryptAes()}>Decrypt AES-GCM</button></details>
  <div className="decoder-actions"><button className="primary-action" disabled={!native||busy||!source.trim()} onClick={()=>void decode()}>{busy?'Working…':'Run decoder'}</button><button className="outline-button" disabled={!native||busy} onClick={()=>void hashFile()}>Hash a file (SHA)</button><button className="outline-button" onClick={()=>{setData('');setKey('');setIv('');setAad('');setOutput('');setDigest('');setFileHash('');setError('');}}>Clear data and key</button></div>
  <label>Decoded output<textarea readOnly value={output}/></label>{digest&&<p>Output SHA-256: <code>{digest}</code></p>}{fileHash&&<pre className="decoder-hash">{fileHash}</pre>}
  <div className="decoder-profiles"><h3>Reusable decoder code</h3><div><input aria-label="Decoder profile name" value={name} maxLength={80} placeholder="Profile name" onChange={e=>setName(e.target.value)}/><input aria-label="URL substring match" value={match} maxLength={180} placeholder="URL substring (optional)" onChange={e=>setMatch(e.target.value)}/><button disabled={!name.trim()} onClick={save}>Save code only</button></div>{profiles.map(p=><div key={p.name}><button onClick={()=>{setName(p.name);setMatch(p.match);setSource(p.source);setKey('');setOutput('');}}>{p.name}{p.match?` · ${p.match}`:''}</button><button aria-label={`Remove ${p.name}`} onClick={()=>remove(p.name)}>Remove</button></div>)}</div>
  {error&&<p role="alert" className="tool-error">{error}</p>}
  <p>Custom code transforms payloads supplied here; it cannot derive TLS session keys from packet bytes. Match keys and protocol settings to data you are authorized to inspect.</p>
 </section>;
}
