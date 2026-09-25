import { useState } from 'react';
import { ChevronDown, ChevronRight, Globe2, HardDrive, Info, Wifi } from 'lucide-react';
import { deviceGroups, pairingNote, type DeviceKind } from './devices';
import './deviceSidebar.css';

const kindIcon: Record<DeviceKind, React.ReactNode> = {
  host: <HardDrive size={14}/>,
  connected: <Wifi size={14}/>,
  available: <Globe2 size={14}/>,
};

// FE-2 — Device sidebar (mode F5).
//
// A Host / Connected / Available tree. Connected and Available are empty on
// purpose and say so, instead of listing invented devices.
export function DeviceSidebar({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState<DeviceKind[]>(['host', 'connected', 'available']);
  const toggle = (kind: DeviceKind) => setOpen((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]);

  return <aside className="explorer-sidebar" aria-label="Device sidebar">
    <div className="explorer-title"><span>DEVICE · LOCAL</span><HardDrive size={15}/></div>
    <div className="device-scroll">
      {deviceGroups().map((group) => {
        const expanded = open.includes(group.kind);
        return <div key={group.kind}>
          <button className="device-group" aria-expanded={expanded} onClick={() => toggle(group.kind)}>
            {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} {group.label} <strong>{group.devices.length}</strong>
          </button>
          {expanded && (group.devices.length
            ? group.devices.map((device) => <button
              key={device.id}
              className={`device-node ${selected === device.id ? 'selected' : ''}`}
              onClick={() => onSelect(device.id)}
              title={device.detail}
            >
              {kindIcon[device.kind]}
              <span className="device-node-copy"><strong>{device.name}</strong><small>{device.detail}</small></span>
              {device.kind === 'host' && <span className="device-pill">HOST</span>}
            </button>)
            : <div className="explorer-hint">{group.empty}</div>)}
        </div>;
      })}
      <div className="device-note"><Info size={14}/><span>{pairingNote}</span></div>
    </div>
  </aside>;
}
