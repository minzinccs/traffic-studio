import { ArrowDownToLine, Clock3, FileArchive, Info, MousePointerClick, Sparkles } from 'lucide-react';
import { findSession, flowsForSession, readSavedRequests, type HistorySelection } from './sessions';
import './historyView.css';

// FE-2 — History detail pane.
//
// The sidebar (mode F4) owns the list; this pane renders whatever is selected.
// Sample sessions are always labelled as fixtures, and saved requests are
// described as browser drafts rather than captured traffic.
export function HistoryView({ flash, selection, sidebarVisible, onShowSidebar, onOpenRequest, onShowTraffic }: {
  flash: (message: string) => void;
  selection: HistorySelection;
  sidebarVisible: boolean;
  onShowSidebar: () => void;
  onOpenRequest: (name: string) => void;
  onShowTraffic: () => void;
}) {
  const session = selection?.kind === 'session' ? findSession(selection.id) : undefined;
  const saved = selection?.kind === 'saved' ? readSavedRequests().find((item) => item.name === selection.name) : undefined;

  return <div className="workspace-page">
    <div className="page-head">
      <div><span className="eyebrow">LOCAL LIBRARY</span><h1>History</h1><p>Sample sessions bundled with the preview and API requests saved in this browser profile.</p></div>
      <div className="page-head-action"><button className="outline-button" onClick={() => flash('HAR import needs the local file and storage bridge.')}><ArrowDownToLine size={15}/> Import HAR</button></div>
    </div>

    {!session && !saved && <div className="large-empty">
      <div className="empty-tile"><MousePointerClick size={27}/></div>
      <h2>Select an entry in the sidebar</h2>
      <p>{sidebarVisible ? 'Pick a sample session or a saved request to see its detail here.' : 'The History sidebar is hidden — show it to pick a sample session or saved request.'}</p>
      {!sidebarVisible && <button className="outline-button history-reveal" onClick={onShowSidebar}>Show sidebar (F4)</button>}
    </div>}

    {session && <div className="history-detail">
      <div className="history-detail-head">
        <div>
          <span className="eyebrow">SESSION</span>
          <h2><FileArchive size={19}/>{session.name}</h2>
          <div className="history-meta">
            <span className="sample-pill">SAMPLE</span>
            <span>{session.requestCount} requests</span>
            <span>{session.size}</span>
            <span>{session.capturedAt}</span>
          </div>
        </div>
        <button className="outline-button" onClick={onShowTraffic}><Sparkles size={15}/> Open in Traffic</button>
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
      <div className="demo-note"><Info size={15}/>Opening a request switches to the Traffic view and loads the sample table. Sample flows are not captured traffic.</div>
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

    <div className="demo-note"><Info size={15}/>Captured sessions are not persisted yet — the capture core is not connected, so History stays limited to fixtures and browser drafts.</div>
  </div>;
}
