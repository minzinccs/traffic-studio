import { UiText } from '../localization';
import { useMemo, useState } from 'react';
import { ArrowDownToLine, Clock3, FileArchive, Info, MousePointerClick } from 'lucide-react';
import { findSession, flowsForSession, readSavedRequests, type HistorySelection } from './sessions';
import type { Flow } from '../../domain/types';
import './historyView.css';

// FE-2 — History detail pane.
//
// The sidebar (mode F4) owns the list; this pane renders whatever is selected.
// Sample sessions are always labelled as fixtures, and saved requests are
// described as browser drafts rather than captured traffic.
export function HistoryView({ selection, sidebarVisible, onShowSidebar, onOpenRequest, onShowTraffic, onImport }: {
  flash: (message: string) => void;
  selection: HistorySelection;
  sidebarVisible: boolean;
  onShowSidebar: () => void;
  onOpenRequest: (name: string) => void;
  onShowTraffic: () => void;
  onImport: () => void;
}) {
  const session = selection?.kind === 'session' ? findSession(selection.id) : undefined;
  const saved = selection?.kind === 'saved' ? readSavedRequests().find((item) => item.name === selection.name) : undefined;
  const isSampleSession = Boolean(session?.id.startsWith('sample-'));
  const [requestFilter, setRequestFilter] = useState('All');
  const [requestQuery, setRequestQuery] = useState('');
  const sessionFlows = useMemo(() => session ? flowsForSession(session.id) : [], [session?.id]);
  const visibleFlows = useMemo(() => sessionFlows.filter((flow) => matchesRequest(flow, requestFilter, requestQuery)), [sessionFlows, requestFilter, requestQuery]);

  return <div className={`workspace-page history-page ${session && !isSampleSession ? 'history-page-table' : ''}`}>
    <div className="page-head">
      <div><span className="eyebrow">LOCAL LIBRARY</span><h1><UiText text={"History"}/></h1><p>Bundled samples, imported or saved local preview sessions, and browser API drafts.</p></div>
      <div className="page-head-action"><button className="outline-button" onClick={onImport}><ArrowDownToLine size={15}/> Import HAR</button></div>
    </div>

    {!session && !saved && <div className="large-empty">
      <div className="empty-tile"><MousePointerClick size={27}/></div>
      <h2>Select an entry in the sidebar</h2>
      <p>{sidebarVisible ? 'Pick a sample session or a saved request to see its detail here.' : 'The History sidebar is hidden — show it to pick a sample session or saved request.'}</p>
      {!sidebarVisible && <button className="outline-button history-reveal" onClick={onShowSidebar}>Show sidebar (F4)</button>}
    </div>}

    {session && isSampleSession && <div className="history-detail">
      <div className="history-detail-head">
        <div>
          <span className="eyebrow">SESSION</span>
          <h2><FileArchive size={19}/>{session.name}</h2>
          <div className="history-meta">
            <span className="sample-pill">{session.id.startsWith('sample-') ? 'SAMPLE' : 'LOCAL PREVIEW'}</span>
            <span>{session.requestCount} requests</span>
            <span>{session.size}</span>
            <span>{session.capturedAt}</span>
          </div>
        </div>
        <button className="outline-button" onClick={onShowTraffic}>Open in Traffic</button>
      </div>
      <div className="demo-note"><Info size={15}/>{session.note}</div>
      {session.requestCount === 0
        ? <div className="large-empty"><div className="empty-tile"><Clock3 size={27}/></div><h2>No requests in this sample</h2><p>This fixture subset contains no flows.</p></div>
        : <div className="library-list">
          <div className="library-head"><span>REQUEST</span><span>STATUS</span><span>DURATION</span><span>SIZE</span></div>
          {flowsForSession(session.id).map((flow) => <button className="library-row" key={flow.id} onClick={onShowTraffic}>
            <span><FileArchive size={18}/><strong>{flow.method} {flow.path}</strong><small>{flow.host}</small></span>
            <span>{flow.status}</span>
            <span>{flow.duration} ms</span>
            <span>{flow.size}</span>
          </button>)}
        </div>}
      <div className="demo-note"><Info size={15}/>Opening an entry loads this session in Traffic. Local previews and sample flows are not live captures.</div>
    </div>}

    {session && !isSampleSession && <div className="history-detail history-session-table-view">
      <div className="history-detail-head">
        <div>
          <span className="eyebrow">SESSION HISTORY</span>
          <h2><FileArchive size={19}/>{session.name}</h2>
          <div className="history-meta">
            <span>{session.requestCount.toLocaleString()} requests</span>
            <span>{session.size}</span>
            <span>{formatSessionTime(session.capturedAt)}</span>
          </div>
        </div>
        <button className="outline-button" onClick={onShowTraffic}>Open in Traffic</button>
      </div>
      <div className="history-request-toolbar" role="toolbar" aria-label="Filter session requests">
        {['All', 'HTTP', 'HTTPS', 'JSON', 'Text', 'Image', 'Binary', '1xx', '2xx', '3xx', '4xx', '5xx'].map((filter) => <button key={filter} className={requestFilter === filter ? 'active' : ''} aria-pressed={requestFilter === filter} onClick={() => setRequestFilter(filter)}>{filter}</button>)}
        <input aria-label="Search session requests" placeholder="Search URL or method" value={requestQuery} onChange={(event) => setRequestQuery(event.target.value)}/>
      </div>
      <div className="history-requests-scroll">
        <table className="history-requests-table">
          <thead><tr><th>ID</th><th>Method</th><th>URL</th><th>Application</th><th>Code</th><th>Server IP</th><th>Duration</th><th>Size</th></tr></thead>
          <tbody>{visibleFlows.map((flow, index) => <tr key={`${session.id}-${flow.id}`} onClick={onShowTraffic} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onShowTraffic(); } }}>
            <td className="history-request-id">{flow.id || index + 1}</td>
            <td><span className={`method method-${flow.method.toLowerCase()}`}>{flow.method}</span></td>
            <td className="history-request-url" title={`${flow.scheme ?? 'https'}://${flow.host}${flow.path}`}>{flow.path || '/'} <small>{flow.host}</small></td>
            <td>{flow.app && flow.app !== 'Unknown' && flow.app !== 'Not recorded' ? flow.app : '—'}</td>
            <td className={flow.status >= 400 ? 'history-status-error' : ''}>{flow.status || '—'}</td>
            <td>—</td>
            <td>{formatDuration(flow.duration)}</td>
            <td>{flow.size || '—'}</td>
          </tr>)}</tbody>
        </table>
        {!visibleFlows.length && <div className="history-requests-empty">No requests match this filter.</div>}
      </div>
      <div className="history-table-footer">{visibleFlows.length.toLocaleString()} of {sessionFlows.length.toLocaleString()} requests · Select a row to load this session in Traffic.</div>
      <div className="demo-note"><Info size={15}/>{session.note}</div>
    </div>}

    {saved && <div className="history-detail">
      <div className="history-detail-head">
        <div>
          <span className="eyebrow">SAVED REQUEST</span>
          <h2><FileArchive size={19}/>{saved.name}</h2>
          <div className="history-meta"><span>{saved.method}</span><span className="history-url">{saved.url || 'No URL'}</span></div>
        </div>
        <button className="primary-action" onClick={() => onOpenRequest(saved.name)}>Open in API editor</button>
      </div>
      <div className="demo-note"><Info size={15}/>This is a request draft stored in your browser profile. It has never been sent from this preview.</div>
    </div>}

    <div className="demo-note"><Info size={15}/>Local preview sessions and API drafts are stored in this browser. The capture core is not connected.</div>
  </div>;
}

function matchesRequest(flow: Flow, filter: string, query: string) {
  const mime = flow.type.toLowerCase();
  const matchesFilter = filter === 'All'
    || filter === 'HTTP' && flow.scheme === 'http'
    || filter === 'HTTPS' && (flow.scheme ?? 'https') === 'https'
    || filter === 'JSON' && mime.includes('json')
    || filter === 'Text' && mime.startsWith('text/')
    || filter === 'Image' && mime.startsWith('image/')
    || filter === 'Binary' && !mime.startsWith('text/') && !mime.includes('json') && !mime.startsWith('image/')
    || /^\dxx$/.test(filter) && Math.floor(flow.status / 100) === Number(filter[0]);
  const needle = query.trim().toLowerCase();
  return matchesFilter && (!needle || `${flow.method} ${flow.host}${flow.path} ${flow.app ?? ''} ${flow.status}`.toLowerCase().includes(needle));
}

function formatDuration(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`; }
function formatSessionTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
