import { isTauri } from '@tauri-apps/api/core';
import { browserBridge } from './browserBridge';
import { tauriBridge } from './tauriBridge';
import type { Bridge } from './contracts';
import { bridgeError } from './contracts';
import { recordDiagnostic } from '../features/diagnostics/diagnosticLog';
// Native invoke errors propagate. A failing native command must never return browser/mock success.
const transport = isTauri() ? tauriBridge : browserBridge;
export const bridge: Bridge = {
  async command(name, args) {
    try { return await transport.command(name, args); }
    catch (error) { if (name !== 'capture_status' && name !== 'runtime_diagnostics') recordDiagnostic(isTauri() ? 'native' : 'browser', name, bridgeError(error).code); throw error; }
  },
  async onRevision(callback) {
    try { return await transport.onRevision(callback); }
    catch (error) { recordDiagnostic(isTauri() ? 'native' : 'browser', 'on_revision', bridgeError(error).code); throw error; }
  },
};
export { bridgeError, BridgeError } from './contracts';
export type { Bridge, CommandMap } from './contracts';
