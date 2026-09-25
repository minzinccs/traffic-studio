// FE-2 — Device data model.
//
// Device discovery, pairing and transfer need the LAN/companion core, which is
// not built. So this module exposes exactly one real entry (the local host) and
// two intentionally empty collections, plus the wording the UI must use so a
// device is never presented as paired or connected when it is not.
export type DeviceKind = 'host' | 'connected' | 'available';

export type DeviceRecord = {
  id: string;
  name: string;
  kind: DeviceKind;
  detail: string;
};

export const hostDevice: DeviceRecord = {
  id: 'host-pc',
  name: 'This Windows PC',
  kind: 'host',
  detail: 'Desktop workspace · local only',
};

// Empty on purpose: no LAN listener or pairing support exists in this preview.
export const connectedDevices: DeviceRecord[] = [];
export const availableDevices: DeviceRecord[] = [];

export const pairingNote = 'Discovery, QR pairing and transfer are planned after the PC capture foundation. No LAN listener is running.';

export function deviceGroups(): { kind: DeviceKind; label: string; devices: DeviceRecord[]; empty: string }[] {
  return [
    { kind: 'host', label: 'HOST', devices: [hostDevice], empty: 'No host device.' },
    { kind: 'connected', label: 'CONNECTED', devices: connectedDevices, empty: 'No connected devices.' },
    { kind: 'available', label: 'AVAILABLE', devices: availableDevices, empty: 'Pairing support is not built yet.' },
  ];
}
