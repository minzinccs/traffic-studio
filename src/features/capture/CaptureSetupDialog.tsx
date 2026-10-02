import { useCallback, useEffect, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { CaptureStatus } from '../../domain/capture';
import type { CertificateInfo } from '../../domain/certificates';
import { useNativeWorkspace } from '../storage/useNativeWorkspace';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';
import { useDialogFocus } from '../../shell/useDialogFocus';
import { useRef } from 'react';
import './captureSetupDialog.css';

export function CaptureSetupDialog({ onClose }: { onClose: () => void }) {
  const { workspaces, workspaceId, setWorkspaceId, createWorkspace } = useNativeWorkspace();
  const [newWorkspace, setNewWorkspace] = useState('');
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [certs, setCerts] = useState<CertificateInfo[]>([]);
  const [ca, setCa] = useState('');
  const [port, setPort] = useState(8899);
  const [upstreamCa, setUpstreamCa] = useState('');
  const [mode, setMode] = useState<'regular' | 'reverse' | 'upstream'>('regular');
  const [target, setTarget] = useState('');
  const [ssl, setSsl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useDialogFocus(root, onClose);

  const reload = useCallback(async () => {
    try {
      setStatus(await bridge.command('capture_status', undefined));
    } catch (e) {
      setMessage(bridgeError(e).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let alive = true;
    void bridge
      .command('certificate_list', undefined)
      .then((list) => {
        if (alive) {
          setCerts(list);
          setCa((current) => current || list[0]?.id || '');
        }
      })
      .catch((e) => {
        if (alive) setMessage(bridgeError(e).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setMessage(bridgeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const recording = status?.state === 'recording';

  return (
    <div className="settings-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={root} className="capture-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="capture-setup-title">
        <header>
          <div>
            <span className="eyebrow">LOCAL CAPTURE · OPTIONAL</span>
            <h2 id="capture-setup-title">Capture setup</h2>
            <p>{status?.message || 'Reading native listener state…'}</p>
          </div>
          <Button size="sm" onClick={onClose}>Close</Button>
        </header>
        <div className="capture-setup-body">
          <section aria-label="Workspace">
            <h3>Workspace</h3>
            <div className="capture-setup-row">
              <input aria-label="New workspace name" placeholder="New workspace" value={newWorkspace} disabled={busy || recording} onChange={(e) => setNewWorkspace(e.target.value)} />
              <Button disabled={busy || !newWorkspace.trim() || recording} onClick={() => void action(async () => { await createWorkspace(newWorkspace); setNewWorkspace(''); })}>Create workspace</Button>
            </div>
            <label>Active workspace<SelectField label="Workspace" value={workspaceId} disabled={busy || recording} onChange={setWorkspaceId} options={[{ value: '', label: 'Select workspace' }, ...workspaces.map((w) => ({ value: w.id, label: w.name }))]} /></label>
          </section>
          <section aria-label="Listener">
            <h3>Listener</h3>
            <div className="capture-setup-row">
              <label>Localhost port<input type="number" min={1} max={65535} value={port} disabled={busy || recording} onChange={(e) => setPort(Number(e.target.value))} /></label>
              <label>Mode<SelectField label="Mode" disabled={busy || recording} value={mode} onChange={(value) => setMode(value as typeof mode)} options={[{ value: 'regular', label: 'Explicit HTTP proxy' }, { value: 'reverse', label: 'Reverse proxy (HTTP/HTTPS/HTTP3)' }, { value: 'upstream', label: 'Upstream proxy' }]} /></label>
            </div>
            {mode !== 'regular' && <label>Target origin<input value={target} disabled={busy || recording} placeholder="http3://localhost:443" onChange={(e) => setTarget(e.target.value)} /></label>}
            <p className="capture-setup-hint">Listener: 127.0.0.1:{status?.port ?? port}. Configure your client separately. Start does not change Windows proxy or trust.</p>
          </section>
          <section aria-label="TLS interception">
            <h3>TLS interception</h3>
            <div className="capture-setup-row">
              <Button disabled={busy || recording} onClick={() => void action(async () => { const created = await bridge.command('certificate_create', undefined); setCerts((current) => [created, ...current]); setCa(created.id); })}>Create signing CA</Button>
              <label>Signing CA<SelectField label="Signing CA" value={ca} disabled={busy || recording} onChange={setCa} options={[{ value: '', label: 'Create CA in Settings' }, ...certs.map((c) => ({ value: c.id, label: `${c.fingerprint.slice(0, 16)} ${c.trustedCurrentUser ? 'trusted' : 'not installed'}` }))]} /></label>
            </div>
            <label><input type="checkbox" checked={ssl} disabled={busy || recording} onChange={(e) => setSsl(e.target.checked)} /> Decrypt TLS using the selected CA</label>
            <details><summary>Additional upstream trust (optional)</summary><p>PEM for a private upstream CA. TLS verification remains enabled; this does not install anything into Windows.</p><textarea aria-label="Additional upstream CA PEM" disabled={busy || recording} value={upstreamCa} onChange={(e) => setUpstreamCa(e.target.value)} /></details>
          </section>
          <p className="capture-setup-hint">HAR import and export live in File &gt; Sessions &amp; HAR. Packet capture lives in Toolbox.</p>
          {message && <p role="status" className="capture-setup-message">{message}</p>}
        </div>
        <footer>
          <span>{workspaceId ? `Listener 127.0.0.1:${status?.port ?? port}` : 'Select a workspace to start.'}</span>
          <Button variant="default" disabled={busy || !workspaceId || !ca || !Number.isInteger(port) || port < 1 || port > 65535 || recording} onClick={() => void action(() => bridge.command('capture_start', { input: { workspaceId, name: `Capture ${new Date().toLocaleString()}`, port, certificateId: ca, upstreamCaPem: upstreamCa, mode, target: target || null, sslIntercept: ssl } }))}>Start localhost capture</Button>
          <Button disabled={busy || !recording} onClick={() => void action(() => bridge.command('capture_stop', undefined))}>Stop capture</Button>
        </footer>
      </div>
    </div>
  );
}
