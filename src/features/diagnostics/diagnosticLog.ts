export type DiagnosticEntry = {
  id: string;
  time: number;
  source: 'native' | 'browser' | 'frontend';
  action: string;
  code: string;
  count: number;
};

const key = 'traffic-studio-diagnostic-errors-v1';
const changed = 'traffic-studio-diagnostics-change';
const maxEntries = 200;
const maxAge = 7 * 24 * 60 * 60 * 1000;
const safeAction = (value: string) => /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : 'unknown_action';
const errorCodes = new Set(['auth','busy','cancelled','certificate','conflict','network','not_found','permission','quota','runtime','script','storage','timeout','unsupported','validation','stopped_unexpectedly','unavailable','script_error','resource_error','promise_error','render_error']);
const safeCode = (value: string) => errorCodes.has(value) ? value : 'unknown_error';
let persistent = true;

function parse(raw: string | null): DiagnosticEntry[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DiagnosticEntry => item && typeof item.id === 'string' && Number.isFinite(item.time) && ['native','browser','frontend'].includes(item.source) && typeof item.action === 'string' && typeof item.code === 'string' && Number.isSafeInteger(item.count) && item.count > 0 && item.time > Date.now() - maxAge).slice(-maxEntries).map(item => ({ id: item.id.slice(0, 48), time: item.time, source: item.source, action: safeAction(item.action), code: safeCode(item.code), count: Math.min(1_000_000, item.count) }));
  } catch { return []; }
}

function load(): DiagnosticEntry[] {
  try { const value = parse(localStorage.getItem(key)); persistent = true; return value; }
  catch { persistent = false; return []; }
}

function merge(current: DiagnosticEntry[], incoming: DiagnosticEntry[]): DiagnosticEntry[] {
  const byId = new Map<string, DiagnosticEntry>();
  for (const row of [...current, ...incoming]) {
    const previous = byId.get(row.id);
    if (!previous || row.time > previous.time || row.count > previous.count) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)).slice(-maxEntries);
}

let entries = load();
export function readDiagnostics(): DiagnosticEntry[] { return entries; }
export function diagnosticsPersisted() { return persistent; }
export function recordDiagnostic(source: DiagnosticEntry['source'], action: string, code: string) {
  const now = Date.now();
  const next = { source, action: safeAction(action), code: safeCode(code) };
  const previous = entries.at(-1);
  if (previous && previous.source === next.source && previous.action === next.action && previous.code === next.code && now - previous.time < 60_000) {
    entries = [...entries.slice(0, -1), { ...previous, time: now, count: Math.min(1_000_000, previous.count + 1) }];
  } else {
    entries = [...entries.filter(item => item.time > now - maxAge), { id: crypto.randomUUID(), time: now, ...next, count: 1 }].slice(-maxEntries);
  }
  try { localStorage.setItem(key, JSON.stringify(entries)); persistent = true; } catch { persistent = false; }
  window.dispatchEvent(new Event(changed));
}

export function clearDiagnostics() {
  entries = [];
  try { localStorage.removeItem(key); persistent = true; } catch { persistent = false; }
  window.dispatchEvent(new Event(changed));
}

export function subscribeDiagnostics(listener: () => void) {
  window.addEventListener(changed, listener);
  return () => window.removeEventListener(changed, listener);
}

window.addEventListener('storage', event => {
  if (event.key !== key) return;
  if (!event.newValue) { entries = []; window.dispatchEvent(new Event(changed)); return; }
  const incoming = parse(event.newValue);
  const combined = merge(entries, incoming);
  entries = combined;
  try {
    const stored = parse(localStorage.getItem(key));
    if (JSON.stringify(stored) !== JSON.stringify(combined)) localStorage.setItem(key, JSON.stringify(combined));
    persistent = true;
  } catch { persistent = false; }
  window.dispatchEvent(new Event(changed));
});
