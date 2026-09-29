import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { RevisionEvent } from '../domain/workspace';
import { bridgeError, type Bridge, type CommandMap } from './contracts';
export const tauriBridge: Bridge = {
  async command<K extends keyof CommandMap>(name: K, args: CommandMap[K]['args']): Promise<CommandMap[K]['result']> {
    try { return await invoke<CommandMap[K]['result']>(name, args as Record<string, unknown> | undefined); } catch (error) { throw bridgeError(error); }
  },
  async onRevision(callback) { return listen<RevisionEvent>('traffic-studio://revision', event => callback(event.payload)); },
};
