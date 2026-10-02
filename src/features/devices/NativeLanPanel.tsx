import {useCallback,useEffect,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import type {LanStatus} from '../../bridge/contracts';
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
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{try{setStatus(await bridge.command('lan_status',undefined));}catch(e){setError(bridgeError(e).message);}},[]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),5000);return()=>window.clearInterval(timer);},[refresh]);
 async function start(){setBusy(true);setError('');try{const next=await bridge.command('lan_start',{workspaceId,host:host.trim(),port,acknowledged});setStatus(next);setToken(next.token??'');setAcknowledged(false);}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 async function stop(){setBusy(true);setError('');try{await bridge.command('lan_stop',undefined);setToken('');await refresh();}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 return <section className="native-lan" aria-label="Read-only LAN sharing">
  <div className="native-lan-heading"><div><div className="panel-kicker">LOCAL NETWORK</div><h2>Read-only LAN sharing</h2></div><span className={status?.running?'lan-live':'lan-idle'}>{status?.running?'Listening':'Off'}</span></div>
  <p>Share a limited list of session, flow and collection metadata with a compatible device on the same private network. The listener is off until you start it.</p>
  {status?.running?<div className="lan-details">
   <div><span>Endpoint</span><strong>https://{status.host}:{status.port}</strong></div>
   <div><span>Workspace</span><strong>{workspaces.find(w=>w.id===status.workspaceId)?.name??status.workspaceId}</strong></div>
   <div><span>Certificate SHA-256</span><code>{status.fingerprint}</code></div>
   {token?<div><span>One-time displayed bearer token</span><code className="lan-token">{token}</code></div>:<p className="lan-token-warning">Token is no longer displayed. Stop and restart sharing to issue a new token.</p>}
   <Button type="button" disabled={busy} onClick={()=>void stop()}>{busy?'Stopping…':'Stop sharing'}</Button>
  </div>:<div className="lan-form">
   <label>Workspace<SelectField label="Workspace" value={workspaceId} options={workspaces.map(w=>({value:w.id,label:w.name}))} disabled={busy} onChange={value=>setWorkspaceId(value)} /></label>
   <label>This PC’s private Wi-Fi IPv4<input value={host} onChange={e=>setHost(e.target.value)} placeholder="192.168.1.20" inputMode="decimal" disabled={busy}/></label>
   <label>Port<input type="number" min="1" max="65535" value={port} onChange={e=>setPort(Number(e.target.value))} disabled={busy}/></label>
   <label className="lan-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} disabled={busy}/> I understand other devices with the bearer token can read this workspace’s limited metadata while sharing is on.</label>
   <Button variant="default" type="button" disabled={busy||!workspaceId||!host.trim()||!acknowledged||port<1||port>65535} onClick={()=>void start()}>{busy?'Starting…':'Start sharing'}</Button>
  </div>}
  {(error||workspaceError)&&<p className="lan-error" role="alert">{error||workspaceError}</p>}
  <p className="lan-help">Compatible clients must verify the certificate fingerprint and send <code>Authorization: Bearer &lt;token&gt;</code>. Available paths: <code>/v1/sessions</code>, <code>/v1/flows</code>, <code>/v1/collections</code>. Device discovery, QR pairing and mobile companion are still pending. Firewall access may need to be allowed on this PC.</p>
 </section>;
}
