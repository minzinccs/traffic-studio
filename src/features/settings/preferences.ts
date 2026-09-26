import { useEffect, useState } from 'react';

export type Preferences = {
  displayName: string; fontSize: number; codeFont: 'mono'|'consolas'; corners: 'soft'|'square'; contrast: boolean; sidebarLabels: boolean; captureScenario:'Success'|'Failure'; theme: 'dark' | 'light'; accent: string; density: 'compact' | 'comfortable'; zoom: number;
  toastEnabled: boolean; toastSeconds: number; toolbar: boolean; statusbar: boolean;
  proxy: { host: string; port: number; mode: string; loopback: boolean; system: boolean; override: boolean; sslPatterns: string; bypass: string; upstream: string; upstreamEnabled: boolean };
  api: { timeout: number; redirects: boolean; tls: boolean }; retention: number;
};
export const preferencesKey = 'traffic-studio-preferences-v1';
export const defaults: Preferences = { displayName:'My workspace', fontSize:13, codeFont:'mono', corners:'soft', contrast:false, sidebarLabels:false, captureScenario:'Success', theme: 'dark', accent: '#dfa73d', density: 'compact', zoom: 100, toastEnabled: true, toastSeconds: 4, toolbar: true, statusbar: true, proxy: { host: '127.0.0.1', port: 9000, mode: 'HTTP / HTTPS', loopback: true, system: false, override: false, sslPatterns: '*', bypass: 'localhost;127.0.0.1', upstream: '', upstreamEnabled: false }, api: { timeout: 30000, redirects: true, tls: true }, retention: 30 };
export function readPreferences(): Preferences {
  try {
    const v = JSON.parse(localStorage.getItem(preferencesKey) ?? 'null');
    if (!v || typeof v !== 'object') return defaults;
    return { ...defaults, ...v, displayName: typeof v.displayName==='string' ? v.displayName.slice(0,32) : defaults.displayName, fontSize: [12,13,14,15,16].includes(v.fontSize)?v.fontSize:13, codeFont:v.codeFont==='consolas'?'consolas':'mono', corners:v.corners==='square'?'square':'soft', contrast:v.contrast===true, sidebarLabels:v.sidebarLabels===true, theme: v.theme === 'light' ? 'light' : 'dark', accent: ['#55b7c5','#56b8d8'].includes(v.accent) ? defaults.accent : /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent : defaults.accent, zoom: [80,90,100,110,125].includes(v.zoom) ? v.zoom : 100, proxy: { ...defaults.proxy, ...v.proxy }, api: { ...defaults.api, ...v.api } };
  } catch { return defaults; }
}
export function usePreferences() {
  const [value, setValue] = useState(readPreferences);
  useEffect(() => { const refresh = () => setValue(readPreferences()); window.addEventListener('traffic-studio-preferences', refresh); return () => window.removeEventListener('traffic-studio-preferences', refresh); }, []);
  function save(next: Preferences) { if(/@/.test(next.proxy.upstream)) throw Error('Upstream credentials cannot be saved.'); localStorage.setItem(preferencesKey, JSON.stringify(next)); setValue(next); window.dispatchEvent(new Event('traffic-studio-preferences')); }
  return [value, save] as const;
}
