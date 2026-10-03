import {useCallback,useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {bridge,bridgeError} from '../../bridge';
import type {LanDevice,LanStatus} from '../../bridge/contracts';
import {useNativeWorkspace} from '../storage/useNativeWorkspace';
import './nativeLanPanel.css';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';

export function NativeLanPanel(){
 const {workspaces,workspaceId,setWorkspaceId,error:workspaceError}=useNativeWorkspace();
 const [status,setStatus]=useState<LanStatus|null>(null);
 const [host,setHost]=useState('');
 const [port,setPort]=useState(8891);
 const [acknowledged,setAcknowledged]=useState(false);
 const [token,setToken]=useState('');
 const [devices,setDevices]=useState<LanDevice[]>([]);
 const [qr,setQr]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const next=await bridge.command('lan_status',undefined);
   setStatus(next);
   if(next.running){
    try{setDevices(await bridge.command('lan_devices',undefined));}catch{setDevices([]);}
   }else{setDevices([]);setQr('');}
  }catch(e){setError(bridgeError(e).message);}
 },[]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),5000);return()=>window.clearInterval(timer);},[refresh]);
 useEffect(()=>{
  const pairing=status?.pairing;
  if(!pairing){setQr('');return;}
  let live=true;
  QRCode.toDataURL(pairing,{width:220,margin:2,errorCorrectionLevel:'M'}).then(url=>{if(live)setQr(url);}).catch(()=>{if(live)setQr('');});
  return()=>{live=false;};
 },[status?.pairing]);
 async function start(){setBusy(true);setError('');try{const next=await bridge.command('lan_start',{workspaceId,host:host.trim(),port,acknowledged});setStatus(next);setToken(next.token??'');setAcknowledged(false);setDevices([]);}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 async function stop(){setBusy(true);setError('');try{await bridge.command('lan_stop',undefined);setToken('');setQr('');setDevices([]);await refresh();}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 async function revoke(deviceId:string){setBusy(true);setError('');try{setDevices(await bridge.command('lan_revoke',{deviceId}));}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 return <section className="native-lan" aria-label="LAN sharing for mobile companion">
  <div className="native-lan-heading"><div><div className="panel-kicker">LOCAL NETWORK</div><h2>LAN sharing for mobile</h2></div><span className={status?.running?'lan-live':'lan-idle'}>{status?.running?'Listening':'Off'}</span></div>
  <p>Share session, flow and collection metadata with the mobile companion on the same private network, and receive its captured flows and debug events. The listener is off until you start it.</p>
  {status?.running?<div className="lan-details">
   <div><span>Endpoint</span><strong>https://{status.host}:{status.port}</strong></div>
   <div><span>Workspace</span><strong>{workspaces.find(w=>w.id===status.workspaceId)?.name??status.workspaceId}</strong></div>
   <div><span>Certificate SHA-256</span><code>{status.fingerprint}</code></div>
   <div><span>Ingested</span><strong>{status.ingestedFlows} flows · {status.ingestedEvents} events · {status.deviceCount} devices</strong></div>
   {token?<div><span>One-time displayed bearer token</span><code className="lan-token">{token}</code></div>:<p className="lan-token-warning">Token is no longer displayed. Stop and restart sharing to issue a new token.</p>}
   {status.pairing?<div><span>Pairing payload (mobile scans this QR)</span><code className="lan-token">{status.pairing}</code></div>:null}
   {qr?<div className="lan-qr"><img src={qr} alt="QR code with the LAN pairing payload"/><span>Scan with the mobile companion. Verify the fingerprint above matches.</span></div>:null}
   <div className="lan-devices"><h3>Paired devices ({devices.length})</h3>{devices.length===0?<p>No device has connected yet.</p>:<ul>{devices.map(d=><li key={d.id}><div><strong>{d.label}</strong><span>{d.id} · {d.peerIp}</span></div><div><span>seen {new Date(d.lastSeen).toLocaleTimeString()} · {d.flowsIngested} flows · {d.eventsIngested} events</span><Button size="sm" disabled={busy} onClick={()=>void revoke(d.id)}>Revoke</Button></div></li>)}</ul>}</div>
   <Button type="button" disabled={busy} onClick={()=>void stop()}>{busy?'Stopping…':'Stop sharing'}</Button>
  </div>:<div className="lan-form">
   <label>Workspace<SelectField label="Workspace" value={workspaceId} options={workspaces.map(w=>({value:w.id,label:w.name}))} disabled={busy} onChange={value=>setWorkspaceId(value)} /></label>
   <label>This PC’s private Wi-Fi IPv4<input value={host} onChange={e=>setHost(e.target.value)} placeholder="192.168.1.20" inputMode="decimal" disabled={busy}/></label>
   <label>Port<input type="number" min="1" max="65535" value={port} onChange={e=>setPort(Number(e.target.value))} disabled={busy}/></label>
   <label className="lan-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} disabled={busy}/> I understand paired mobile devices can read limited metadata and push captured flows/debug events into this workspace while sharing is on.</label>
   <Button variant="default" type="button" disabled={busy||!workspaceId||!host.trim()||!acknowledged||port<1||port>65535} onClick={()=>void start()}>{busy?'Starting…':'Start sharing'}</Button>
  </div>}
  {(error||workspaceError)&&<p className="lan-error" role="alert">{error||workspaceError}</p>}
  <p className="lan-help">Mobile must verify the certificate fingerprint and send <code>Authorization: Bearer &lt;token&gt;</code>. Read paths: <code>/v1/sessions</code>, <code>/v1/flows</code>, <code>/v1/collections</code>. Ingest path: <code>POST /v1/ingest</code> with <code>{"{schemaVersion:1, deviceId, flows[], events[]}"}</code> (≤50 flows, ≤100 events, ≤512 KiB). Ingested flows land as <code>flow</code> entities and debug events as <code>tracker_item</code> records. Firewall access may need to be allowed on this PC.</p>
 </section>;
}
