import { Globe2, HardDrive, Search, Wifi } from 'lucide-react';
import {isTauri} from '@tauri-apps/api/core';
import {NativeLanPanel} from './NativeLanPanel';
import { PageHead, DemoNote } from '../../shell/PageChrome';
import { Button } from '../../shell/Button';
import { availableDevices, connectedDevices, hostDevice, pairingNote } from './devices';
import './devicesView.css';

// FE-2 — Devices workspace view.
//
// The sidebar tree selects a device; this pane shows the card grid and the
// detail for the current selection. The native read-only LAN gateway has its
// own explicit state; no device is presented as paired or reachable yet.
export function DevicesView({ selected, onSelect, onPairing }: {
  flash: (message: string) => void;
  onPairing:()=>void;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const detail = selected === hostDevice.id ? { title: hostDevice.name, rows: [['Connection', 'Local only'], ['Pairing', 'Not available yet'], ['Transfer', 'Not built yet']] } : null;

  return <div className="workspace-page">
    <PageHead
      kicker="LOCAL NETWORK"
      title="Devices"
      description="Prepare a secure connection between this PC and future mobile companions."
      action={isTauri()?<Button variant="default" onClick={()=>document.querySelector('.native-lan')?.scrollIntoView({behavior:'smooth'})}><Wifi size={16}/> LAN sharing</Button>:<Button variant="default" onClick={onPairing} title="Pairing draft only; no LAN connection"><Wifi size={16}/> Pairing details</Button>}
    />
    <div className="device-grid">
      <button className={`device-card host ${selected === hostDevice.id ? 'selected' : ''}`} onClick={() => onSelect(hostDevice.id)} aria-pressed={selected === hostDevice.id}>
        <div className="device-top"><div className="device-glyph"><HardDrive size={25}/></div><span className="local-pill">HOST DEVICE</span></div>
        <h2>This Windows PC</h2>
        <p>Current desktop workspace</p>
        <div className="device-spec"><span>Connection</span><strong>Local only</strong></div>
        <div className="device-spec"><span>Pairing</span><strong>Not available yet</strong></div>
      </button>
      <button className="device-card" disabled aria-disabled="true" title={pairingNote}>
        <div className="device-top"><div className="device-glyph"><Wifi size={25}/></div><span className="count-pill">{connectedDevices.length}</span></div>
        <h2>Connected devices</h2>
        <p>Trusted companions will appear here.</p>
        <div className="device-placeholder">No connected devices</div>
      </button>
      <button className="device-card" disabled aria-disabled="true" title={pairingNote}>
        <div className="device-top"><div className="device-glyph"><Globe2 size={25}/></div><span className="count-pill">{availableDevices.length}</span></div>
        <h2>Available devices</h2>
        <p>Discover devices on your LAN after pairing support is built.</p>
        <div className="device-placeholder">Pairing support is not built yet</div>
      </button>
    </div>

    {isTauri()&&<NativeLanPanel/>}

    {detail
      ? <div className="device-detail">
        <div className="panel-kicker">SELECTED DEVICE</div>
        <h2>{detail.title}</h2>
        {detail.rows.map(([label, value]) => <div className="device-spec" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      : <div className="device-detail empty"><div className="panel-kicker">SELECTED DEVICE</div><p>Select the host device to see its connection detail.</p></div>}

    <div className="device-learn"><Button onClick={onPairing}><Search size={15}/> Learn about pairing</Button></div>
    {!isTauri()&&<DemoNote>{pairingNote}</DemoNote>}
  </div>;
}
