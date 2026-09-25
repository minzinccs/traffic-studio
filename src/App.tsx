import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tab, View } from './domain/types';
import { demoFlows } from './data/demoFlows';
import { ApiView } from './views/ApiView';
import { ExplorerSidebar, SetupFileView, type ExplorerNode } from './shell/ExplorerSidebar';
import { AnalyticsView, DevicesView, EnvironmentsView, HistoryView, RulesView, ToolboxView, TrackerView } from './views/WorkspacePages';
import './views/workspacePages.css';
import {
  Activity, BarChart3, Check,
  ChevronDown, CircleHelp, Code2,
  Filter, FolderOpen, Globe2, History, KanbanSquare,
  LayoutPanelLeft, Maximize2, MoreHorizontal, PanelLeftClose,
  Pause, Play, Plus, Radio, Search, Settings2, ShieldCheck, SlidersHorizontal, KeyRound,
  Sparkles, Trash2, Wifi, Wrench, X,
} from 'lucide-react';

const menuNames = ['File', 'Tools', 'View', 'Traffic', 'Proxy', 'Certificate', 'Help'];

function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: 'Traffic', view: 'traffic' }]);
  const [activeTab, setActiveTab] = useState(1);
  const [section, setSection] = useState<View>('traffic');
  const [recording, setRecording] = useState(false);
  const [endpoint, setEndpoint] = useState('127.0.0.1:9000');
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [trackedIds, setTrackedIds] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('traffic-studio-tracked-flows') ?? '[]') as number[]; } catch { return []; } });
  const [trafficFilter, setTrafficFilter] = useState('all');
  const [notice, setNotice] = useState<string | null>(null);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const flows = useMemo(() => demoFlows.filter((flow) =>
    `${flow.method} ${flow.host} ${flow.path} ${flow.status}`.toLowerCase().includes(query.toLowerCase()) &&
    (trafficFilter === 'all' || (trafficFilter === 'tracked' && trackedIds.includes(flow.id)) || (trafficFilter.startsWith('host:') && flow.host === trafficFilter.slice(5)) || (trafficFilter.startsWith('path:') && flow.path.startsWith(trafficFilter.slice(5))) || (trafficFilter.startsWith('status:') && String(flow.status).startsWith(trafficFilter.slice(7)))),
  ), [query, trafficFilter, trackedIds]);
  const selected = demoFlows.find((flow) => flow.id === selectedFlow);

  useEffect(() => { localStorage.setItem('traffic-studio-tracked-flows', JSON.stringify(trackedIds)); }, [trackedIds]);
  function toggleTracked(id: number) { setTrackedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function openTab(view: View, label?: string, node?: ExplorerNode) {
    setSection(view);
    if (view !== 'api' && view !== 'traffic') { setMenu(null); return; }
    const existing = tabs.find((tab) => tab.view === view && (node ? tab.node?.id === node.id : tab.label === (label ?? titleFor(view))));
    if (existing) { setActiveTab(existing.id); setMenu(null); return; }
    const id = Date.now();
    setTabs((current) => [...current, { id, label: label ?? titleFor(view), view, node: node && node.kind !== 'group' ? { id: node.id, name: node.name, kind: node.kind } : undefined }]);
    setActiveTab(id);
    setMenu(null);
  }

  function closeTab(id: number) {
    if (tabs.length === 1) return;
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    if (activeTab === id) { const sameSection = remaining.filter((tab) => tab.view === section); const next = sameSection.at(-1) ?? remaining.at(-1)!; setActiveTab(next.id); setSection(next.view); }
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault(); setRecording((value) => !value); flash('Capture state is simulated; the proxy core is not connected yet.');
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault(); openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault(); flash('Import HAR sẽ được nối với core ở giai đoạn tiếp theo.');
      }
      if (event.key === 'Escape') setMenu(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs]);

  return <div className="app-shell" onClick={() => menu && setMenu(null)}>
    <header className="app-menu">
      <div className="brand" title="Traffic Studio"><div className="brand-mark"><Activity size={18} strokeWidth={2.3}/></div><span>TRAFFIC<span className="brand-accent">STUDIO</span></span></div>
      <nav className="menu-list" aria-label="Application menu">
        {menuNames.map((name) => <div className="menu-wrap" key={name} onClick={(event) => event.stopPropagation()}>
          <button className={`menu-trigger ${menu === name ? 'menu-open' : ''}`} onClick={() => setMenu(menu === name ? null : name)}>{name}</button>
          {menu === name && <div className="menu-popover">
            {(name === 'File' ? [
              ['New API request', () => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`), 'Ctrl+T'],
              ['Open HAR file', () => flash('Import HAR sẽ được nối với core ở giai đoạn tiếp theo.'), 'Ctrl+O'],
              ['New workspace', () => flash('Workspace mới sẽ có trong giai đoạn tiếp theo.'), ''],
            ] : name === 'View' ? [
              ['Traffic', () => openTab('traffic'), ''], ['Rules', () => openTab('rules'), ''],
              ['History', () => openTab('history'), ''], ['Tracker', () => openTab('tracker'), ''], ['Analytics', () => openTab('analytics'), ''], ['Environments', () => openTab('environments'), ''], ['Toggle sidebar', () => setShowSidebar((v) => !v), ''],
            ] : name === 'Traffic' ? [
              [recording ? 'Stop capture preview' : 'Start capture preview', () => { setRecording((v) => !v); flash('Capture state is simulated; the proxy core is not connected yet.'); }, 'Ctrl+G'],
              ['Load demo traffic', () => { setShowDemo(true); openTab('traffic'); }, ''],
              ['Clear traffic', () => { setShowDemo(false); setSelectedFlow(null); }, ''],
            ] : [
              [`${name} overview`, () => flash(`${name} tools will connect to the proxy core in the next phase.`), ''],
            ]).map(([label, action, shortcut]) => <button className="menu-item" key={label as string} onClick={() => { (action as () => void)(); setMenu(null); }}><span>{label as string}</span><kbd>{shortcut as string}</kbd></button>)}
          </div>}
        </div>)}
      </nav>
      <div className="menu-right"><span className="workspace-badge"><span className="badge-dot"/> UI PREVIEW</span><button className="header-icon" title="Help" onClick={() => flash('Traffic Studio — desktop shell preview')}><CircleHelp size={16}/></button></div>
    </header>

    <div className="app-body">
      <aside className="side-rail">
        <div className="rail-group">
          <RailButton icon={<Radio/>} label="Traffic" active={section === 'traffic'} onClick={() => openTab('traffic')}/>
          <RailButton icon={<Code2/>} label="API client" active={section === 'api'} onClick={() => openTab('api')}/>
          <RailButton icon={<SlidersHorizontal/>} label="Rules" active={section === 'rules'} onClick={() => openTab('rules')}/>
          <RailButton icon={<History/>} label="History" active={section === 'history'} onClick={() => openTab('history')}/>
          <RailButton icon={<KanbanSquare/>} label="Tracker" active={section === 'tracker'} onClick={() => openTab('tracker')}/>
          <RailButton icon={<BarChart3/>} label="Analytics" active={section === 'analytics'} onClick={() => openTab('analytics')}/>
          <RailButton icon={<KeyRound/>} label="Environments" active={section === 'environments'} onClick={() => openTab('environments')}/>
          <RailButton icon={<Wifi/>} label="Devices" active={section === 'devices'} onClick={() => openTab('devices')}/>
          <div className="rail-divider"/>
          <RailButton icon={<Wrench/>} label="Toolbox" active={section === 'tools'} onClick={() => openTab('tools')}/>
        </div>
        <div className="rail-group rail-bottom">
          <RailButton icon={<PanelLeftClose/>} label="Toggle sidebar" onClick={() => setShowSidebar((v) => !v)}/>
          <RailButton icon={<Settings2/>} label="Settings" onClick={() => flash('Settings panel is planned for the next iteration.')}/>
        </div>
      </aside>

      {showSidebar && (section === 'traffic' || section === 'api') && <ExplorerSidebar section={section} flows={showDemo ? demoFlows : []} trackedIds={trackedIds} selectedFlow={selectedFlow} onSelectFlow={(id) => { if (id) { setShowDemo(true); setSelectedFlow(id); } setTrafficFilter('all'); }} onTrack={toggleTracked} onOpenNode={(node) => openTab('api', node.name, node)} onCreateRequest={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)} onSetTrafficFilter={setTrafficFilter} trafficFilter={trafficFilter}/>}

      <main className="main-area">
        <div className="capture-toolbar">
          <div className="proxy-card">
            <div className={`proxy-led ${recording ? 'live' : ''}`}/>
            <div className="proxy-info"><span className="proxy-eyebrow">PROXY ENDPOINT PREVIEW</span><span className="proxy-address">Planned listener <strong>{endpoint}</strong></span></div>
            <button className="icon-button subtle" title="Edit proxy address" onClick={() => { setEndpointDraft(endpoint); setEditingEndpoint(true); }}><Settings2 size={17}/></button>
            <span className="toolbar-separator"/>
            <span className="proxy-status"><ShieldCheck size={17}/><span>Engine not connected</span></span>
          </div>
          <button className={`record-button ${recording ? 'is-recording' : ''}`} onClick={() => { setRecording((v) => !v); flash('Capture state is simulated; the proxy core is not connected yet.'); }}>
            {recording ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}
            <span>{recording ? 'Pause capture' : 'Start capture'}</span>
            <kbd>Ctrl G</kbd>
          </button>
          <button className="clear-button" title="Clear traffic" onClick={() => { setShowDemo(false); setSelectedFlow(null); }}><Trash2 size={18}/></button>
        </div>

        {(section === 'traffic' || section === 'api') && <div className="tab-bar">
          <div className="tabs-scroll">{tabs.filter((tab) => tab.view === section).map((tab) => <div className={`workspace-tab ${activeTab === tab.id ? 'active' : ''}`} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {iconFor(tab.view)}<span>{tab.label}</span>{tab.view === 'traffic' && <span className="tab-count">{showDemo ? demoFlows.length : 0}</span>}
            {tab.view === 'api' && <button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} title="Close tab"><X size={13}/></button>}
          </div>)}</div>
          <button className="new-tab" title="New API request" onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={19}/></button>
          <div className="tab-spacer"/>
          <button className="tab-tool" title="Panel layout" onClick={() => flash('Dockable panels will be available in the next iteration.')}><LayoutPanelLeft size={17}/></button>
          <button className="tab-tool" title="More view options" onClick={() => flash('View presets will be available in the next iteration.')}><MoreHorizontal size={18}/></button>
        </div>}

        <div className="content-area">
          {section === 'traffic' && (showDemo ? <div className="traffic-view">
            <div className="traffic-controls"><div className="traffic-heading"><Activity size={17}/><strong>Sample traffic</strong><span className="muted-count">{flows.length} requests</span></div><div className="control-right"><div className="search-box"><Search size={15}/><input aria-label="Search traffic" placeholder="Search host, path, status…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>⌘ K</kbd></div><button className="outline-button" onClick={() => flash('Advanced filters will connect to the proxy core.')}><Filter size={15}/> Filters <ChevronDown size={13}/></button></div></div>
            <div className="traffic-filter-strip">{[['all','All'],['tracked','Bookmarked'],['status:2','2xx'],['status:4','4xx']].map(([value,label]) => <button key={value} className={trafficFilter === value ? 'active' : ''} onClick={() => setTrafficFilter(value)}>{label}</button>)}<span>Tick a request to bookmark it in Explorer</span></div>
            <div className="traffic-layout"><div className="flow-list"><div className="flow-head"><span>TRACK</span><span>METHOD</span><span>REQUEST</span><span>STATUS</span><span>TYPE</span><span>TIME</span><span>SIZE</span></div>{flows.map((flow) => <div className={`flow-row ${selectedFlow === flow.id ? 'selected' : ''}`} key={flow.id} role="button" tabIndex={0} onClick={() => setSelectedFlow(flow.id)} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedFlow(flow.id); }}><span className="flow-track"><input type="checkbox" checked={trackedIds.includes(flow.id)} aria-label={`Bookmark ${flow.method} ${flow.host}${flow.path}`} onClick={(event) => event.stopPropagation()} onChange={() => toggleTracked(flow.id)}/></span><span className={`method method-${flow.method.toLowerCase()}`}>{flow.method}</span><span className="flow-request"><strong>{flow.host}</strong><span>{flow.path}</span></span><span className={`status-code ${flow.status >= 400 ? 'error' : ''}`}>{flow.status}</span><span className="flow-type">{flow.type}</span><span className="flow-time">{flow.duration} ms</span><span className="flow-size">{flow.size}</span></div>)}{flows.length === 0 && <div className="no-results">No requests match the selected filter.</div>}</div>
            {selected && <aside className="inspector"><div className="inspector-title"><div><span className="eyebrow">REQUEST #{selected.id}</span><h2>{selected.method} {selected.path}</h2></div><button className="icon-button" onClick={() => setSelectedFlow(null)} title="Close inspector"><X size={17}/></button></div><div className="inspector-tabs"><button className="active">Overview</button><button onClick={() => flash('Headers inspector will connect to captured data.')}>Headers</button><button onClick={() => flash('Body inspector will connect to captured data.')}>Body</button></div><div className="inspector-body"><div className="detail-label">GENERAL</div><Detail label="Host" value={selected.host}/><Detail label="Method" value={selected.method}/><Detail label="Status" value={String(selected.status)}/><Detail label="Duration" value={`${selected.duration} ms`}/><Detail label="Content type" value={selected.type}/><div className="detail-label section-gap">TIMELINE</div><div className="timing-bar"><span style={{width:'12%'}}/><span style={{width:'27%'}}/><span style={{width:'61%'}}/></div><div className="timing-legend"><span>DNS</span><span>Connection</span><span>Response</span></div></div></aside>}
            </div>
          </div> : <div className="empty-canvas"><div className="empty-content"><div className="empty-graphic"><div className="graphic-ring ring-one"/><div className="graphic-ring ring-two"/><div className="graphic-core"><Activity size={29} strokeWidth={1.8}/></div><div className="orbit-dot orbit-a"/><div className="orbit-dot orbit-b"/></div><div className="eyebrow center">READY TO INSPECT</div><h1>See every request, clearly.</h1><p>Capture traffic from your desktop, inspect every detail, and turn any request into a reproducible test.</p><div className="empty-actions"><button className="primary-action" onClick={() => { setRecording(true); flash('Capture state is simulated; the proxy core is not connected yet.'); }}><Play size={16} fill="currentColor"/> Start capturing <span>Ctrl G</span></button><button className="secondary-action" onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={17}/> New API request</button></div><div className="quick-links"><button onClick={() => flash('Import HAR will be available with the capture core.')}><FolderOpen size={15}/> Open HAR file</button><span/><button onClick={() => setShowDemo(true)}><Sparkles size={15}/> Explore sample traffic</button></div></div></div>)}
          {section === 'api' && (active.node?.kind === 'setup' ? <SetupFileView key={active.node.id} node={active.node}/> : <ApiView key={active.id} flash={flash} requestName={active.node?.name ?? active.label} tabId={active.id}/>)}
          {section === 'rules' && <RulesView flash={flash}/>}
          {section === 'history' && <HistoryView flash={flash}/>}
          {section === 'devices' && <DevicesView flash={flash}/>}
          {section === 'tools' && <ToolboxView flash={flash}/>}
          {section === 'tracker' && <TrackerView flash={flash}/>}
          {section === 'analytics' && <AnalyticsView/>}
          {section === 'environments' && <EnvironmentsView flash={flash}/>}
        </div>
      </main>
    </div>

    <footer className="status-bar"><div className="status-left"><span className={`footer-led ${recording ? 'live' : ''}`}/><span>{recording ? 'DEMO CAPTURE' : 'UI PREVIEW'}</span><span className="status-divider"/><span>{endpoint}</span></div><div className="status-center"><Sparkles size={14}/> Desktop shell preview · No network traffic is being captured</div><div className="status-right"><span>HTTP / HTTPS</span><span className="status-divider"/><span>0.1.0 Preview</span><button title="Expand view" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14}/></button></div></footer>

    {editingEndpoint && <div className="modal-backdrop" onClick={() => setEditingEndpoint(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-icon"><Globe2 size={20}/></div><h2>Proxy address</h2><p>Choose the local interface and port used by the desktop capture engine.</p><label htmlFor="endpoint-input">LISTEN ADDRESS</label><input id="endpoint-input" autoFocus value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && /^.+:\d+$/.test(endpointDraft)) { setEndpoint(endpointDraft); setEditingEndpoint(false); } }}/><div className="modal-actions"><button className="secondary-action" onClick={() => setEditingEndpoint(false)}>Cancel</button><button className="primary-action" disabled={!/^.+:\d+$/.test(endpointDraft)} onClick={() => { setEndpoint(endpointDraft); setEditingEndpoint(false); }}>Save address</button></div><div className="modal-note">UI setting only — the proxy service is not connected yet.</div></div></div>}
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

function titleFor(view: View) { return ({ traffic: 'Traffic', api: 'API', rules: 'Rules', history: 'History', devices: 'Devices', tools: 'Toolbox', tracker: 'Tracker', analytics: 'Analytics', environments: 'Environments' })[view]; }
function iconFor(view: View) { return ({ traffic: <Radio size={15}/>, api: <Code2 size={15}/>, rules: <SlidersHorizontal size={15}/>, history: <History size={15}/>, devices: <Wifi size={15}/>, tools: <Wrench size={15}/>, tracker: <KanbanSquare size={15}/>, analytics: <BarChart3 size={15}/>, environments: <KeyRound size={15}/> })[view]; }
function RailButton({icon,label,active,onClick}:{icon:ReactNode;label:string;active?:boolean;onClick:()=>void}) { return <button className={`rail-button ${active ? 'active' : ''}`} title={label} aria-label={label} onClick={onClick}>{icon}</button>; }
function Detail({label,value}:{label:string;value:string}) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }

export default App;
