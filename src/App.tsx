import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Tab, View } from './domain/types';
import { listFlows } from './bridge/mockBridge';
import { ApiView } from './features/api/ApiView';
import { CollectionsPanel } from './features/api/CollectionsPanel';
import { HistoryView } from './features/history/HistoryView';
import { HistorySidebar } from './features/history/HistorySidebar';
import type { HistorySelection } from './features/history/sessions';
import type { ApiProfile } from './features/api/collections';
import { DeviceSidebar } from './features/devices/DeviceSidebar';
import { DevicesView } from './features/devices/DevicesView';
import { EnvironmentSidebar } from './features/environments/EnvironmentSidebar';
import { ToolboxSidebar } from './features/tools/ToolboxSidebar';
import { defaultTool } from './features/tools/tools';
import { TrafficInspector } from './features/capture/TrafficInspector';
import { TrafficTable } from './features/capture/TrafficTable';
import { TrafficFilters, emptyFacets, type TrafficFacets } from './features/capture/TrafficFilters';
import { ExplorerSidebar, SetupFileView, type ExplorerNode } from './shell/ExplorerSidebar';
import { WorkspaceTabs } from './shell/WorkspaceTabs';
import { MenuBar } from './shell/MenuBar';
import { buildMenus } from './shell/menuModel';
import { isSidebarMode, modeForSection, sectionForMode, sidebarKindFor, sidebarModes, type SidebarMode } from './shell/sidebarModes';
import { AnalyticsView, EnvironmentsView, RulesView, ToolboxView, TrackerView } from './views/WorkspacePages';
import './views/workspacePages.css';
import './shell/resizers.css';
import './shell/splitPane.css';
import {
  Activity, BarChart3, Check,
  ChevronDown, CircleHelp, Code2,
  Filter, FolderOpen, Globe2, History, Info, KanbanSquare, Keyboard,
  Maximize2, PanelLeftClose,
  Pause, Play, Plus, Radio, Search, Settings2, ShieldCheck, SlidersHorizontal, KeyRound,
  Sparkles, Trash2, Wifi, Wrench,
} from 'lucide-react';

const sessionKey = 'traffic-studio-session-v1';
const shortcutList: [string, string][] = [
  ['Ctrl+T', 'New API request'],
  ['Ctrl+W', 'Close the active API tab'],
  ['Ctrl+Shift+T', 'Reopen the last closed tab'],
  ['Ctrl+Tab / Ctrl+Shift+Tab', 'Cycle workspace tabs'],
  ['Ctrl+G', 'Toggle capture preview (simulated)'],
  ['Ctrl+O', 'Open HAR file (preview)'],
  ['Ctrl+K', 'Focus the traffic search box'],
  ['F1 – F6', 'Switch the contextual sidebar (Explorer → Toolbox)'],
  ['Esc', 'Close the current menu or dialog'],
];

type Session = { tabs: Tab[]; activeTab: number; section: View; showSidebar: boolean; sidebarWidth?: number; splitTabId?: number | null; splitRatio?: number; sidebarMode?: SidebarMode; apiSidebarMode?: 'explorer' | 'collections' };
function readSession(): Session | null {
  try { const raw = localStorage.getItem(sessionKey); if (!raw) return null; const parsed = JSON.parse(raw) as Session; if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null; return parsed; } catch { return null; }
}
// Sessions saved before FE-2 stored the API sidebar as `apiSidebarMode`; derive
// the new mode from the old fields so an existing browser profile keeps its sidebar.
function sessionMode(session: Session | null): SidebarMode {
  if (isSidebarMode(session?.sidebarMode)) return session!.sidebarMode as SidebarMode;
  return modeForSection(session?.section ?? 'traffic', session?.apiSidebarMode === 'collections' ? 'collections' : 'explorer');
}

function App() {
  const allFlows = useMemo(() => listFlows(), []);
  const savedSession = readSession();
  const [tabs, setTabs] = useState<Tab[]>(savedSession?.tabs ?? [{ id: 1, label: 'Traffic', view: 'traffic' }]);
  const nextTabId = useRef(Math.max(...(savedSession?.tabs ?? [{ id: 1 }]).map((tab) => tab.id)) + 1);
  const [closedTabs, setClosedTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState(savedSession?.activeTab ?? 1);
  const [section, setSection] = useState<View>(savedSession?.section ?? 'traffic');
  const [showSidebar, setShowSidebar] = useState(savedSession?.showSidebar ?? true);
  const [sidebarWidth, setSidebarWidth] = useState(savedSession?.sidebarWidth ?? 272);
  const [splitTabId, setSplitTabId] = useState<number | null>(savedSession?.splitTabId ?? null);
  const [splitRatio, setSplitRatio] = useState(savedSession?.splitRatio ?? 50);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => sessionMode(savedSession));
  const [toolboxTool, setToolboxTool] = useState(defaultTool);
  const [toolboxMode, setToolboxMode] = useState<'Encode' | 'Decode'>('Encode');
  const [envActive, setEnvActive] = useState('Global');
  const [historySelection, setHistorySelection] = useState<HistorySelection>(null);
  const [deviceSelected, setDeviceSelected] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [endpoint, setEndpoint] = useState('127.0.0.1:9000');
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const trafficSearchRef = useRef<HTMLInputElement>(null);
  const [infoPanel, setInfoPanel] = useState<'about' | 'shortcuts' | null>(null);
  const [trackedIds, setTrackedIds] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('traffic-studio-tracked-flows') ?? '[]') as number[]; } catch { return []; } });
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('traffic-studio-favorite-flows') ?? '[]') as number[]; } catch { return []; } });
  const [trafficFilter, setTrafficFilter] = useState('all');
  const [trafficFacets, setTrafficFacets] = useState<TrafficFacets>(emptyFacets);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => localStorage.getItem('traffic-studio-animations-v1') !== 'off');
  const [notice, setNotice] = useState<string | null>(null);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const flows = useMemo(() => allFlows.filter((flow) =>
    `${flow.method} ${flow.host} ${flow.path} ${flow.status}`.toLowerCase().includes(query.toLowerCase()) &&
    (trafficFilter === 'all' || (trafficFilter === 'tracked' && trackedIds.includes(flow.id)) || (trafficFilter === 'favorite' && favoriteIds.includes(flow.id)) || (trafficFilter.startsWith('host:') && flow.host === trafficFilter.slice(5)) || (trafficFilter.startsWith('path:') && flow.path.startsWith(trafficFilter.slice(5))) || (trafficFilter.startsWith('status:') && String(flow.status).startsWith(trafficFilter.slice(7))) || (trafficFilter.startsWith('device:') && flow.device === trafficFilter.slice(7)) || (trafficFilter.startsWith('app:') && flow.app === trafficFilter.slice(4))) &&
    (!trafficFacets.scheme || flow.scheme === trafficFacets.scheme) &&
    (!trafficFacets.type || flow.type.toLowerCase().includes(trafficFacets.type)) &&
    (!trafficFacets.method || flow.method === trafficFacets.method) &&
    (!trafficFacets.status || String(flow.status).startsWith(trafficFacets.status)) &&
    (!trafficFacets.host || flow.host === trafficFacets.host) &&
    (!trafficFacets.app || flow.app === trafficFacets.app),
  ), [allFlows, query, trafficFilter, trackedIds, favoriteIds, trafficFacets]);
  const selected = allFlows.find((flow) => flow.id === selectedFlow);

  useEffect(() => { localStorage.setItem('traffic-studio-tracked-flows', JSON.stringify(trackedIds)); }, [trackedIds]);
  useEffect(() => { localStorage.setItem('traffic-studio-favorite-flows', JSON.stringify(favoriteIds)); }, [favoriteIds]);
  useEffect(() => { localStorage.setItem('traffic-studio-animations-v1', motionEnabled ? 'on' : 'off'); }, [motionEnabled]);
  useEffect(() => {
    localStorage.setItem(sessionKey, JSON.stringify({ tabs, activeTab, section, showSidebar, sidebarWidth, splitTabId, splitRatio, sidebarMode }));
  }, [tabs, activeTab, section, showSidebar, sidebarWidth, splitTabId, splitRatio, sidebarMode]);

  function startSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const start = event.clientX; const width = sidebarWidth;
    const move = (next: PointerEvent) => setSidebarWidth(Math.min(480, Math.max(190, width + next.clientX - start)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  }

  function toggleTracked(id: number) { setTrackedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleFavorite(id: number) { setFavoriteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  // FE-2 — which contextual sidebar the shell renders. Derived from the section
  // so the panel can never disagree with the visible workspace.
  const sidebarKind = showSidebar ? sidebarKindFor(section, sidebarMode) : null;

  function openTab(view: View, label?: string, node?: ExplorerNode) {
    setSection(view);
    setSidebarMode((current) => modeForSection(view, current));
    if (view !== 'api' && view !== 'traffic') return;
    const existing = tabs.find((tab) => tab.view === view && (node ? tab.node?.id === node.id : tab.label === (label ?? titleFor(view))));
    if (existing) { setActiveTab(existing.id); return; }
    const id = nextTabId.current++;
    setTabs((current) => [...current, { id, label: label ?? titleFor(view), view, node: node && node.kind !== 'group' ? { id: node.id, name: node.name, kind: node.kind } : undefined }]);
    setActiveTab(id);
  }

  // Selecting a mode is an explicit "show me this panel" action, so it reveals
  // the sidebar and opens the matching tab without disturbing open API tabs.
  function openMode(mode: SidebarMode) {
    setShowSidebar(true);
    openTab(sectionForMode(mode));
    setSidebarMode(mode);
  }

  function closeTabs(ids: number[]) {
    const closing = tabs.filter((tab) => ids.includes(tab.id) && tab.view === 'api');
    if (!closing.length) return;
    if (closing.some((tab) => tab.dirty) && !window.confirm(`${closing.filter((tab) => tab.dirty).length} API tab(s) have unsaved changes. Close anyway? Drafts remain recoverable in this browser session.`)) return;
    const remaining = tabs.filter((tab) => !closing.some((item) => item.id === tab.id));
    if (splitTabId !== null && closing.some((tab) => tab.id === splitTabId)) setSplitTabId(null);
    setClosedTabs((current) => [...current, ...closing]);
    setTabs(remaining);
    if (closing.some((tab) => tab.id === activeTab)) { const sameSection = remaining.filter((tab) => tab.view === section); const next = sameSection.at(-1) ?? remaining.at(-1)!; setActiveTab(next.id); setSection(next.view); }
  }
  function reopenClosedTab() {
    const tab = closedTabs.at(-1); if (!tab) return;
    setClosedTabs((current) => current.slice(0, -1)); setTabs((current) => [...current, tab]); setActiveTab(tab.id); setSection(tab.view);
  }
  function reorderTab(source: number, target: number) {
    if (source === target) return;
    setTabs((current) => { const result = [...current]; const from = result.findIndex((tab) => tab.id === source); const to = result.findIndex((tab) => tab.id === target); if (from < 0 || to < 0) return current; result.splice(to, 0, result.splice(from, 1)[0]); return result; });
  }
  function pinTab(id: number) {
    setTabs((current) => current.map((tab) => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab));
  }
  function selectTab(id: number) {
    if (splitTabId === id && activeTab !== id) setSplitTabId(activeTab);
    setActiveTab(id);
  }
  function toggleSplit() {
    if (section !== 'api') { flash('Open two API tabs to use the two-pane editor.'); return; }
    if (splitTabId !== null) { setSplitTabId(null); return; }
    const other = tabs.find((tab) => tab.view === 'api' && tab.id !== activeTab);
    if (!other) { flash('Open a second API tab, then choose Panel layout.'); return; }
    setSplitTabId(other.id);
  }
  function startSplitResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault(); const start = event.clientX; const ratio = splitRatio; const width = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 1000;
    const move = (next: PointerEvent) => setSplitRatio(Math.min(70, Math.max(30, ratio + (next.clientX - start) / width * 100)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  }

  function setDirty(tabId: number, dirty: boolean) {
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, dirty } : tab));
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!infoPanel && !editingEndpoint) {
        const fkey = /^F([1-6])$/.exec(event.key);
        if (fkey) { event.preventDefault(); openMode(sidebarModes[Number(fkey[1]) - 1].mode); return; }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault(); setRecording((value) => !value); flash('Capture state is simulated; the proxy core is not connected yet.');
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault(); openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault(); flash('Import HAR sẽ được nối với core ở giai đoạn tiếp theo.');
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && section === 'traffic' && showDemo) {
        event.preventDefault(); trafficSearchRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
        event.preventDefault(); const shown = tabs.filter((tab) => tab.view === section); if (!shown.length) return;
        const index = shown.findIndex((tab) => tab.id === activeTab); const offset = event.shiftKey ? -1 : 1;
        setActiveTab(shown[(index + offset + shown.length) % shown.length].id);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w' && section === 'api') {
        event.preventDefault(); closeTabs([activeTab]);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault(); reopenClosedTab();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, activeTab, section, showDemo, closedTabs, infoPanel, editingEndpoint]);

  const menus = buildMenus({
    newApiRequest: () => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`),
    openHar: () => flash('Import HAR sẽ được nối với core ở giai đoạn tiếp theo.'),
    closeActiveTab: () => closeTabs([activeTab]),
    closeOtherTabs: () => closeTabs(tabs.filter((tab) => tab.view === 'api' && tab.id !== activeTab).map((tab) => tab.id)),
    closeAllTabs: () => closeTabs(tabs.filter((tab) => tab.view === 'api').map((tab) => tab.id)),
    reopenClosedTab,
    canCloseActive: active.view === 'api',
    canCloseTabs: tabs.some((tab) => tab.view === 'api'),
    canReopen: closedTabs.length > 0,
    openView: (view) => openTab(view),
    openToolbox: (tool, mode) => {
      openTab('tools');
      setToolboxTool(tool);
      if (mode === 'Encode' || mode === 'Decode') setToolboxMode(mode);
      flash(`${tool}${mode ? ` · ${mode}` : ''} — runs locally in the Toolbox.`);
    },
    sidebarVisible: showSidebar,
    toggleSidebar: () => setShowSidebar((value) => !value),
    apiActive: section === 'api',
    sidebarMode,
    setSidebarMode: openMode,
    motionEnabled,
    toggleMotion: () => setMotionEnabled((value) => !value),
    splitActive: splitTabId !== null,
    toggleSplit,
    captureRunning: recording,
    toggleCapture: () => { setRecording((value) => !value); flash('Capture state is simulated; the proxy core is not connected yet.'); },
    sampleLoaded: showDemo,
    loadSample: () => { setShowDemo(true); openTab('traffic'); },
    clearTraffic: () => { setShowDemo(false); setSelectedFlow(null); },
    editEndpoint: () => { setEndpointDraft(endpoint); setEditingEndpoint(true); },
    openAbout: () => setInfoPanel('about'),
    openShortcuts: () => setInfoPanel('shortcuts'),
  });

  return <div className="app-shell" data-motion={motionEnabled ? 'on' : 'off'} style={{ '--explorer-width': `${sidebarWidth}px` } as CSSProperties}>
    <header className="app-menu">
      <div className="brand" title="Traffic Studio"><div className="brand-mark"><Activity size={18} strokeWidth={2.3}/></div><span>TRAFFIC<span className="brand-accent">STUDIO</span></span></div>
      <MenuBar menus={menus}/>
      <div className="menu-right"><span className="workspace-badge"><span className="badge-dot"/> UI PREVIEW</span><button className="header-icon" title="About & shortcuts" aria-label="About and keyboard shortcuts" onClick={() => setInfoPanel('about')}><CircleHelp size={16}/></button></div>
    </header>

    <div className="app-body">
      <aside className="side-rail">
        <div className="rail-group">
          <RailButton icon={<Radio/>} label="Traffic" active={section === 'traffic'} onClick={() => openTab('traffic')}/>
          <RailButton icon={<Code2/>} label="API client" active={section === 'api'} onClick={() => openTab('api')} hint="Sidebar F1 / F2"/>
          <RailButton icon={<SlidersHorizontal/>} label="Rules" active={section === 'rules'} onClick={() => openTab('rules')}/>
          <RailButton icon={<History/>} label="History" active={section === 'history'} onClick={() => openTab('history')} hint="Sidebar F4"/>
          <RailButton icon={<KanbanSquare/>} label="Tracker" active={section === 'tracker'} onClick={() => openTab('tracker')}/>
          <RailButton icon={<BarChart3/>} label="Analytics" active={section === 'analytics'} onClick={() => openTab('analytics')}/>
          <RailButton icon={<KeyRound/>} label="Environments" active={section === 'environments'} onClick={() => openTab('environments')} hint="Sidebar F3"/>
          <RailButton icon={<Wifi/>} label="Devices" active={section === 'devices'} onClick={() => openTab('devices')} hint="Sidebar F5"/>
          <div className="rail-divider"/>
          <RailButton icon={<Wrench/>} label="Toolbox" active={section === 'tools'} onClick={() => openTab('tools')} hint="Sidebar F6"/>
        </div>
        <div className="rail-group rail-bottom">
          <RailButton icon={<PanelLeftClose/>} label="Toggle sidebar" onClick={() => setShowSidebar((v) => !v)}/>
          <RailButton icon={<Settings2/>} label="Settings" onClick={() => flash('Settings panel is planned for the next iteration.')}/>
        </div>
      </aside>

      {sidebarKind === 'collections' && <CollectionsPanel onShowExplorer={() => openMode('explorer')} onOpenProfile={(profile: ApiProfile) => openTab('api', profile.name, { id: profile.id, parentId: null, name: profile.name, kind: 'profile' })}/>}
      {(sidebarKind === 'traffic' || sidebarKind === 'explorer') && <ExplorerSidebar section={section} flows={showDemo ? allFlows : []} trackedIds={trackedIds} favoriteIds={favoriteIds} selectedFlow={selectedFlow} onSelectFlow={(id) => { if (id) { setShowDemo(true); setSelectedFlow(id); } setTrafficFilter('all'); }} onTrack={toggleTracked} onFavorite={toggleFavorite} onOpenNode={(node) => openTab('api', node.name, node)} onCreateRequest={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)} onSetTrafficFilter={setTrafficFilter} trafficFilter={trafficFilter} onShowCollections={() => openMode('collections')}/>}
      {sidebarKind === 'history' && <HistorySidebar selected={historySelection} onSelect={setHistorySelection}/>}
      {sidebarKind === 'device' && <DeviceSidebar selected={deviceSelected} onSelect={setDeviceSelected}/>}
      {sidebarKind === 'environment' && <EnvironmentSidebar active={envActive} onActive={setEnvActive}/>}
      {sidebarKind === 'toolbox' && <ToolboxSidebar active={toolboxTool} onSelect={setToolboxTool}/>}
      {sidebarKind && <div className="sidebar-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuenow={sidebarWidth} aria-valuemin={190} aria-valuemax={480} tabIndex={0} onPointerDown={startSidebarResize} onDoubleClick={() => setSidebarWidth(272)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setSidebarWidth((value) => Math.max(190, value - 16)); if (event.key === 'ArrowRight') setSidebarWidth((value) => Math.min(480, value + 16)); }}/>}

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

        {(section === 'traffic' || section === 'api') && <WorkspaceTabs tabs={tabs} activeId={activeTab} section={section} closedCount={closedTabs.length} iconFor={(tab) => iconFor(tab.view)} onSelect={selectTab} onNew={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)} onClose={(id) => closeTabs([id])} onCloseMany={closeTabs} onReorder={reorderTab} onPin={pinTab} onRename={(id, name) => setTabs((current) => current.map((tab) => tab.id === id ? { ...tab, label: name } : tab))} onReopen={reopenClosedTab} onLayout={toggleSplit}/>}

        <div className="content-area">
          {section === 'traffic' && (showDemo ? <div className="traffic-view">
            <div className="traffic-controls"><div className="traffic-heading"><Activity size={17}/><strong>Sample traffic</strong><span className="muted-count">{flows.length} requests</span></div><div className="control-right"><div className="search-box"><Search size={15}/><input ref={trafficSearchRef} aria-label="Search traffic" placeholder="Search host, path, status…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>Ctrl K</kbd></div><button className="outline-button" aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((value) => !value)}><Filter size={15}/> Filters <ChevronDown size={13}/></button></div></div>
            <TrafficFilters flows={allFlows} filter={trafficFilter} onFilter={setTrafficFilter} facets={trafficFacets} onFacets={setTrafficFacets} advancedOpen={advancedFiltersOpen}/>
            <div className="traffic-layout"><TrafficTable flows={flows} selectedFlow={selectedFlow} favoriteIds={favoriteIds} trackedIds={trackedIds} onSelectFlow={setSelectedFlow} onFavorite={toggleFavorite} onTrack={toggleTracked}/>
            <TrafficInspector flow={selected} onClose={() => setSelectedFlow(null)} flash={flash}/>
            </div>
          </div> : <div className="empty-canvas"><div className="empty-content"><div className="empty-graphic"><div className="graphic-ring ring-one"/><div className="graphic-ring ring-two"/><div className="graphic-core"><Activity size={29} strokeWidth={1.8}/></div><div className="orbit-dot orbit-a"/><div className="orbit-dot orbit-b"/></div><div className="eyebrow center">READY TO INSPECT</div><h1>See every request, clearly.</h1><p>Capture traffic from your desktop, inspect every detail, and turn any request into a reproducible test.</p><div className="empty-actions"><button className="primary-action" onClick={() => { setRecording(true); flash('Capture state is simulated; the proxy core is not connected yet.'); }}><Play size={16} fill="currentColor"/> Start capturing <span>Ctrl G</span></button><button className="secondary-action" onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={17}/> New API request</button></div><div className="quick-links"><button onClick={() => flash('Import HAR will be available with the capture core.')}><FolderOpen size={15}/> Open HAR file</button><span/><button onClick={() => setShowDemo(true)}><Sparkles size={15}/> Explore sample traffic</button></div></div></div>)}
          {section === 'api' && <div className={`api-document-layout ${splitTabId !== null ? 'split' : ''}`}><div className="api-document-pane" style={{ width: splitTabId !== null ? `${splitRatio}%` : '100%' }}>{active.node?.kind === 'setup' ? <SetupFileView key={active.node.id} node={active.node}/> : <ApiView key={active.id} flash={flash} requestName={active.node?.name ?? active.label} profileId={active.node?.kind === 'profile' ? active.node.id : undefined} tabId={active.id} onDirty={(dirty) => setDirty(active.id, dirty)}/>}</div>{splitTabId !== null && tabs.some((tab) => tab.id === splitTabId && tab.view === 'api') && <><div className="api-document-divider" role="separator" aria-label="Resize API panes" aria-orientation="vertical" aria-valuenow={splitRatio} aria-valuemin={30} aria-valuemax={70} tabIndex={0} onPointerDown={startSplitResize} onDoubleClick={() => setSplitRatio(50)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setSplitRatio((value) => Math.max(30, value - 2)); if (event.key === 'ArrowRight') setSplitRatio((value) => Math.min(70, value + 2)); }}/><div className="api-document-pane" style={{ flex: 1 }}><div className="api-pane-caption">{tabs.find((tab) => tab.id === splitTabId)?.label}<button onClick={() => setSplitTabId(null)}>Close split</button></div>{(() => { const tab = tabs.find((item) => item.id === splitTabId)!; return tab.node?.kind === 'setup' ? <SetupFileView key={tab.node.id} node={tab.node}/> : <ApiView key={tab.id} flash={flash} requestName={tab.node?.name ?? tab.label} profileId={tab.node?.kind === 'profile' ? tab.node.id : undefined} tabId={tab.id} onDirty={(dirty) => setDirty(tab.id, dirty)}/>; })()}</div></>}</div>}
          {section === 'rules' && <RulesView flash={flash}/>}
          {section === 'history' && <HistoryView flash={flash} selection={historySelection} sidebarVisible={sidebarKind === 'history'} onShowSidebar={() => setShowSidebar(true)} onOpenRequest={(name) => openTab('api', name)} onShowTraffic={() => { setActiveTab(tabs.find((tab) => tab.view === 'traffic')?.id ?? 0); setSection('traffic'); setShowDemo(true); }}/>}
          {section === 'devices' && <DevicesView flash={flash} selected={deviceSelected} onSelect={setDeviceSelected}/>}
          {section === 'tools' && <ToolboxView flash={flash} tool={toolboxTool} mode={toolboxMode} onTool={setToolboxTool} onMode={setToolboxMode} showList={sidebarKind !== 'toolbox'}/>}
          {section === 'tracker' && <TrackerView flash={flash}/>}
          {section === 'analytics' && <AnalyticsView onInspectHost={(host) => { setTrafficFilter(`host:${host}`); setActiveTab(tabs.find((tab) => tab.view === 'traffic')?.id ?? 0); setShowDemo(true); setSection('traffic'); }}/>}
          {section === 'environments' && <EnvironmentsView flash={flash} active={envActive} onActive={setEnvActive} showList={sidebarKind !== 'environment'}/>}
        </div>
      </main>
    </div>

    <footer className="status-bar"><div className="status-left"><span className={`footer-led ${recording ? 'live' : ''}`}/><span>{recording ? 'DEMO CAPTURE' : 'UI PREVIEW'}</span><span className="status-divider"/><span>{endpoint}</span></div><div className="status-center"><Sparkles size={14}/> Desktop shell preview · No network traffic is being captured</div><div className="status-right"><span>HTTP / HTTPS</span><span className="status-divider"/><span>0.1.0 Preview</span><button title="Expand view" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14}/></button></div></footer>

    {editingEndpoint && <div className="modal-backdrop" onClick={() => setEditingEndpoint(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-icon"><Globe2 size={20}/></div><h2>Proxy address</h2><p>Choose the local interface and port used by the desktop capture engine.</p><label htmlFor="endpoint-input">LISTEN ADDRESS</label><input id="endpoint-input" autoFocus value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && /^.+:\d+$/.test(endpointDraft)) { setEndpoint(endpointDraft); setEditingEndpoint(false); } }}/><div className="modal-actions"><button className="secondary-action" onClick={() => setEditingEndpoint(false)}>Cancel</button><button className="primary-action" disabled={!/^.+:\d+$/.test(endpointDraft)} onClick={() => { setEndpoint(endpointDraft); setEditingEndpoint(false); }}>Save address</button></div><div className="modal-note">UI setting only — the proxy service is not connected yet.</div></div></div>}
    {infoPanel && <div className="modal-backdrop" onClick={() => setInfoPanel(null)}><div className="modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-icon">{infoPanel === 'about' ? <Info size={20}/> : <Keyboard size={20}/>}</div>
      <h2>{infoPanel === 'about' ? 'About Traffic Studio' : 'Keyboard Shortcuts'}</h2>
      {infoPanel === 'about'
        ? <p>Traffic Studio is a Windows desktop workspace preview (Tauri 2 + React / TypeScript / Vite). This build is frontend-only: no proxy listener, HTTP client, certificate manager or local storage is connected, so capture, Send and rule execution are simulated.</p>
        : <ul className="shortcut-list">{shortcutList.map(([keys, label]) => <li key={keys}><kbd>{keys}</kbd><span>{label}</span></li>)}</ul>}
      <div className="modal-actions"><button className="primary-action" onClick={() => setInfoPanel(null)}>Close</button></div>
      {infoPanel === 'about' && <div className="modal-note">Version 0.1.0 Preview · UI only — no network traffic is captured.</div>}
    </div></div>}
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

function titleFor(view: View) { return ({ traffic: 'Traffic', api: 'API', rules: 'Rules', history: 'History', devices: 'Devices', tools: 'Toolbox', tracker: 'Tracker', analytics: 'Analytics', environments: 'Environments' })[view]; }
function iconFor(view: View) { return ({ traffic: <Radio size={15}/>, api: <Code2 size={15}/>, rules: <SlidersHorizontal size={15}/>, history: <History size={15}/>, devices: <Wifi size={15}/>, tools: <Wrench size={15}/>, tracker: <KanbanSquare size={15}/>, analytics: <BarChart3 size={15}/>, environments: <KeyRound size={15}/> })[view]; }
function RailButton({icon,label,active,onClick,hint}:{icon:ReactNode;label:string;active?:boolean;onClick:()=>void;hint?:string}) { return <button className={`rail-button ${active ? 'active' : ''}`} title={hint ? `${label} · ${hint}` : label} aria-label={label} onClick={onClick}>{icon}</button>; }

export default App;
