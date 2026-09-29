import { useEffect,useRef,useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge,bridgeError } from '../../bridge';
import type { ProxyRecovery } from '../../domain/platform';
export function ManualWindowsProxy(){
  const [port,setPort]=useState(9000);const [acknowledged,setAcknowledged]=useState(false);const [state,setState]=useState<ProxyRecovery|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const alive=useRef(true);const native=isTauri();
  useEffect(()=>{alive.current=true;if(native)void refresh();return()=>{alive.current=false;};},[native]);
  async function refresh(){setBusy(true);try{const next=await bridge.command('windows_proxy_recovery',undefined);if(alive.current)setState(next);}catch(e){if(alive.current)setMessage(bridgeError(e).message);}finally{if(alive.current)setBusy(false);}}
  async function change(restore:boolean){setBusy(true);setMessage('');try{const next=restore?await bridge.command('windows_proxy_restore',{id:state!.id!,acknowledged}):await bridge.command('windows_proxy_apply',{port,acknowledged});if(alive.current){setState(next);setMessage(restore?'App-owned manual settings restored.':'Manual WinINet proxy settings applied. Read observation above to inspect Windows values; this does not enable app capture.');}}catch(e){if(alive.current){setMessage(bridgeError(e).message);try{const next=await bridge.command('windows_proxy_recovery',undefined);if(alive.current)setState(next);}catch{/* Preserve the mutation error. */}}}finally{window.dispatchEvent(new Event('traffic-studio-proxy-change'));if(alive.current){setAcknowledged(false);setBusy(false);}}}
  return <section aria-label="Manual Windows localhost proxy"><h4>Manual Windows proxy endpoint</h4><p>Use an existing proxy at 127.0.0.1. This control changes current-user WinINet ProxyEnable/ProxyServer only, with a durable restore backup. A TCP check does not verify proxy protocol. PAC, autodiscovery, bypass, WinHTTP and per-app settings are separate. Traffic Studio capture remains unavailable.</p>
    {!native&&<p>Native Windows app required.</p>}
    <label>Existing localhost proxy port<input type="number" min={1} max={65535} disabled={busy} value={port} onChange={e=>setPort(Number(e.target.value))}/></label>
    <label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/> I understand this changes Windows manual proxy settings. For Apply, I confirm the selected localhost proxy is running.</label>
    <button disabled={!native||busy||!acknowledged||!state||state.state!=='none'||!Number.isInteger(port)||port<1||port>65535} onClick={()=>void change(false)}>Apply existing localhost endpoint</button>
    <button disabled={!native||busy||!acknowledged||!state?.id} onClick={()=>void change(true)}>Restore app backup</button><button disabled={!native||busy} onClick={()=>void refresh()}>Refresh recovery state</button>
    {state&&<p>Recovery: {state.state} · {state.message}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
