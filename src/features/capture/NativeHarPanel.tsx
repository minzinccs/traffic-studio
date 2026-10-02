import { useEffect, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { StoredEntity } from '../../domain/workspace';
import { useNativeWorkspace } from '../storage/useNativeWorkspace';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';

export function NativeHarPanel() {
  const { workspaces, workspaceId, setWorkspaceId } = useNativeWorkspace();
  const [sessions, setSessions] = useState<StoredEntity[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [includeBodies, setIncludeBodies] = useState(true);
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!workspaceId) {
      setSessions([]);
      setSessionId('');
      return;
    }
    let alive = true;
    void bridge
      .command('entity_query', { workspaceId, kind: 'session', limit: 200, offset: 0 })
      .then((rows) => {
        if (!alive) return;
        setSessions(rows);
        setSessionId((current) => (current && rows.some((r) => r.id === current) ? current : ''));
      })
      .catch((e) => {
        if (alive) setMessage(bridgeError(e).message);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  async function action(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setMessage(done);
      if (workspaceId) {
        const rows = await bridge.command('entity_query', { workspaceId, kind: 'session', limit: 200, offset: 0 });
        setSessions(rows);
        setSessionId((current) => (current && rows.some((r) => r.id === current) ? current : rows[0]?.id || ''));
      }
    } catch (e) {
      setMessage(bridgeError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="session-section" aria-labelledby="session-native-har-title">
      <div className="session-section-title"><h3 id="session-native-har-title">Native capture HAR</h3><span>local SQLite</span></div>
      <p>Import HAR or Charles XML into a native workspace, or export a native session. Credential headers stay excluded unless explicitly included.</p>
      <label>Workspace<SelectField label="Native HAR workspace" value={workspaceId} disabled={busy} onChange={setWorkspaceId} options={[{ value: '', label: 'Select workspace' }, ...workspaces.map((w) => ({ value: w.id, label: w.name }))]} /></label>
      <label>Session<SelectField label="Native HAR session" value={sessionId} disabled={busy || !sessions.length} onChange={setSessionId} options={[{ value: '', label: sessions.length ? 'Select session' : 'No sessions loaded' }, ...sessions.map((s) => ({ value: s.id, label: s.name || s.id.slice(0, 8) }))]} /></label>
      <label><input type="checkbox" checked={includeBodies} disabled={busy} onChange={(e) => setIncludeBodies(e.target.checked)} /> Include bodies in export</label>
      <label><input type="checkbox" checked={sensitive} disabled={busy} onChange={(e) => setSensitive(e.target.checked)} /> Include credential headers in HAR (private)</label>
      <div className="session-action-row">
        <Button disabled={busy || !workspaceId} onClick={() => void action(() => bridge.command('session_import_har', { workspaceId }), 'HAR imported into the native workspace.')}>Import HAR</Button>
        <Button disabled={busy || !workspaceId} onClick={() => void action(() => bridge.command('session_import_charles_xml', { workspaceId }), 'Charles XML imported into the native workspace.')}>Import Charles XML</Button>
        <Button variant="default" disabled={busy || !workspaceId || !sessionId} onClick={() => void action(() => bridge.command('session_export_har', { workspaceId, sessionId, includeBodies, includeSensitiveHeaders: sensitive, acknowledged: sensitive }), 'Native session exported.')}>Export session HAR</Button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
