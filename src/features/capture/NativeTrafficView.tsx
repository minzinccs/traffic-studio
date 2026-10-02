import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { StoredEntity, BodyReference } from '../../domain/workspace';
import type { CaptureStatus } from '../../domain/capture';
import { SearchField } from '../../shell/SearchField';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';
import { useFlowSearch } from './useFlowSearch';
import { stageDecoderInput } from '../tools/decoderInbox';
import './nativeTrafficView.css';

type Props = {
  direction?: 'horizontal' | 'vertical';
  onConfigure: () => void;
  onNewRequest: () => void;
  onOpenFile: () => void;
};

export function NativeTrafficView({ direction = 'horizontal', onConfigure, onNewRequest, onOpenFile }: Props) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [sessions, setSessions] = useState<StoredEntity[]>([]);
  const [session, setSession] = useState('');
  const [rows, setRows] = useState<StoredEntity[]>([]);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<StoredEntity | null>(null);
  const [body, setBody] = useState('');
  const search = useFlowSearch(workspaceId, session, query);
  const generation = useRef(0);
  const bodyGeneration = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    try {
      const [workspaceRows, state, list, flows] = await Promise.all([
        bridge.command('workspace_list', undefined),
        bridge.command('capture_status', undefined),
        workspaceId ? bridge.command('entity_query', { workspaceId, kind: 'session', limit: 200, offset: 0 }) : Promise.resolve([] as StoredEntity[]),
        workspaceId ? bridge.command('entity_query', { workspaceId, kind: 'flow', limit: 200, offset }) : Promise.resolve([] as StoredEntity[]),
      ]);
      if (ticket !== generation.current) return;
      const active = workspaceRows.find((w) => w.id === workspaceId) || workspaceRows[0];
      if (!workspaceId && active) {
        setWorkspaceId(active.id);
        setWorkspaceName(active.name);
        return;
      }
      setWorkspaceName(workspaceRows.find((w) => w.id === workspaceId)?.name || '');
      setStatus(state);
      setSessions(list.filter((row) => ['native_capture', 'har_import'].includes(String(row.payload.source))));
      setRows(flows.filter((row) => ['native_capture', 'har_import'].includes(String(row.payload.source)) && (row.payload.type === 'flow' || row.payload.type === 'paused')));
      setMessage('');
    } catch (e) {
      if (ticket === generation.current) setMessage(bridgeError(e).message);
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, [workspaceId, offset]);

  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void bridge
      .onRevision((event) => {
        if (event.kind === 'flow' || event.kind === 'session') {
          clearTimeout(timer);
          timer = setTimeout(() => void reload(), 200);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else stop = fn;
      });
    return () => {
      disposed = true;
      stop?.();
      clearTimeout(timer);
    };
  }, [reload]);

  async function inspect(row: StoredEntity) {
    setSelected(row);
    setBody('');
    const ticket = ++bodyGeneration.current;
    const ref = row.payload.responseBody as unknown as BodyReference | null;
    if (!ref?.id) {
      setBodyLoading(false);
      return;
    }
    setBodyLoading(true);
    try {
      const chunk = await bridge.command('body_read', { workspaceId: row.workspaceId, id: ref.id, offset: 0, length: 65536 });
      if (ticket === bodyGeneration.current) {
        const bytes = Uint8Array.from(atob(chunk.data), (v) => v.charCodeAt(0));
        setBody(new TextDecoder().decode(bytes) + (chunk.eof ? '' : '\n[Preview truncated; use Save body for original bytes]'));
      }
    } catch (e) {
      if (ticket === bodyGeneration.current) setBody(bridgeError(e).message);
    } finally {
      if (ticket === bodyGeneration.current) setBodyLoading(false);
    }
  }

  const clientShown = rows.filter((row) => (!session || row.payload.sessionId === session) && `${row.payload.method} ${row.payload.url} ${row.payload.status}`.toLowerCase().includes(query.toLowerCase()));
  const shown = search.results ?? clientShown;
  const empty = !loading && !shown.length;

  return (
    <section className="native-traffic" aria-busy={loading || bodyLoading}>
      <div className="native-traffic-toolbar">
        <SearchField label="Search native flows" placeholder="Search flows (server when available)" value={query} onChange={setQuery} />
        <SelectField label="Native session" value={session} onChange={setSession} options={[{ value: '', label: 'All sessions on page' }, ...sessions.map((s) => ({ value: s.id, label: s.name }))]} />
        <Button disabled={!offset} onClick={() => setOffset((n) => Math.max(0, n - 200))}>Previous</Button>
        <span>Page {offset / 200 + 1}</span>
        <Button disabled={rows.length < 200} onClick={() => setOffset((n) => n + 200)}>Next</Button>
        <Button onClick={() => void reload()}>Refresh</Button>
        <Button onClick={onConfigure}>Capture setup</Button>
      </div>
      <p role="status" className="native-traffic-status">
        {message || (loading ? 'Refreshing capture data…' : `${shown.length} flows on this page · ${sessions.length} sessions loaded${workspaceName ? ` · ${workspaceName}` : ''}${status?.state === 'recording' ? ' · recording' : ''}`)}
        {search.searching ? ' · Searching…' : search.error ? ` · ${search.error}` : search.usingServer ? ` · ${shown.length} server matches` : null}
      </p>
      {empty ? (
        <div className="native-traffic-empty">
          <p className="native-traffic-empty-title">{workspaceId ? 'No captured flows on this page. Samples are not included.' : 'No workspace selected. Native capture needs a workspace.'}</p>
          <ul>
            <li><button onClick={onConfigure}>Start Recording <kbd>Ctrl+G</kbd></button></li>
            <li><button onClick={onNewRequest}>Create REST API <kbd>Ctrl+T</kbd></button></li>
            <li><button onClick={onOpenFile}>Open File <kbd>Ctrl+O</kbd></button></li>
          </ul>
          <p className="native-traffic-hint">Capture setup, certificates and packet tools live in their dialogs. This page only shows real capture data.</p>
        </div>
      ) : (
        <div className={`native-traffic-split${direction === 'vertical' ? ' vertical' : ''}`}>
          <div className="native-traffic-table-wrap">
            <table>
              <thead><tr><th>Started</th><th>Method</th><th>URL</th><th>Status</th><th>Protocol</th><th>Duration</th></tr></thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>{typeof row.payload.startedAt === 'number' ? new Date(row.payload.startedAt).toLocaleTimeString() : '—'}</td>
                    <td>{String(row.payload.method)}</td>
                    <td><button onClick={() => void inspect(row)}>{String(row.payload.url)}</button></td>
                    <td>{row.payload.error ? 'Error' : String(row.payload.status ?? '—')}</td>
                    <td>{String(row.payload.protocol)}</td>
                    <td>{String(row.payload.durationMs)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <aside className="native-traffic-inspector">
              <Button size="sm" onClick={() => { setSelected(null); setBodyLoading(false); bodyGeneration.current++; }}>Close inspector</Button>
              <h3>{String(selected.payload.method)} {String(selected.payload.url)}</h3>
              <pre>{JSON.stringify({ ...selected.payload, responseBody: undefined }, null, 2)}</pre>
              <h4>Body preview</h4>
              <pre aria-busy={bodyLoading}>{bodyLoading ? 'Loading body preview…' : body || 'No response body'}</pre>
              {body && <Button disabled={bodyLoading} onClick={() => stageDecoderInput({ data: body.split('\n[Preview truncated;')[0], sourceUrl: String(selected.payload.url ?? '') })}>Send body preview to Decoder</Button>}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
