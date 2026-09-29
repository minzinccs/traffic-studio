import { useRef, useState } from 'react';
import { Download, FileJson2, FolderOpen, X } from 'lucide-react';
import { useDialogFocus } from '../../shell/useDialogFocus';
import { listFlows, getFlowDetail } from '../../bridge/mockBridge';
import type { Flow, FlowDetail } from '../../domain/types';
import { exportHar, maxBrowserHarChars, parseHar, readPreviewSessions, sessionsKey, snapshot, type PreviewSession } from './sessionFiles';
import './sessionManager.css';

type Props = { flows: Flow[]; details: Record<number, FlowDetail>; onLoad: (session: PreviewSession) => void; onClose: () => void };

export function SessionManager({ flows, details, onLoad, onClose }: Props) {
  const dialogRoot = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRoot, onClose);
  const [sessions, setSessions] = useState(readPreviewSessions);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<PreviewSession | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function notify(message: string, error = false) { setMessage(message); setIsError(error); }
  function saveSession() {
    try {
      const next = [...sessions, snapshot(name.trim(), flows, details)];
      localStorage.setItem(sessionsKey, JSON.stringify(next));
      setSessions(next);
      setName('');
      window.dispatchEvent(new Event('traffic-studio-sessions-change'));
      notify('Session saved in this browser.');
    } catch { notify('Storage unavailable or full. Export HAR instead.', true); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { notify('HAR file exceeds the 20 MB browser limit.', true); return; }
    try { setText(await file.text()); setFileName(file.name); setParsed(null); notify(`${file.name} loaded. Validate before opening.`); }
    catch { notify('Could not read this file.', true); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'traffic-studio.har';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function loadPerformanceSample() {
    const base = listFlows();
    const sampleDetails: Record<number, FlowDetail> = {};
    const sampleFlows = Array.from({ length: 10000 }, (_, index) => {
      const flow = base[index % base.length];
      const id = index + 1;
      const detail = getFlowDetail(flow.id);
      if (detail) sampleDetails[id] = { ...detail, id };
      return { ...flow, id };
    });
    onLoad({ id: 'performance-sample', name: '10,000 synthetic sample rows', created: new Date().toISOString(), flows: sampleFlows, details: sampleDetails });
    onClose();
  }

  return <div className="settings-backdrop"><div ref={dialogRoot} className="session-manager" role="dialog" aria-modal="true" aria-labelledby="session-manager-title">
    <header className="session-manager-head"><div><span className="session-manager-kicker">LOCAL DATA</span><h2 id="session-manager-title">Sessions & HAR</h2><p>Save sample flows in this browser, or import and export HAR. Review URLs and bodies before sharing; credential headers are removed.</p></div><button className="session-icon-button" aria-label="Close Sessions and HAR" onClick={onClose}><X size={18}/></button></header>
    <div className="session-manager-content">
      <section className="session-section" aria-labelledby="session-save-title"><div className="session-section-title"><h3 id="session-save-title">Browser sessions</h3><span>{sessions.length} saved</span></div><div className="session-inline-form"><label htmlFor="session-name">Session name</label><div className="session-inline-actions"><input id="session-name" value={name} onChange={event => setName(event.target.value)} placeholder="Name this session"/><button className="session-primary" disabled={!name.trim()} onClick={saveSession}>Save session</button></div></div>
        <div className="session-list">{sessions.length ? sessions.map(session => <div className="session-list-row" key={session.id}><div><strong>{session.name}</strong><small>{session.flows.length.toLocaleString()} flows · {new Date(session.created).toLocaleString()}</small></div><button onClick={() => { onLoad(session); onClose(); }}>Open</button></div>) : <p className="session-empty">No browser sessions saved yet.</p>}</div>
      </section>
      <section className="session-section" aria-labelledby="session-har-title"><div className="session-section-title"><h3 id="session-har-title">HAR import & export</h3><span>JSON · 20 MB file / 20M pasted characters</span></div><div className="session-file-row"><input ref={fileInput} className="session-visually-hidden" type="file" accept=".har,.json,application/json" aria-label="Choose HAR file" onChange={event => void readFile(event.target.files?.[0])}/><button onClick={() => fileInput.current?.click()}><FolderOpen size={15}/> Choose HAR file</button><span title={fileName}>{fileName || 'No file selected'}</span></div><label className="session-text-label" htmlFor="session-har-json">HAR JSON</label><textarea id="session-har-json" spellCheck={false} value={text} placeholder="Paste HAR JSON here, or choose a file above…" onChange={event => { if (event.target.value.length > maxBrowserHarChars) { notify('Pasted HAR exceeds the 20M-character browser limit.', true); return; } setText(event.target.value); setParsed(null); }}/><div className="session-action-row"><button disabled={!text.trim()} onClick={() => { try { const result = parseHar(text); setParsed(result); notify(`${result.flows.length.toLocaleString()} HAR entries validated.`); } catch (error) { setParsed(null); notify(error instanceof Error ? error.message : 'Invalid HAR.', true); } }}><FileJson2 size={15}/> Validate HAR</button><button onClick={() => { setText(exportHar(flows, details)); setParsed(null); setFileName(''); notify('HAR export prepared. Review the JSON before downloading.'); }}>Prepare export</button><button disabled={!text.trim()} onClick={download}><Download size={15}/> Download HAR</button></div>{parsed && <div className="session-valid"><span>{parsed.flows.length.toLocaleString()} entries ready to inspect</span><button className="session-primary" onClick={() => { onLoad(parsed); onClose(); }}>Open imported HAR</button></div>}</section>
      <section className="session-section session-sample" aria-labelledby="session-sample-title"><div><h3 id="session-sample-title">Performance sample</h3><p>Generate 10,000 synthetic rows to check table scrolling and filtering.</p></div><button onClick={loadPerformanceSample}>Load sample rows</button></section>
    </div>
    <footer className="session-manager-footer"><span className={isError ? 'session-error' : ''} role={isError ? 'alert' : 'status'}>{message}</span><button onClick={onClose}>Close</button></footer>
  </div></div>;
}
