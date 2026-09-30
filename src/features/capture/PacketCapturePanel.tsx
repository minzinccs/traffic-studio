import {useCallback,useEffect,useState} from 'react';
import {bridge,bridgeError} from '../../bridge';
import { SelectField } from '../../shell/SelectField';
import type {PacketRow,PacketStatus} from '../../bridge/contracts';
import './packetCapture.css';

export function PacketCapturePanel(){
 const [status,setStatus]=useState<PacketStatus|null>(null);
 const [interfaces,setInterfaces]=useState<Array<{index:number;label:string}>>([]);
 const [selected,setSelected]=useState(0);
 const [file,setFile]=useState('');
 const [rows,setRows]=useState<PacketRow[]>([]);
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{try{setStatus(await bridge.command('packet_status',undefined));}catch(e){setError(bridgeError(e).message);}},[]);
// Requesting interfaces on a machine without dumpcap/Npcap only yields an expected "unsupported"
// diagnostic entry, so interfaces are asked for only when packet capture is actually available.
 useEffect(()=>{let alive=true;void (async()=>{try{const state=await bridge.command('packet_status',undefined);if(!alive)return;setStatus(state);if(!state.captureAvailable){setInterfaces([]);setSelected(0);return;}const found=await bridge.command('packet_interfaces',undefined);if(alive){setInterfaces(found);setSelected(found[0]?.index??0);}}catch(e){if(alive)setError(bridgeError(e).message);}})();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);return()=>{alive=false;window.clearInterval(timer);};},[refresh]);
 async function action(fn:()=>Promise<PacketStatus>){setBusy(true);setError('');try{const next=await fn();setStatus(next);setAck(false);if(!next.files.some(item=>item.name===file)){setFile('');setRows([]);}}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}
 async function inspect(name:string){setBusy(true);setError('');setFile(name);try{setRows(await bridge.command('packet_inspect',{name}));}catch(e){setRows([]);setError(bridgeError(e).message);}finally{setBusy(false);}}
 return <section className="packet-panel" aria-label="Packet capture and TLS key log">
  <div className="packet-heading"><div><span className="panel-kicker">OPTIONAL · LOCAL</span><h2>Packets and TLS key log</h2></div><span className={status?.running?'packet-live':'packet-off'}>{status?.running?'Recording':'Off'}</span></div>
  <p>Packet capture sees network frames from the selected interface, including traffic that bypasses the HTTP proxy. It never claims encrypted payloads are readable without matching session secrets. Requires a separately installed Wireshark dumpcap/Npcap; tshark is needed for analysis. No driver is installed by this app.</p>
  <p role="status">{status?.message??'Checking packet tools…'} {status&&`· ${Math.round(status.totalBytes/1024/1024)} MiB stored · ${status.keylogEntries} key-log entries in memory`}</p>
  <div className="packet-controls"><label>Interface<SelectField label="Interface" value={String(selected)} disabled={busy||status?.running||!interfaces.length} onChange={value=>setSelected(Number(value))} options={interfaces.length?interfaces.map(value=>({value:String(value.index),label:`${value.index}. ${value.label}`})):[{value:'0',label:'No capture interface available'}]}/></label>
   <label className="packet-confirm"><input type="checkbox" checked={ack} disabled={busy||status?.running} onChange={e=>setAck(e.target.checked)}/> I understand packets may contain private data and will be stored locally (up to 200 MiB total).</label>
   <button className="primary-action" disabled={busy||!status?.captureAvailable||status.running||!selected||!ack} onClick={()=>void action(()=>bridge.command('packet_start',{interface:selected,acknowledged:ack}))}>{busy?'Working…':'Start packet capture'}</button>
   <button className="outline-button" disabled={busy||!status?.running} onClick={()=>void action(()=>bridge.command('packet_stop',undefined))}>Stop</button>
  </div>
  <div className="packet-controls"><button disabled={busy||!status?.analyzerAvailable} onClick={()=>void action(()=>bridge.command('packet_keylog_select',undefined))}>Select TLS key log…</button><button disabled={busy||!status?.keylogLoaded} onClick={()=>void action(()=>bridge.command('packet_keylog_clear',undefined))}>Forget key log</button><button disabled={busy||status?.running||!status?.files.length} onClick={()=>{if(window.confirm('Delete stored packet capture files? This cannot be undone.'))void action(()=>bridge.command('packet_clear',{acknowledged:true}));}}>Clear stored packets</button><button disabled={busy} onClick={()=>void refresh()}>Refresh</button></div>
  <p>Key-log secrets remain in their original file; this app remembers the selected path only until exit. tshark applies them while inspecting a saved capture. A matching key log can reveal HTTP metadata; an unrelated key log cannot decrypt packets.</p>
  <div className="packet-files"><h3>Stored captures</h3>{status?.files.map(item=><button key={item.name} aria-pressed={file===item.name} disabled={busy||!status.analyzerAvailable} onClick={()=>void inspect(item.name)}>{item.name} · {(item.bytes/1024/1024).toFixed(1)} MiB</button>)}{!status?.files.length&&<p>No packet files.</p>}</div>
  {file&&<div className="packet-table"><h3>{file} · first {rows.length} frames</h3><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await bridge.command('packet_export',{name:file});}catch(e){setError(bridgeError(e).message);}finally{setBusy(false);}}}>Export PCAPNG…</button><div className="packet-scroll"><table><thead><tr><th>#</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Bytes</th><th>HTTP method</th><th>Status</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.number}-${index}`}><td>{row.number}</td><td>{row.time}</td><td>{row.source}</td><td>{row.destination}</td><td>{row.protocol}</td><td>{row.length}</td><td>{row.httpMethod}</td><td>{row.httpStatus}</td></tr>)}</tbody></table></div>{!rows.length&&<p>No decoded frame metadata. The file may be empty or have no supported dissector.</p>}</div>}
  {error&&<p role="alert" className="tool-error">{error}</p>}
 </section>;
}
