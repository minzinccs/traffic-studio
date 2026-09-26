import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, FileArchive, Search, SearchX } from 'lucide-react';
import { matchesSavedRequest, matchesSession, readSavedRequests, listHistorySessions, type HistorySelection } from './sessions';
import './historySidebar.css';

// FE-2 — History sidebar (mode F4).
//
// Lists labelled sample sessions and browser-saved request drafts with search,
// selection, an empty state and a filter-zero state. It never labels a sample
// as a capture session.
export function HistorySidebar({ selected, onSelect }: { selected: HistorySelection; onSelect: (value: HistorySelection) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({ sessions: true, saved: true });
  const [saved,setSaved]=useState(readSavedRequests);
  const [sampleSessions,setSessions]=useState(listHistorySessions);
  useEffect(()=>{const refresh=()=>{setSaved(readSavedRequests());setSessions(listHistorySessions());};window.addEventListener('traffic-studio-sessions-change',refresh);return()=>window.removeEventListener('traffic-studio-sessions-change',refresh);},[]);

  const needle = query.trim().toLowerCase();
  const sessions = needle ? sampleSessions.filter((session) => matchesSession(session, needle)) : sampleSessions;
  const requests = needle ? saved.filter((request) => matchesSavedRequest(request, needle)) : saved;
  const zeroResults = Boolean(needle) && sessions.length === 0 && requests.length === 0;
  const hasAnything = sampleSessions.length > 0 || saved.length > 0;

  const toggle = (group: 'sessions' | 'saved') => setOpen((current) => ({ ...current, [group]: !current[group] }));

  return <aside className="explorer-sidebar" aria-label="History sidebar">
    <div className="explorer-title"><span>HISTORY · LOCAL</span><FileArchive size={15}/></div>
    <div className="explorer-search"><Search size={14}/><input aria-label="Search history" placeholder="Search sessions and requests" value={query} onChange={(event) => setQuery(event.target.value)}/></div>

    <div className="history-scroll">
      {zeroResults ? <div className="history-zero" role="status">
        <SearchX size={18}/>
        <span>No sessions or saved requests match “{query.trim()}”.</span>
        <button onClick={() => setQuery('')}>Clear search</button>
      </div> : <>
        <button className="history-group" aria-expanded={open.sessions} onClick={() => toggle('sessions')}>
          {open.sessions ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} SESSIONS <strong>{sessions.length}</strong>
        </button>
        {open.sessions && (sessions.length ? sessions.map((session) => <button
          key={session.id}
          className={`history-row ${selected?.kind === 'session' && selected.id === session.id ? 'selected' : ''}`}
          onClick={() => onSelect({ kind: 'session', id: session.id })}
          title={session.note}
        >
          <FileArchive size={14}/>
          <span className="history-row-copy"><strong>{session.name}</strong><small>{session.requestCount} requests · {session.size}</small></span>
          <span className="sample-pill">{session.id.startsWith('sample-') ? 'SAMPLE' : 'LOCAL'}</span>
        </button>) : <div className="explorer-hint">No sessions match this search.</div>)}

        <button className="history-group" aria-expanded={open.saved} onClick={() => toggle('saved')}>
          {open.saved ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} SAVED REQUESTS <strong>{requests.length}</strong>
        </button>
        {open.saved && (requests.length ? requests.map((request) => <button
          key={request.name}
          className={`history-row ${selected?.kind === 'saved' && selected.name === request.name ? 'selected' : ''}`}
          onClick={() => onSelect({ kind: 'saved', name: request.name })}
          title={`${request.method} ${request.url || 'No URL'}`}
        >
          <Code2 size={14}/>
          <span className="history-row-copy"><strong>{request.name}</strong><small>{request.method} · {request.url || 'No URL'}</small></span>
        </button>) : <div className="explorer-hint">{needle ? 'No saved requests match this search.' : 'Save a request in the API editor to find it here.'}</div>)}
      </>}

      {!hasAnything && <div className="history-foot">No history is stored yet. Sample sessions appear once the fixture is loaded.</div>}
      {hasAnything && <div className="history-foot">Sessions above are bundled samples, not captured traffic. Saved requests are browser drafts.</div>}
    </div>
  </aside>;
}
