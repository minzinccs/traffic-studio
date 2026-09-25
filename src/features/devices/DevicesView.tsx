import { Globe2, HardDrive, Search, Wifi } from 'lucide-react';
import { PageHead, DemoNote } from '../../shell/PageChrome';
import { availableDevices, connectedDevices, hostDevice, pairingNote } from './devices';
import './devicesView.css';

// FE-2 — Devices workspace view.
//
// The sidebar tree selects a device; this pane shows the card grid and the
// detail for the current selection. Nothing here claims a device is paired or
// reachable, because the LAN/companion core is not built.
export function DevicesView({ flash, selected, onSelect }: {
  flash: (message: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const detail = selected === hostDevice.id ? { title: hostDevice.name, rows: [['Connection', 'Local only'], ['Pairing', 'Unavailable in UI preview'], ['Transfer', 'Not built yet']] } : null;

  return <div className="workspace-page">
    <PageHead
      kicker="LOCAL NETWORK"
      title="Devices"
      description="Prepare a secure connection between this PC and future mobile companions."
      action={<button className="primary-action" disabled title="Pairing needs the LAN core, which is not built yet."><Wifi size={16}/> Pair device</button>}
    />
    <div className="device-grid">
      <button className={`device-card host ${selected === hostDevice.id ? 'selected' : ''}`} onClick={() => onSelect(hostDevice.id)} aria-pressed={selected === hostDevice.id}>
        <div className="device-top"><div className="device-glyph"><HardDrive size={25}/></div><span className="local-pill">HOST DEVICE</span></div>
        <h2>This Windows PC</h2>
        <p>Current desktop workspace</p>
        <div className="device-spec"><span>Connection</span><strong>Local only</strong></div>
        <div className="device-spec"><span>Pairing</span><strong>Unavailable in UI preview</strong></div>
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

    {detail
      ? <div className="device-detail">
        <div className="panel-kicker">SELECTED DEVICE</div>
        <h2>{detail.title}</h2>
        {detail.rows.map(([label, value]) => <div className="device-spec" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      : <div className="device-detail empty"><div className="panel-kicker">SELECTED DEVICE</div><p>Select the host device to see its connection detail.</p></div>}

    <div className="device-learn"><button className="outline-button" onClick={() => flash('LAN discovery is planned after the PC capture foundation.')}><Search size={15}/> Learn about pairing</button></div>
    <DemoNote>{pairingNote}</DemoNote>
  </div>;
}
