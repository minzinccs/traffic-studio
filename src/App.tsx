import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tab, View } from './domain/types';
import { demoFlows } from './data/demoFlows';
import { ApiView } from './views/ApiView';
import { PlaceholderView } from './views/PlaceholderView';
import {
  Activity, Check,
  ChevronDown, CircleHelp, Code2,
  Filter, FolderOpen, Globe2, History,
  LayoutPanelLeft, Maximize2, MoreHorizontal, PanelLeftClose,
  Pause, Play, Plus, Radio, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Trash2, Wifi, Wrench, X,
} from 'lucide-react';

const menuNames = ['File', 'Tools', 'View', 'Traffic', 'Proxy', 'Certificate', 'Help'];

function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: 'Traffic', view: 'traffic' }]);
  const [activeTab, setActiveTab] = useState(1);
  const [recording, setRecording] = useState(false);
  const [endpoint, setEndpoint] = useState('127.0.0.1:9000');
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const flows = useMemo(() => demoFlows.filter((flow) =>
    `${flow.method} ${flow.host} ${flow.path} ${flow.status}`.toLowerCase().includes(query.toLowerCase()),
  ), [query]);
  const selected = demoFlows.find((flow) => flow.id === selectedFlow);

  function openTab(view: View, label?: string) {
    const existing = tabs.find((tab) => tab.view === view && tab.label === (label ?? titleFor(view)));
    if (existing) { setActiveTab(existing.id); return; }
    const id = Date.now();
    setTabs((current) => [...current, { id, label: label ?? titleFor(view), view }]);
    setActiveTab(id);
    setMenu(null);
  }

  function closeTab(id: number) {
    if (tabs.length === 1) return;
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    if (activeTab === id) setActiveTab(remaining[remaining.length - 1].id);
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
              ['History', () => openTab('history'), ''], ['Toggle sidebar', () => setRailCollapsed((v) => !v), ''],
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
      <aside className={`side-rail ${railCollapsed ? 'collapsed' : ''}`}>
        <div className="rail-group">
          <RailButton icon={<Radio/>} label="Traffic" active={active.view === 'traffic'} onClick={() => openTab('traffic')}/>
          <RailButton icon={<Code2/>} label="API client" active={active.view === 'api'} onClick={() => openTab('api')}/>
          <RailButton icon={<SlidersHorizontal/>} label="Rules" active={active.view === 'rules'} onClick={() => openTab('rules')}/>
          <RailButton icon={<History/>} label="History" active={active.view === 'history'} onClick={() => openTab('history')}/>
          <RailButton icon={<Wifi/>} label="Devices" active={active.view === 'devices'} onClick={() => openTab('devices')}/>
          <div className="rail-divider"/>
          <RailButton icon={<Wrench/>} label="Toolbox" active={active.view === 'tools'} onClick={() => openTab('tools')}/>
        </div>
        <div className="rail-group rail-bottom">
          <RailButton icon={<PanelLeftClose/>} label="Toggle sidebar" onClick={() => setRailCollapsed((v) => !v)}/>
          <RailButton icon={<Settings2/>} label="Settings" onClick={() => flash('Settings panel is planned for the next iteration.')}/>
        </div>
      </aside>

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

        <div className="tab-bar">
          <div className="tabs-scroll">{tabs.map((tab) => <div className={`workspace-tab ${activeTab === tab.id ? 'active' : ''}`} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {iconFor(tab.view)}<span>{tab.label}</span>{tab.view === 'traffic' && <span className="tab-count">{showDemo ? demoFlows.length : 0}</span>}
            {tabs.length > 1 && <button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} title="Close tab"><X size={13}/></button>}
          </div>)}</div>
          <button className="new-tab" title="New API request" onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={19}/></button>
          <div className="tab-spacer"/>
          <button className="tab-tool" title="Panel layout" onClick={() => flash('Dockable panels will be available in the next iteration.')}><LayoutPanelLeft size={17}/></button>
          <button className="tab-tool" title="More view options" onClick={() => flash('View presets will be available in the next iteration.')}><MoreHorizontal size={18}/></button>
        </div>

        <div className="content-area">
          {active.view === 'traffic' && (showDemo ? <div className="traffic-view">
            <div className="traffic-controls"><div className="traffic-heading"><Activity size={17}/><strong>Live traffic</strong><span className="muted-count">{flows.length} requests</span></div><div className="control-right"><div className="search-box"><Search size={15}/><input aria-label="Search traffic" placeholder="Search host, path, status…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>⌘ K</kbd></div><button className="outline-button" onClick={() => flash('Advanced filters will connect to the proxy core.')}><Filter size={15}/> Filters <ChevronDown size={13}/></button></div></div>
            <div className="traffic-layout"><div className="flow-list"><div className="flow-head"><span>METHOD</span><span>REQUEST</span><span>STATUS</span><span>TYPE</span><span>TIME</span><span>SIZE</span></div>{flows.map((flow) => <button className={`flow-row ${selectedFlow === flow.id ? 'selected' : ''}`} key={flow.id} onClick={() => setSelectedFlow(flow.id)}><span className={`method method-${flow.method.toLowerCase()}`}>{flow.method}</span><span className="flow-request"><strong>{flow.host}</strong><span>{flow.path}</span></span><span className={`status-code ${flow.status >= 400 ? 'error' : ''}`}>{flow.status}</span><span className="flow-type">{flow.type}</span><span className="flow-time">{flow.duration} ms</span><span className="flow-size">{flow.size}</span></button>)}{flows.length === 0 && <div className="no-results">No requests match your search.</div>}</div>
            {selected && <aside className="inspector"><div className="inspector-title"><div><span className="eyebrow">REQUEST #{selected.id}</span><h2>{selected.method} {selected.path}</h2></div><button className="icon-button" onClick={() => setSelectedFlow(null)} title="Close inspector"><X size={17}/></button></div><div className="inspector-tabs"><button className="active">Overview</button><button onClick={() => flash('Headers inspector will connect to captured data.')}>Headers</button><button onClick={() => flash('Body inspector will connect to captured data.')}>Body</button></div><div className="inspector-body"><div className="detail-label">GENERAL</div><Detail label="Host" value={selected.host}/><Detail label="Method" value={selected.method}/><Detail label="Status" value={String(selected.status)}/><Detail label="Duration" value={`${selected.duration} ms`}/><Detail label="Content type" value={selected.type}/><div className="detail-label section-gap">TIMELINE</div><div className="timing-bar"><span style={{width:'12%'}}/><span style={{width:'27%'}}/><span style={{width:'61%'}}/></div><div className="timing-legend"><span>DNS</span><span>Connection</span><span>Response</span></div></div></aside>}
            </div>
          </div> : <div className="empty-canvas"><div className="empty-content"><div className="empty-graphic"><div className="graphic-ring ring-one"/><div className="graphic-ring ring-two"/><div className="graphic-core"><Activity size={29} strokeWidth={1.8}/></div><div className="orbit-dot orbit-a"/><div className="orbit-dot orbit-b"/></div><div className="eyebrow center">READY TO INSPECT</div><h1>See every request, clearly.</h1><p>Capture traffic from your desktop, inspect every detail, and turn any request into a reproducible test.</p><div className="empty-actions"><button className="primary-action" onClick={() => { setRecording(true); flash('Capture state is simulated; the proxy core is not connected yet.'); }}><Play size={16} fill="currentColor"/> Start capturing <span>Ctrl G</span></button><button className="secondary-action" onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={17}/> New API request</button></div><div className="quick-links"><button onClick={() => flash('Import HAR will be available with the capture core.')}><FolderOpen size={15}/> Open HAR file</button><span/><button onClick={() => setShowDemo(true)}><Sparkles size={15}/> Explore sample traffic</button></div></div></div>)}
          {active.view === 'api' && <ApiView flash={flash}/>}
          {active.view !== 'api' && active.view !== 'traffic' && <PlaceholderView view={active.view} flash={flash}/>}
        </div>
      </main>
    </div>

    <footer className="status-bar"><div className="status-left"><span className={`footer-led ${recording ? 'live' : ''}`}/><span>{recording ? 'DEMO CAPTURE' : 'UI PREVIEW'}</span><span className="status-divider"/><span>{endpoint}</span></div><div className="status-center"><Sparkles size={14}/> Desktop shell preview · No network traffic is being captured</div><div className="status-right"><span>HTTP / HTTPS</span><span className="status-divider"/><span>0.1.0 Preview</span><button title="Expand view" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14}/></button></div></footer>

    {editingEndpoint && <div className="modal-backdrop" onClick={() => setEditingEndpoint(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-icon"><Globe2 size={20}/></div><h2>Proxy address</h2><p>Choose the local interface and port used by the desktop capture engine.</p><label htmlFor="endpoint-input">LISTEN ADDRESS</label><input id="endpoint-input" autoFocus value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && /^.+:\d+$/.test(endpointDraft)) { setEndpoint(endpointDraft); setEditingEndpoint(false); } }}/><div className="modal-actions"><button className="secondary-action" onClick={() => setEditingEndpoint(false)}>Cancel</button><button className="primary-action" disabled={!/^.+:\d+$/.test(endpointDraft)} onClick={() => { setEndpoint(endpointDraft); setEditingEndpoint(false); }}>Save address</button></div><div className="modal-note">UI setting only — the proxy service is not connected yet.</div></div></div>}
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

function titleFor(view: View) { return ({ traffic: 'Traffic', api: 'API', rules: 'Rules', history: 'History', devices: 'Devices', tools: 'Toolbox' })[view]; }
function iconFor(view: View) { return ({ traffic: <Radio size={15}/>, api: <Code2 size={15}/>, rules: <SlidersHorizontal size={15}/>, history: <History size={15}/>, devices: <Wifi size={15}/>, tools: <Wrench size={15}/> })[view]; }
function RailButton({icon,label,active,onClick}:{icon:ReactNode;label:string;active?:boolean;onClick:()=>void}) { return <button className={`rail-button ${active ? 'active' : ''}`} title={label} aria-label={label} onClick={onClick}>{icon}</button>; }
function Detail({label,value}:{label:string;value:string}) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }

export default App;
