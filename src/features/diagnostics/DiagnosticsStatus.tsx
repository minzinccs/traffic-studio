import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Download, HardDrive, Trash2, X } from 'lucide-react';
import { bridge, bridgeError } from '../../bridge';
import { clearDiagnostics, diagnosticsPersisted, readDiagnostics, recordDiagnostic, subscribeDiagnostics } from './diagnosticLog';
import type { DiagnosticEntry } from './diagnosticLog';
import './diagnostics.css';

type MemoryPerformance = Performance & { memory?: { usedJSHeapSize?: number } };
const formatMemory = (bytes: number | null) => bytes == null ? '—' : bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
const formatUptime = (seconds: number | null) => seconds == null ? '—' : seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;

export function DiagnosticsStatus({ native }: { native: boolean }) {
  const [browserEntries, setBrowserEntries] = useState(readDiagnostics);
  const [nativeEntries, setNativeEntries] = useState<DiagnosticEntry[]>([]);
  const [logError, setLogError] = useState('');
  const [memory, setMemory] = useState<number | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const metricFailed = useRef(false);
  useEffect(() => subscribeDiagnostics(() => setBrowserEntries(readDiagnostics())), []);
  useEffect(() => {
    if (!native) return;
    let active = true;
    const refresh = async () => {
      if (!active || document.hidden) return;
      try { const rows = await bridge.command('native_error_log', undefined); if (active) { setNativeEntries(rows); setLogError(''); } }
      catch { if (active) setLogError('Native log unavailable.'); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [native]);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (!active || pending || document.hidden) return;
      pending = true;
      try {
        if (native) {
          const result = await bridge.command('runtime_diagnostics', undefined);
          if (active) { metricFailed.current = false; setMemory(result.hostWorkingSetBytes); setUptime(result.uptimeSeconds); }
        } else {
          const estimate = (performance as MemoryPerformance).memory?.usedJSHeapSize;
          if (active) { setMemory(typeof estimate === 'number' && Number.isFinite(estimate) ? estimate : null); setUptime(Math.floor(performance.now() / 1000)); }
        }
      } catch (error) {
        if (active) { setMemory(null); if (!metricFailed.current) recordDiagnostic('native', 'runtime_diagnostics', bridgeError(error).code); metricFailed.current = true; }
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [native]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setConfirmClear(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  const entries = [...browserEntries, ...nativeEntries].sort((a, b) => a.time - b.time);
  const errorCount = entries.reduce((sum, entry) => sum + entry.count, 0);
  const exportLog = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, scope: 'local-redacted-errors', entries }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `traffic-studio-errors-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="diagnostics-status">
    <button className="diagnostics-trigger" type="button" aria-label={`Diagnostics: ${native ? 'native host RAM' : 'browser JS heap estimate'} ${formatMemory(memory)}, ${errorCount} errors`} aria-expanded={open} aria-controls="diagnostics-panel" onClick={() => setOpen(value => !value)}>
      <HardDrive size={12}/><span>{native ? 'Host RAM' : 'JS heap'} {formatMemory(memory)}</span><span className="diagnostics-separator">·</span><CircleAlert size={12}/><strong className={errorCount ? 'has-errors' : ''}>{errorCount}</strong>
    </button>
    {open && <section id="diagnostics-panel" className="diagnostics-panel" aria-label="Local error log">
      <header><div><strong>Diagnostics</strong><small>{native ? 'Native host working set' : 'Browser JS heap estimate'} · updates every 5s</small></div><button type="button" aria-label="Close diagnostics" onClick={() => setOpen(false)}><X size={15}/></button></header>
      <div className="diagnostics-summary"><HardDrive size={15}/><span>{formatMemory(memory)}</span><span className="diagnostics-muted">Up {formatUptime(uptime)} · {native ? 'Rust host process only; WebView and sidecar are separate.' : 'Browser estimate; unavailable when the browser does not expose it.'}</span></div>
      <div className="diagnostics-log-head"><strong>Error log</strong><span>{errorCount} occurrences · last 7 days · max 200 entries per store</span></div>
      {logError && <p role="status" className="diagnostics-log-error">{logError}</p>}
      <div className="diagnostics-list">{entries.length ? entries.slice(-50).reverse().map(entry => <div className="diagnostics-entry" key={entry.id}><time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleString()}</time><span>{entry.source} / {entry.action}</span><code>{entry.code}{entry.count > 1 ? ` ×${entry.count}` : ''}</code></div>) : <p>No errors recorded.</p>}</div>
      <footer><span>{diagnosticsPersisted() ? 'Stored locally across windows.' : 'Browser storage unavailable: browser log is in memory only.'} Only operation and error code are recorded; request data is excluded.</span><div><button type="button" disabled={!entries.length} onClick={exportLog}><Download size={13}/> Export</button><button type="button" disabled={!entries.length} onClick={async () => { if (!confirmClear) { setConfirmClear(true); return; } if (native) { try { await bridge.command('native_error_clear', undefined); setNativeEntries([]); setLogError(''); } catch { setLogError('Could not clear native log.'); setConfirmClear(false); return; } } clearDiagnostics(); setConfirmClear(false); }}><Trash2 size={13}/>{confirmClear ? 'Confirm clear' : 'Clear'}</button></div></footer>
    </section>}
  </div>;
}
