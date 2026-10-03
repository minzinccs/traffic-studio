import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Plus, Radio, Search, Star } from 'lucide-react';
import type { Flow } from '../../domain/types';
import type { ExplorerProps } from '../../shell/ExplorerSidebar';
import { readAnnotations } from './FlowAnnotations';
import { SelectField } from '../../shell/SelectField';
import { useNativeExplorerFlows } from './useNativeExplorerFlows';
export function TrafficExplorer({ flows, trackedIds, favoriteIds, selectedFlow, onSelectFlow, onTrack, onFavorite, onSetTrafficFilter, trafficFilter, section, source = 'Sample traffic' }: ExplorerProps) {
  const [revision, setRevision] = useState(0);
  useEffect(() => { const sync = () => setRevision(v => v + 1); window.addEventListener('traffic-studio-annotations-change', sync); return () => window.removeEventListener('traffic-studio-annotations-change', sync); }, []);
  void revision;
  const annotations = readAnnotations();
  const [trafficGroups, setTrafficGroups] = useState<string[]>([]);
  const [trafficNodes, setTrafficNodes] = useState<string[]>([]);
  const [trafficSearch, setTrafficSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [nativeSelected, setNativeSelected] = useState<number | null>(null);
  const native = useNativeExplorerFlows(trafficSearch);
  const showNative = native.active && Boolean(native.workspaceId);
  // Native mode renders real captured/imported flows from the local repository;
  // browser mode keeps the sample-flow behavior unchanged.
  const displayFlows = showNative ? native.flows : flows;
  const displaySource = showNative ? (native.workspaceName ? `Native capture · ${native.workspaceName}` : 'Native capture') : source;
  const isSelected = (id: number) => showNative ? nativeSelected === id : selectedFlow === id;
  const selectFlow = (id: number) => { if (showNative) setNativeSelected(id); else onSelectFlow(id); };
  const folders = Array.from(new Set(displayFlows.map(f => annotations[`${displaySource}:${f.id}`]?.folder).filter(Boolean)));
  const tracked = displayFlows.filter((flow) => trackedIds.includes(flow.id));
  const favorites = displayFlows.filter((flow) => favoriteIds.includes(flow.id));
  const devices = Array.from(new Set(displayFlows.map((flow) => flow.device).filter(Boolean))) as string[];
  const apps = Array.from(new Set(displayFlows.map((flow) => flow.app).filter(Boolean))) as string[];
  const hosts = Array.from(new Set(displayFlows.map((flow) => flow.host)));
  const paths = Array.from(new Set(displayFlows.map((flow) => flow.path.split('/').filter(Boolean)[0]).filter(Boolean)));
  const toggle = (name: string) => setTrafficGroups((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const group = (name: string) => <button className="explorer-section" onClick={() => toggle(name)}>{trafficGroups.includes(name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {name}</button>;
  const trace = (flow: Flow, onRemove?: () => void) => <div key={flow.id} className={`explorer-trace ${isSelected(flow.id) ? 'selected' : ''}`}>
    {onRemove && <input type="checkbox" checked onChange={onRemove} aria-label={`Remove bookmark ${flow.method} ${flow.path}`} />}
    <button className="explorer-trace-main" onClick={() => selectFlow(flow.id)} title={showNative ? `Native flow ${flow.method} ${flow.host}${flow.path} · open Traffic capture for body and timing` : `${flow.method} ${flow.host}${flow.path}`}><span>{flow.method}</span>{flow.path}</button>
  </div>;
  const matchesSearch = (flow: Flow) => `${flow.id} ${flow.method} ${flow.host} ${flow.path} ${flow.app ?? ''} ${flow.device ?? ''}`.toLowerCase().includes(trafficSearch.toLowerCase());
  const categoryNode = (category: string, value: string, filter: string, matching: Flow[]) => {
    const key = `${category}:${value}`;
    const open = trafficNodes.includes(key) || Boolean(trafficSearch);
    const shown = matching.filter(matchesSearch);
    if (trafficSearch && !shown.length && !value.toLowerCase().includes(trafficSearch.toLowerCase())) return null;
    return <div className="explorer-category" key={key}><div className={`explorer-category-head ${trafficFilter === filter ? 'selected' : ''}`}><button className="explorer-category-expand" aria-label={`${open ? 'Collapse' : 'Expand'} ${value}`} aria-expanded={open} onClick={() => setTrafficNodes((current) => open ? current.filter((item) => item !== key) : [...current, key])}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button><button className="explorer-category-filter" onClick={() => onSetTrafficFilter(filter)} title={`Filter traffic by ${value}`}>{value}</button></div>{open && (shown.length ? shown.slice(0, rowLimit).map((flow) => trace(flow)) : <div className="explorer-hint">No matching requests.</div>)}</div>;
  };
  const explorerTitle = !native.active ? (flows.length ? (source === 'Sample traffic' ? 'EXPLORER · SAMPLE' : 'EXPLORER · SESSION') : 'EXPLORER · NO FLOWS') : (native.workspaceId ? (native.flows.length || native.loading || native.searching ? 'EXPLORER · NATIVE' : 'EXPLORER · NO FLOWS') : 'EXPLORER · NO WORKSPACE');
  const showCreate = native.active && (!native.workspaceId || (Boolean(native.workspaceId) && !native.loading && !native.searching && !native.error && native.flows.length === 0));
  const explorerStatus = !native.workspaceId ? 'No workspace selected. Native capture needs a workspace.' : native.error ? native.error : (native.loading || native.searching) ? 'Reading native flows…' : `${native.flows.length} native flow${native.flows.length === 1 ? '' : 's'}${native.workspaceName ? ` · ${native.workspaceName}` : ''}${native.sessionId ? ' · filtered by session' : ''}`;
  return <aside className="explorer-sidebar" aria-label="Traffic explorer"><div className="explorer-title"><span>{explorerTitle}</span><Radio size={15} /></div>{native.active && <div style={{ padding: '8px 11px 0', display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#929aa1', letterSpacing: '.08em', fontWeight: 700 }}>WORKSPACE<SelectField label="Explorer workspace" value={native.workspaceId} onChange={(value) => native.setWorkspaceId(value)} options={[{ value: '', label: 'Select workspace' }, ...native.workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))]} /></label>{showNative && <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#929aa1', letterSpacing: '.08em', fontWeight: 700 }}>SESSION<SelectField label="Explorer session" value={native.sessionId} onChange={(value) => native.setSessionId(value)} options={[{ value: '', label: 'All sessions' }, ...native.sessions.map((item) => ({ value: item.id, label: item.name || item.id.slice(0, 8) }))]} /></label>}<div className="explorer-hint" style={{ margin: 0 }}><span>{explorerStatus}</span></div>{showNative && <div className="explorer-hint" style={{ margin: 0 }}><span>Real capture data from local storage. Samples are never mixed in; full body and timing live in Traffic capture.</span></div>}</div>}{showCreate && <div style={{ padding: '8px 11px 0', display: 'flex', flexDirection: 'column', gap: 6 }}><div className="explorer-search" style={{ margin: 0 }}><Plus size={14} /><input aria-label="New workspace name" placeholder="New workspace" value={native.newName} disabled={native.creating} onChange={(event) => native.setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && native.newName.trim() && !native.creating) void native.createWorkspace(native.newName); }} /></div><button className="sidebar-action" disabled={native.creating || !native.newName.trim()} onClick={() => void native.createWorkspace(native.newName)}><Plus size={13} /> {native.creating ? 'Creating…' : 'Create workspace'}</button>{native.createError && <div className="explorer-hint" role="alert" style={{ margin: 0 }}><span>{native.createError}</span></div>}</div>}<div className="bookmark-folders">{section === 'traffic' && folders.map(folder => <button className="sidebar-action" key={folder} onClick={() => onSetTrafficFilter(`folder:${folder}`)}><Folder size={13} />{folder}</button>)}</div><div className="explorer-search"><Search size={14} /><input aria-label="Search Traffic explorer" placeholder={showNative ? 'Search native flows (method, URL, status)' : 'Search groups and requests'} value={trafficSearch} onChange={(event) => setTrafficSearch(event.target.value)} /></div><div className="traffic-explorer-scroll">
    {group('Favorite')}
    {trafficGroups.includes('Favorite') && (favorites.length ? favorites.filter(matchesSearch).slice(0, rowLimit).map((flow) => <div key={flow.id} className={`explorer-trace ${isSelected(flow.id) ? 'selected' : ''}`}><button className="explorer-star" title="Unfavorite" onClick={() => onFavorite(flow.id)}><Star size={13} fill="currentColor" /></button><button className="explorer-trace-main" onClick={() => selectFlow(flow.id)} title={`${flow.method} ${flow.host}${flow.path}`}><span>{flow.method}</span>{flow.path}</button></div>) : <div className="explorer-hint"><Star size={15} /><span>Star a request to add it here.</span></div>)}
    {group('Bookmark')}
    {trafficGroups.includes('Bookmark') && (tracked.length ? tracked.filter(matchesSearch).slice(0, rowLimit).map((flow) => trace(flow, () => onTrack(flow.id))) : <div className="explorer-hint"><Star size={15} /><span>Tick a request to bookmark it here.</span></div>)}
    {group('Device')}
    {trafficGroups.includes('Device') && (devices.length ? devices.map((device) => categoryNode('device', device, `device:${device}`, displayFlows.filter((flow) => flow.device === device))) : <div className="explorer-hint"><span>No device data yet.</span></div>)}
    {group('Application')}
    {trafficGroups.includes('Application') && (apps.length ? apps.map((app) => categoryNode('app', app, `app:${app}`, displayFlows.filter((flow) => flow.app === app))) : <div className="explorer-hint"><span>No app data yet.</span></div>)}
    {group('Domain')}
    {trafficGroups.includes('Domain') && hosts.map((host) => categoryNode('host', host, `host:${host}`, displayFlows.filter((flow) => flow.host === host)))}
    {group('Structure')}
    {trafficGroups.includes('Structure') && paths.map((path) => categoryNode('path', `/${path}`, `path:/${path}`, displayFlows.filter((flow) => flow.path.startsWith(`/${path}`))))}
    {displayFlows.length > 0 && <><p className="explorer-hint">Up to {rowLimit} requests per expanded group. Search by ID to find a specific flow.</p><button className="sidebar-action" onClick={() => setRowLimit(v => v + 100)}>Show 100 more per group</button></>}</div></aside>;
}