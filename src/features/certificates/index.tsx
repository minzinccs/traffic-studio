import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge, bridgeError } from '../../bridge';
import type { CertificateInfo } from '../../domain/certificates';
import './styles.css';

export function CertificateManager({showPemInitially=false}:{showPemInitially?:boolean}={}) {
  const [items,setItems]=useState<CertificateInfo[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [acknowledged,setAcknowledged]=useState(false);
  const [openPem,setOpenPem]=useState(showPemInitially);
  const mounted=useRef(true);
  const native=isTauri();
  useEffect(()=>{if(showPemInitially)setOpenPem(true);},[showPemInitially]);
  useEffect(()=>{mounted.current=true; if(native) void reload(); return()=>{mounted.current=false;};},[native]);
  async function reload(){setBusy(true);setError('');try{const next=await bridge.command('certificate_list',undefined);if(mounted.current){setItems(next);setLoaded(true);}}catch(e){if(mounted.current)setError(bridgeError(e).message);}finally{if(mounted.current)setBusy(false);}}
  async function create(){setBusy(true);setError('');try{await bridge.command('certificate_create',undefined);await reload();}catch(e){if(mounted.current)setError(bridgeError(e).message);}finally{if(mounted.current)setBusy(false);}}
  async function trust(item:CertificateInfo,install:boolean){setBusy(true);setError('');try{await bridge.command('certificate_trust',{id:item.id,fingerprint:item.fingerprint,acknowledged,install});await reload();}catch(e){if(mounted.current){setError(bridgeError(e).message);try{setItems(await bridge.command('certificate_list',undefined));}catch{/* Keep the original mutation error visible. */}}}finally{if(mounted.current){setAcknowledged(false);setBusy(false);}}}
  function download(item:CertificateInfo){const url=URL.createObjectURL(new Blob([item.pem],{type:'application/x-pem-file'}));const a=document.createElement('a');a.href=url;a.download=`traffic-studio-ca-${item.id}.pem`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function downloadDer(item:CertificateInfo){const encoded=item.pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g,'');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pkix-cert'}));const a=document.createElement('a');a.href=url;a.download=`traffic-studio-ca-${item.id}.cer`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="certificate-manager" aria-label="Local certificate manager">
    <h3>Local certificate authorities</h3>
    <p>Create a local signing CA for HTTPS interception in native capture. Its private key is protected for this Windows user; export contains only the public certificate. Select the CA when starting capture.</p>
    {!native&&<p role="status">Open the native Windows app to manage certificates. Browser preview cannot inspect OS trust.</p>}
    <div><button disabled={!native||busy||items.length>=8} onClick={()=>void create()}>Create local CA</button> <button disabled={!native||busy} onClick={()=>void reload()}>Refresh trust status</button></div>
    {error&&<p role="alert">{error}</p>}
    {native&&busy&&<p role="status">Reading or generating local certificates…</p>}
    {native&&loaded&&!busy&&items.length===0&&<p>No app CA exists. Windows trust has not been changed.</p>}
    {native&&items.length>0&&<label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/> I understand that installing this CA changes trust for my Windows user. I have checked the fingerprint below.</label>}
    {items.map(item=><article key={item.id}>
      <strong>CA {item.id}</strong>
      <label>SHA-256 fingerprint<input aria-label="CA SHA-256 fingerprint" readOnly value={item.fingerprint}/></label>
      <p>Expires {new Date(item.expiresAt).toLocaleString()} · {Date.now()>item.expiresAt?'Expired': 'Within certificate validity period'}</p>
      <p>Current user physical Root store: {item.trustedCurrentUser?'Certificate present':'Certificate absent'}. Capture uses this CA only when you select it for a session.</p>
      <button onClick={()=>download(item)}>Export public CA PEM</button>
      <button onClick={()=>downloadDer(item)}>Export public CA CER</button>
      <button type="button" aria-expanded={openPem} onClick={()=>setOpenPem(value=>!value)}>{openPem?'Hide public certificate':'View public certificate'}</button>
      {openPem&&<textarea aria-label={`Public CA PEM ${item.id}`} readOnly value={item.pem} rows={8} className="certificate-pem"/>}
      <button disabled={busy||!acknowledged||item.operation!=='idle'||item.trustedCurrentUser||Date.now()>item.expiresAt} onClick={()=>void trust(item,true)}>Install for current Windows user</button>
      <button disabled={busy||!acknowledged||item.operation!=='idle'||!item.installedByApp} onClick={()=>void trust(item,false)}>Remove app-installed CA</button>
      {item.operation!=='idle'&&<p role="alert">Trust operation: {item.operation}. Inspect this fingerprint in Windows certificate manager; automatic retry/removal is blocked because ownership is uncertain.</p>}
    </article>)}
  </section>;
}
