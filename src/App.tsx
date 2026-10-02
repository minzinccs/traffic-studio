import {bridge as nativeBridge} from './bridge';
import { isTauri } from '@tauri-apps/api/core';
import { RuntimeSummary } from './features/storage';
import { DiagnosticsStatus, recordDiagnostic } from './features/diagnostics';
import { UiText, useUiTranslation } from './features/localization';
import { binding, keyChord, shortcutCommands } from './features/settings/shortcuts';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Tab, View, FlowDetail } from './domain/types';
import { listFlows, getFlowDetail } from './bridge/mockBridge';
import { ApiWorkspace } from './features/api/ApiWorkspace';
import { CurlImport } from './features/api/CurlImport';
import { ApiView } from './features/api/ApiView';
import { CollectionsPanel } from './features/api/CollectionsPanel';
import { HistorySidebar } from './features/history/HistorySidebar';
import { findSession, flowsForSession } from './features/history/sessions';
import type { HistorySelection } from './features/history/sessions';
import type { ApiProfile } from './features/api/collections';
import { DeviceSidebar } from './features/devices/DeviceSidebar';
import { DevicesView } from './features/devices/DevicesView';
import { EnvironmentSidebar } from './features/environments/EnvironmentSidebar';
import { ToolboxSidebar } from './features/tools/ToolboxSidebar';
import { defaultTool } from './features/tools/tools';
import {decoderEvent} from './features/tools/decoderInbox';
import { readAnnotations } from './features/capture/FlowAnnotations';
import { readPreviewSessions, type PreviewSession } from './features/capture/sessionFiles';
import { TrafficInspector } from './features/capture/TrafficInspector';
import { TrafficTable } from './features/capture/TrafficTable';
import { TrafficFilters, emptyFacets, type TrafficFacets } from './features/capture/TrafficFilters';
import { ExplorerSidebar, SetupFileView, type ExplorerNode } from './shell/ExplorerSidebar';
import { WorkspaceTabs } from './shell/WorkspaceTabs';
import { SelectField } from './shell/SelectField';
import { Button } from './shell/Button';
import { MenuBar } from './shell/MenuBar';
import { buildMenus } from './shell/menuModel';
import { isSidebarMode, modeForSection, sectionForMode, sidebarKindFor, type SidebarMode } from './shell/sidebarModes';
import { EnvironmentsView } from './features/environments/EnvironmentsView';
import './views/workspacePages.css';
import { usePreferences } from './features/settings/preferences';
import type { SettingsPage } from './features/settings/SettingsCenter';
import type { CertificateTarget } from './features/certificates/setup';
import { ProxyRecoveryNotice } from './features/settings/ProxyRecoveryNotice';
import { NotificationCenter, type Notice } from './features/notifications';
import { ProtocolPreview } from './features/protocols';
import { LayoutManager, type LayoutSnapshot } from './features/layout';

import './shell/resizers.css';
import './shell/splitPane.css';
import {
  Activity, BarChart3, Bell, Check,
  ChevronDown, CircleAlert, CircleHelp, Code2,
  Filter, FolderOpen, Globe2, History, Info, KanbanSquare, Keyboard,
  Layers, Maximize2, PanelLeftClose,
  Pause, Play, Plus, Radio, Search, Settings2, ShieldCheck, SlidersHorizontal, KeyRound,
  Trash2, Wifi, Wrench,
} from 'lucide-react';

const sessionKey = 'traffic-studio-session-v1';
const NativeWorkbench = lazy(() => import('./features/layout/NativeWorkbench').then(module => ({ default: module.NativeWorkbench })));
const NativeTrackerView = lazy(() => import('./features/tracker/NativeTrackerView').then(module => ({ default: module.NativeTrackerView })));
const NativeAnalyticsView = lazy(() => import('./features/analytics/NativeAnalyticsView').then(module => ({ default: module.NativeAnalyticsView })));
const NativeRulesView = lazy(() => import('./features/rules/NativeRulesView').then(module => ({ default: module.NativeRulesView })));
const NativeCaptureWorkspace = lazy(() => import('./features/capture/NativeCaptureWorkspace').then(module => ({ default: module.NativeCaptureWorkspace })));
const HistoryView = lazy(() => import('./features/history/HistoryView').then(module => ({ default: module.HistoryView })));
const ToolboxView = lazy(() => import('./features/tools/ToolboxView').then(module => ({ default: module.ToolboxView })));
const RulesView = lazy(() => import('./features/rules').then(module => ({ default: module.RulesView })));
const TrackerView = lazy(() => import('./features/tracker').then(module => ({ default: module.TrackerView })));
const AnalyticsView = lazy(() => import('./features/analytics').then(module => ({ default: module.AnalyticsView })));
const SessionManager = lazy(() => import('./features/capture/SessionManager').then(module => ({ default: module.SessionManager })));
const FlowCompare = lazy(() => import('./features/capture/FlowCompare').then(module => ({ default: module.FlowCompare })));
const SettingsCenter = lazy(() => import('./features/settings/SettingsCenter').then(module => ({ default: module.SettingsCenter })));
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
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [prefs,savePreferences] = usePreferences();
  const shortcutList = [...shortcutCommands.map(([id, label]) => [binding(prefs.keybindings, id) || 'Disabled', label]), ['Esc', 'Close dialog or menu']];
  const [clipboardCurl,setClipboardCurl]=useState<string|null>(null);
  const [integrationTab,setIntegrationTab]=useState('MCP');
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null);
  const [certificateTarget,setCertificateTarget]=useState<CertificateTarget>('overview');
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const [dropEdge,setDropEdge]=useState<'left'|'right'|null>(null);
  const [paneCount,setPaneCount] = useState(() => Math.min(4,Math.max(1,Number(localStorage.getItem('traffic-studio-pane-count')) || 1)));
  useEffect(()=>{localStorage.setItem('traffic-studio-pane-count',String(paneCount));},[paneCount]);
  const [zen, setZen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(() => localStorage.getItem('traffic-studio-layout-direction') === 'vertical' ? 'vertical' : 'horizontal');
  useEffect(() => { localStorage.setItem('traffic-studio-layout-direction', direction); }, [direction]);
  const apiWorkspaceRef = useRef<HTMLDivElement>(null);
  const [compactApi, setCompactApi] = useState(false);
  const [annotationRevision,setAnnotationRevision]=useState(0);
  useEffect(()=>{const sync=()=>setAnnotationRevision(v=>v+1);window.addEventListener('traffic-studio-annotations-change',sync);return()=>window.removeEventListener('traffic-studio-annotations-change',sync);},[]);
  const [allFlows, setAllFlows] = useState(() => listFlows());
  const [details, setDetails] = useState<Record<number, FlowDetail>>({});
  const [sessionSource,setSessionSource]=useState('Sample traffic');
  const [sessionName, setSessionName] = useState('Sample traffic');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const savedSession = readSession();
  const [tabs, setTabs] = useState<Tab[]>(savedSession?.tabs ?? [{ id: 1, label: 'Traffic', view: 'traffic' }]);
  const nextTabId = useRef(Math.max(...(savedSession?.tabs ?? [{ id: 1 }]).map((tab) => tab.id)) + 1);
  const [closedTabs, setClosedTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState(savedSession?.activeTab ?? 1);
  const [section, setSection] = useState<View>(savedSession?.section ?? 'traffic');
  useEffect(() => {
    if (section !== 'api' || !apiWorkspaceRef.current) return;
    const workspace = apiWorkspaceRef.current;
    const observer = new ResizeObserver(([entry]) => setCompactApi(entry.contentRect.width < 720));
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [section]);
  const [showSidebar, setShowSidebar] = useState(savedSession?.showSidebar ?? true);
  const [sidebarWidth, setSidebarWidth] = useState(savedSession?.sidebarWidth ?? 272);
  const [splitTabId, setSplitTabId] = useState<number | null>(savedSession?.splitTabId ?? null);
  const [splitRatio, setSplitRatio] = useState(savedSession?.splitRatio ?? 50);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => sessionMode(savedSession));
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [toolboxAlgorithm,setToolboxAlgorithm]=useState('SHA-256');
  const [toolboxTool, setToolboxTool] = useState(defaultTool);
  const [toolboxMode, setToolboxMode] = useState<'Encode' | 'Decode'>('Encode');
  const [envActive, setEnvActive] = useState('Global');
  const [historySelection, setHistorySelection] = useState<HistorySelection>(null);
  const [deviceSelected, setDeviceSelected] = useState<string | null>(null);
  const [workbench,setWorkbench]=useState(false);const [workbenchVisited,setWorkbenchVisited]=useState(false);
  const [capturePhase,setCapturePhase]=useState('Stopped');
  const lastNativeCaptureState = useRef<string | null>(null);
  const captureTimer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(captureTimer.current),[]);
  const [recording, setRecording] = useState(false);
  const [endpoint, setEndpoint] = useState(`${prefs.proxy.host}:${prefs.proxy.port}`);
  useEffect(()=>{if(!isTauri())return;let alive=true;const update=()=>void nativeBridge.command('capture_status',undefined).then(status=>{if(alive){lastNativeCaptureState.current=status.state;setRecording(status.state==='recording');setCapturePhase(status.state==='recording'?'Recording':status.state==='error'?'Error':'Stopped');setEndpoint(status.port?`127.0.0.1:${status.port}`:'No native listener');}}).catch(()=>{if(alive){if(lastNativeCaptureState.current!=='error')recordDiagnostic('native','capture_status','unavailable');lastNativeCaptureState.current='error';setRecording(false);setCapturePhase('Error');setEndpoint('Native state unavailable');}});update();const timer=setInterval(update,1500);return()=>{alive=false;clearInterval(timer);};},[]);
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const trafficSearchRef = useRef<HTMLInputElement>(null);
  const [infoPanel, setInfoPanel] = useState<'about' | 'shortcuts' | null>(null);useEffect(()=>{if(!infoPanel)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setInfoPanel(null);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[infoPanel]);
  const [trackedIds, setTrackedIds] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('traffic-studio-tracked-flows') ?? '[]') as number[]; } catch { return []; } });
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem('traffic-studio-favorite-flows') ?? '[]') as number[]; } catch { return []; } });
  const [trafficFilter, setTrafficFilter] = useState('all');
  const [trafficFacets, setTrafficFacets] = useState<TrafficFacets>(emptyFacets);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => localStorage.getItem('traffic-studio-animations-v1') !== 'off');
  const [notice, setNotice] = useState<string | null>(null);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const effectiveDirection = compactApi ? 'vertical' : direction;
  const flowAnnotations=useMemo(()=>readAnnotations(),[annotationRevision]);
  const flows = useMemo(() => allFlows.filter((flow) =>
    `${flow.method} ${flow.host} ${flow.path} ${flow.status}`.toLowerCase().includes(query.toLowerCase()) &&
    (trafficFilter === 'all' || (trafficFilter.startsWith('folder:') && flowAnnotations[`${sessionSource}:${flow.id}`]?.folder === trafficFilter.slice(7)) || (trafficFilter === 'tracked' && trackedIds.includes(flow.id)) || (trafficFilter === 'favorite' && favoriteIds.includes(flow.id)) || (trafficFilter.startsWith('host:') && flow.host === trafficFilter.slice(5)) || (trafficFilter.startsWith('path:') && flow.path.startsWith(trafficFilter.slice(5))) || (trafficFilter.startsWith('status:') && String(flow.status).startsWith(trafficFilter.slice(7))) || (trafficFilter.startsWith('device:') && flow.device === trafficFilter.slice(7)) || (trafficFilter.startsWith('app:') && flow.app === trafficFilter.slice(4))) &&
    (!trafficFacets.scheme || flow.scheme === trafficFacets.scheme) &&
    (!trafficFacets.type || flow.type.toLowerCase().includes(trafficFacets.type)) &&
    (!trafficFacets.method || flow.method === trafficFacets.method) &&
    (!trafficFacets.status || String(flow.status).startsWith(trafficFacets.status)) &&
    (!trafficFacets.host || flow.host === trafficFacets.host) &&
    (!trafficFacets.app || flow.app === trafficFacets.app),
  ), [allFlows, query, trafficFilter, trackedIds, favoriteIds, trafficFacets, sessionSource, flowAnnotations]);
  const selected = allFlows.find((flow) => flow.id === selectedFlow);

  useEffect(() => { localStorage.setItem(sessionSource==='Sample traffic'?'traffic-studio-tracked-flows':`traffic-studio-tracked-flows-${encodeURIComponent(sessionSource)}`, JSON.stringify(trackedIds)); }, [trackedIds,sessionSource]);
  useEffect(() => { localStorage.setItem(sessionSource==='Sample traffic'?'traffic-studio-favorite-flows':`traffic-studio-favorite-flows-${encodeURIComponent(sessionSource)}`, JSON.stringify(favoriteIds)); }, [favoriteIds,sessionSource]);
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

  async function openClipboard(){try{const text=await navigator.clipboard.readText();setClipboardCurl(text);}catch{flash('Clipboard read unavailable. Use Import cURL and paste manually.');}}
  function importClipboardDraft(value:{method:string;url:string;headers:{key:string;value:string}[];body:string}){const id=nextTabId.current;sessionStorage.setItem(`traffic-studio-api-draft-${id}`,JSON.stringify({name:'Clipboard request',...value,headers:value.headers.filter(h=>!/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key)).map((h,i)=>({...h,id:i,enabled:true})),params:[],auth:''}));openTab('api',`Clipboard request ${id}`);setClipboardCurl(null);flash('Created a local cURL draft. Credential headers were excluded.');}
  function composeFlow(id:number){
    const flow=allFlows.find(f=>f.id===id);if(!flow)return;
    const detail=details[id]??getFlowDetail(id);const newId=nextTabId.current;
    sessionStorage.setItem(`traffic-studio-api-draft-${newId}`,JSON.stringify({name:`From flow #${id}`,method:flow.method,url:detail?.url??`${flow.scheme??'https'}://${flow.host}${flow.path}`,params:[],headers:(detail?.requestHeaders??[]).filter(h=>!/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key)).map((h,i)=>({...h,id:i+1,enabled:true})),body:detail?.requestBody??'',auth:''}));
    openTab('api',`From flow #${id} · ${newId}`);
  }
  function saveEndpoint(){const match=/^(.+):(\d+)$/.exec(endpointDraft);if(!match||Number(match[2])<1||Number(match[2])>65535){flash('Invalid port: use 1–65535.');return;}savePreferences({...prefs,proxy:{...prefs.proxy,host:match[1],port:Number(match[2])}});setEndpoint(endpointDraft);setEditingEndpoint(false);}
  function toggleCapturePreview(){
    if(isTauri()){setSection('traffic');flash('Use the native capture controls to select workspace, port and signing CA.');return;}
    if(capturePhase==='Starting'||capturePhase==='Stopping')return;
    const stopping=recording;setCapturePhase(stopping?'Stopping':'Starting');
    captureTimer.current=window.setTimeout(()=>{if(!stopping&&prefs.captureScenario==='Failure'){setRecording(false);setCapturePhase('Error');flash('Simulated capture error: the sample listener failed. No network service was started.');}else{setRecording(!stopping);setCapturePhase(stopping?'Stopped':'Recording');flash('Capture state is simulated; no proxy listener is running.');}},250);
  }
  function loadSession(session: PreviewSession) {
    setSessionSource(session.id);setTrackedIds(readFlowMarks('tracked',session.id));setFavoriteIds(readFlowMarks('favorite',session.id));setAllFlows(session.flows); setDetails(session.details); setSessionName(session.name); setSelectedFlow(null); setQuery(''); setTrafficFilter('all'); setTrafficFacets(emptyFacets); setShowDemo(true); openTab('traffic');
  }
  function readFlowMarks(kind:string,source:string):number[]{try{return JSON.parse(localStorage.getItem(source==='Sample traffic'?`traffic-studio-${kind}-flows`:`traffic-studio-${kind}-flows-${encodeURIComponent(source)}`)??'[]');}catch{return[];}}
  function loadSamples() {setSessionSource('Sample traffic');setTrackedIds(readFlowMarks('tracked','Sample traffic'));setFavoriteIds(readFlowMarks('favorite','Sample traffic')); setSessionSource('Sample traffic');setAllFlows(listFlows()); setDetails({}); setSessionName('Sample traffic'); setQuery(''); setTrafficFilter('all'); setTrafficFacets(emptyFacets); setShowDemo(true); openTab('traffic'); }
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
  useEffect(()=>{const open=()=>{setToolboxTool('Decoder script');openTab('tools');};window.addEventListener(decoderEvent,open);return()=>window.removeEventListener(decoderEvent,open);},[]);

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
    if (splitTabId !== null || paneCount > 1) { setSplitTabId(null); setPaneCount(1); return; }
    const other = tabs.find((tab) => tab.view === 'api' && tab.id !== activeTab);
    if (!other) { flash('Open a second API tab, then choose Panel layout.'); return; }
    setSplitTabId(other.id); setPaneCount(2);
  }
  function choosePaneCount(count: number) {
    setPaneCount(count);
    if(count===2) setSplitTabId(tabs.find(t=>t.view==='api'&&t.id!==activeTab)?.id ?? null);
    else setSplitTabId(null);
  }
  function startSplitResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault(); const start = effectiveDirection === 'vertical' ? event.clientY : event.clientX; const ratio = splitRatio; const bounds = event.currentTarget.parentElement?.getBoundingClientRect(); const width = (effectiveDirection === 'vertical' ? bounds?.height : bounds?.width) ?? 1000;
    const move = (next: PointerEvent) => setSplitRatio(Math.min(70, Math.max(30, ratio + ((effectiveDirection === 'vertical' ? next.clientY : next.clientX) - start) / width * 100)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  }

  function setDirty(tabId: number, dirty: boolean) {
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, dirty } : tab));
  }

  function flash(message: string) {
    setNotifications(current => [{ id: Date.now() + Math.random(), text: message, time: new Date().toLocaleTimeString(), read: false, kind: /error|invalid|failed|unavailable/i.test(message) ? 'error' as const : 'info' as const }, ...current].slice(0, 100));
    window.clearTimeout(toastTimer.current);
    if (prefs.toastEnabled) { setNotice(message); toastTimer.current = window.setTimeout(() => setNotice(null), prefs.toastSeconds * 1000); }
  }
  function applyLayout(value: LayoutSnapshot) {
    setSidebarWidth(Math.min(480, Math.max(190, value.sidebarWidth))); setShowSidebar(value.showSidebar); setSplitRatio(Math.min(75, Math.max(25, value.splitRatio))); setDirection(value.direction); setZen(value.zen); choosePaneCount(value.paneCount ?? 1);
  }
  useEffect(() => { setEndpoint(`${prefs.proxy.host}:${prefs.proxy.port}`); }, [prefs.proxy.host, prefs.proxy.port]);


  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector('[role="dialog"], [role="menu"]') || infoPanel || editingEndpoint) return;
      const chord = keyChord(event);
      if (!chord) return;
      const command = shortcutCommands.find(([id]) => binding(prefs.keybindings, id) === chord)?.[0];
      if (!command) return;
      if (['explorer','collections','environment','history','device','toolbox'].includes(command)) {
        event.preventDefault(); openMode(command as SidebarMode); return;
      }
      if (command === 'capture') { event.preventDefault(); toggleCapturePreview(); }
      if (command === 'newRequest') { event.preventDefault(); openTab('api', `API ${tabs.filter(tab => tab.view === 'api').length + 1}`); }
      if (command === 'openSession') { event.preventDefault(); setSessionOpen(true); }
      if (command === 'search' && section === 'traffic' && showDemo) { event.preventDefault(); trafficSearchRef.current?.focus(); }
      if (command === 'nextTab' || command === 'previousTab') {
        const shown = tabs.filter(tab => tab.view === section); if (!shown.length) return;
        event.preventDefault(); const index = shown.findIndex(tab => tab.id === activeTab);
        setActiveTab(shown[(index + (command === 'previousTab' ? -1 : 1) + shown.length) % shown.length].id);
      }
      if (command === 'closeTab' && section === 'api') { event.preventDefault(); closeTabs([activeTab]); }
      if (command === 'reopenTab') { event.preventDefault(); reopenClosedTab(); }

    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, activeTab, section, showDemo, closedTabs, infoPanel, editingEndpoint, settingsPage, layoutOpen, protocolOpen, sessionOpen, compareOpen, prefs, recording, capturePhase, clipboardCurl]);

  const menus = buildMenus({
    keybindings: prefs.keybindings,
    newApiRequest: () => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`),
    openHar: () => setSessionOpen(true),
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
      setToolboxMode(mode==='Decode'?'Decode':'Encode');if(mode?.startsWith('SHA-')||mode==='HMAC')setToolboxAlgorithm(mode);
      flash(`${tool}${mode ? ` · ${mode}` : ''} — runs locally in the Toolbox.`);
    },
    sidebarVisible: showSidebar,
    toggleSidebar: () => setShowSidebar((value) => !value),
    apiActive: section === 'api',
    sidebarMode,
    setSidebarMode: openMode,
    motionEnabled,
    toggleMotion: () => setMotionEnabled((value) => !value),
    splitActive: paneCount>1 || splitTabId !== null,
    toggleSplit,
    captureRunning: recording,
    toggleCapture: () => { toggleCapturePreview(); },
    sampleLoaded: showDemo,
    loadSample: loadSamples,
    clearTraffic: () => { setShowDemo(false); setSelectedFlow(null); },
    editEndpoint: () => { setEndpointDraft(endpoint); setEditingEndpoint(true); },
    openCertificate:(target)=>{setCertificateTarget(target);setSettingsPage('Certificate');},
    openClipboard,
    openIntegration:(tab)=>{setIntegrationTab(tab);setSettingsPage('Integrations');},
    openSessions: () => setSessionOpen(true),
    openCompare: () => { if (allFlows.length) setCompareOpen(true); },
    openProtocols: () => setProtocolOpen(true),
    openSettings: (page = 'General') => {setCertificateTarget('overview');setSettingsPage(page);},
    zenActive: zen,
    toggleZen: () => setZen(v => !v),
    openLayouts: () => setLayoutOpen(true),
    toggleDirection: () => setDirection(v => v === 'horizontal' ? 'vertical' : 'horizontal'),
    direction,
    openAbout: () => setInfoPanel('about'),
    openShortcuts: () => setInfoPanel('shortcuts'),
  });

  return <div className="app-shell" data-theme={prefs.theme} data-contrast={prefs.contrast} data-corners={prefs.corners} data-rail-labels={prefs.sidebarLabels} data-density={prefs.density} data-toolbar={prefs.toolbar} data-statusbar={prefs.statusbar} data-zen={zen} data-motion={motionEnabled ? 'on' : 'off'} style={{ '--explorer-width': `${sidebarWidth}px`, '--user-accent': prefs.accent, zoom: prefs.zoom / 100, '--ui-zoom':prefs.zoom/100,'--amber':prefs.accent, '--personal-font-size':`${prefs.fontSize}px`, '--personal-code-font':prefs.codeFont==='consolas'?'Consolas, monospace':'ui-monospace, SFMono-Regular, monospace' } as CSSProperties}>
    <ProxyRecoveryNotice onOpen={()=>setSettingsPage('Proxy')}/>
    <header className="app-menu">
      <div className="brand" title="Traffic Studio"><div className="brand-mark"><Activity size={18} strokeWidth={2.3}/></div><span>TRAFFIC<span className="brand-accent">STUDIO</span></span></div>
      <MenuBar menus={menus}/>
      <div className="menu-right"><button className="header-icon" aria-label={`Notifications (${notifications.filter(n => !n.read).length} unread)`} title="Notifications" onClick={() => setNotificationOpen(v => !v)}><Bell size={16}/><small>{notifications.filter(n => !n.read).length || ""}</small></button><span className="workspace-badge"><span className="badge-dot"/> {prefs.displayName || 'My workspace'}</span><button className="header-icon" title="About & shortcuts" aria-label="About and keyboard shortcuts" onClick={() => setInfoPanel('about')}><CircleHelp size={16}/></button></div>
    </header>

    <div className="app-body">
      <aside className="side-rail">
        <div className="rail-group">
          <RailButton icon={<Radio/>} label="Traffic" active={section === 'traffic'} onClick={() => openTab('traffic')}/>
          <RailButton icon={<Code2/>} label="API client" active={section === 'api'} onClick={() => openTab('api')} hint={`Sidebar ${binding(prefs.keybindings, 'explorer')} / ${binding(prefs.keybindings, 'collections')}`}/>
          <RailButton icon={<SlidersHorizontal/>} label="Rules" active={section === 'rules'} onClick={() => openTab('rules')}/>
          <RailButton icon={<History/>} label="History" active={section === 'history'} onClick={() => openTab('history')} hint={`Sidebar ${binding(prefs.keybindings, 'history')}`}/>
          <RailButton icon={<KanbanSquare/>} label="Tracker" active={section === 'tracker'} onClick={() => openTab('tracker')}/>
          <RailButton icon={<BarChart3/>} label="Analytics" active={section === 'analytics'} onClick={() => openTab('analytics')}/>
          <RailButton icon={<KeyRound/>} label="Environments" active={section === 'environments'} onClick={() => openTab('environments')} hint={`Sidebar ${binding(prefs.keybindings, 'environment')}`}/>
          <RailButton icon={<Wifi/>} label="Devices" active={section === 'devices'} onClick={() => openTab('devices')} hint={`Sidebar ${binding(prefs.keybindings, 'device')}`}/>
          <div className="rail-divider"/>
          <RailButton icon={<Wrench/>} label="Toolbox" active={section === 'tools'} onClick={() => openTab('tools')} hint={`Sidebar ${binding(prefs.keybindings, 'toolbox')}`}/>
        </div>
        <div className="rail-group rail-bottom">
          {isTauri()&&<RailButton icon={<Layers/>} label="Mixed workspace" hint="Native panes in one window" onClick={() => { setWorkbenchVisited(true); setWorkbench(true); }}/>}
          <RailButton icon={<PanelLeftClose/>} label="Toggle sidebar" onClick={() => setShowSidebar((v) => !v)}/>
          <RailButton icon={<Settings2/>} label="Settings" onClick={() => setSettingsPage('General')}/>
        </div>
      </aside>

      {sidebarKind === 'collections' && <CollectionsPanel focusId={managedCollectionId} onShowExplorer={() => {setManagedCollectionId(null);openMode('explorer');}} onOpenProfile={(profile: ApiProfile) => openTab('api', profile.name, { id: profile.id, parentId: null, name: profile.name, kind: 'profile' })}/>}
      {(sidebarKind === 'traffic' || sidebarKind === 'explorer') && <ExplorerSidebar source={sessionSource} section={section} flows={showDemo ? allFlows : []} trackedIds={trackedIds} favoriteIds={favoriteIds} selectedFlow={selectedFlow} onSelectFlow={(id) => { if (id) { setShowDemo(true); setSelectedFlow(id); } setTrafficFilter('all'); }} onTrack={toggleTracked} onFavorite={toggleFavorite} onOpenNode={(node) => openTab('api', node.name, node)} onCreateRequest={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)} onSetTrafficFilter={setTrafficFilter} trafficFilter={trafficFilter} onShowCollections={(collectionId) => {setManagedCollectionId(collectionId??null);openMode('collections');}}/>}
      {sidebarKind === 'history' && <HistorySidebar selected={historySelection} onSelect={setHistorySelection}/>}
      {sidebarKind === 'device' && <DeviceSidebar selected={deviceSelected} onSelect={setDeviceSelected}/>}
      {sidebarKind === 'environment' && <EnvironmentSidebar active={envActive} onActive={setEnvActive}/>}
      {sidebarKind === 'toolbox' && <ToolboxSidebar active={toolboxTool} onSelect={setToolboxTool}/>}
      {sidebarKind && <div className="sidebar-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuenow={sidebarWidth} aria-valuemin={190} aria-valuemax={480} tabIndex={0} onPointerDown={startSidebarResize} onDoubleClick={() => setSidebarWidth(272)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setSidebarWidth((value) => Math.max(190, value - 16)); if (event.key === 'ArrowRight') setSidebarWidth((value) => Math.min(480, value + 16)); }}/>}

      <main className="main-area">
        <div className="capture-toolbar">
          <div className="proxy-card">
            <div className={`proxy-led ${recording ? 'live' : ''}`}/>
            <div className="proxy-info"><span className="proxy-eyebrow">PROXY ENDPOINT</span><span className="proxy-address">{isTauri()?'Workspace default':'Planned listener'} <strong>{endpoint}</strong></span></div>
            <button className="icon-button subtle" title="Edit proxy address" onClick={() => { setEndpointDraft(endpoint); setEditingEndpoint(true); }}><Settings2 size={17}/></button>
            <span className="toolbar-separator"/>
            <span className="proxy-status"><ShieldCheck size={17}/><span>{isTauri()?'Configure in Capture':'Browser sample mode'}</span></span>
          </div>
          <Button variant="default" className={recording ? 'is-recording' : ''} disabled={capturePhase==='Starting'||capturePhase==='Stopping'} onClick={() => { toggleCapturePreview(); }}>
            {recording ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}
            <span>{isTauri()?'Open capture':capturePhase==='Starting'||capturePhase==='Stopping'?`${capturePhase} sample…`:recording ? 'Pause sample' : 'Run sample capture'}</span>
            <kbd>{binding(prefs.keybindings, 'capture')}</kbd>
          </Button>
          <Button size="icon" title="Clear traffic" aria-label="Clear traffic" onClick={() => { setShowDemo(false); setSelectedFlow(null); }}><Trash2 size={18}/></Button>
        </div>

        {(section === 'traffic' || section === 'api') && <WorkspaceTabs tabs={tabs} activeId={activeTab} section={section} closedCount={closedTabs.length} iconFor={(tab) => iconFor(tab.view)} onSelect={selectTab} onNew={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)} onClose={(id) => closeTabs([id])} onCloseMany={closeTabs} onReorder={reorderTab} onPin={pinTab} onRename={(id, name) => setTabs((current) => current.map((tab) => tab.id === id ? { ...tab, label: name } : tab))} onReopen={reopenClosedTab} onLayout={toggleSplit}/>}

        <div className="content-area">
          <Suspense fallback={<div className="route-loading" role="status">Loading workspace…</div>}>
          {section === 'traffic' && (isTauri() ? <NativeCaptureWorkspace/> : showDemo ? <div className="traffic-view">
            <div className="traffic-controls"><div className="traffic-heading"><Activity size={17}/><strong>{sessionName} · SAMPLE</strong><span className="muted-count">{flows.length} requests</span></div><div className="control-right"><div className="search-box"><Search size={15}/><input ref={trafficSearchRef} aria-label="Search traffic" placeholder="Search host, path, status…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>{binding(prefs.keybindings, 'search')}</kbd></div><Button aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((value) => !value)}><Filter size={15}/> <UiText text={"Filters"}/> <ChevronDown size={13}/></Button></div></div>
            <TrafficFilters flows={allFlows} filter={trafficFilter} onFilter={setTrafficFilter} facets={trafficFacets} onFacets={setTrafficFacets} advancedOpen={advancedFiltersOpen}/>
            <div className="traffic-layout"><TrafficTable onFeedback={flash} onCompose={composeFlow} onCompare={()=>setCompareOpen(true)} density={prefs.density} onClearFilters={() => { setQuery(''); setTrafficFilter('all'); setTrafficFacets(emptyFacets); }} flows={flows} selectedFlow={selectedFlow} favoriteIds={favoriteIds} trackedIds={trackedIds} onSelectFlow={setSelectedFlow} onFavorite={toggleFavorite} onTrack={toggleTracked}/>
            <TrafficInspector onProtocols={()=>setProtocolOpen(true)} onCertificate={()=>setSettingsPage('Certificate')} source={sessionSource} detailOverride={selected ? details[selected.id] : undefined} onExport={() => setSessionOpen(true)} flow={selected} onClose={() => setSelectedFlow(null)} flash={flash}/>
            </div>
          </div> : <div className="empty-canvas"><div className="empty-content"><div className="empty-graphic"><div className="graphic-ring ring-one"/><div className="graphic-ring ring-two"/><div className="graphic-core"><Activity size={29} strokeWidth={1.8}/></div><div className="orbit-dot orbit-a"/><div className="orbit-dot orbit-b"/></div><div className="eyebrow center"><UiText text={"READY TO INSPECT"}/></div><h1><UiText text={"See every request, clearly."}/></h1><p>Open the Windows app for native capture, or explore sample traffic and inspect each request here.</p><div className="empty-actions"><Button variant="default" onClick={() => { toggleCapturePreview(); }}><Play size={16} fill="currentColor"/> Run sample capture <span>{binding(prefs.keybindings, 'capture')}</span></Button><Button onClick={() => openTab('api', `API ${tabs.filter((tab) => tab.view === 'api').length + 1}`)}><Plus size={17}/> <UiText text={"New API request"}/></Button></div><div className="quick-links"><Button variant="ghost" size="sm" onClick={() => setSessionOpen(true)}><FolderOpen size={15}/> <UiText text={"Open HAR file"}/></Button><span/><Button variant="ghost" size="sm" onClick={loadSamples}><UiText text={"Explore sample traffic"}/></Button></div></div></div>)}
          {section === 'api' && <div ref={apiWorkspaceRef} className="api-multi-workspace" onDragOver={e=>{if(!e.dataTransfer.types.includes('text/plain'))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect();setDropEdge(e.clientX<r.left+70?'left':e.clientX>r.right-70?'right':null);}} onDragLeave={()=>setDropEdge(null)} onDrop={e=>{e.preventDefault();const id=Number(e.dataTransfer.getData('text/plain'));const other=tabs.find(t=>t.view==='api'&&t.id!==id);if(dropEdge&&tabs.some(t=>t.id===id&&t.view==='api')&&other){setPaneCount(2);setActiveTab(dropEdge==='left'?id:other.id);setSplitTabId(dropEdge==='left'?other.id:id);}setDropEdge(null);}}>{dropEdge&&<div className={`api-edge-drop ${dropEdge}`}>Split API pane</div>}<div className="api-multi-toolbar"><label>Pane preset <SelectField label="Workspace pane preset" value={String(paneCount)} onChange={value=>choosePaneCount(Number(value))} options={[1,2,3,4].map(value=>({value:String(value),label:`${value} pane${value>1?'s':''}`}))}/></label><Button disabled={compactApi&&paneCount>1} title={compactApi&&paneCount>1?"Panes stack automatically when space is limited":"Change pane direction"} onClick={()=>setDirection(v=>v==='horizontal'?'vertical':'horizontal')}>{compactApi&&paneCount>1?'auto stacked':direction}</Button></div>{paneCount>2 ? <ApiWorkspace tabs={tabs} active={active} count={paneCount} direction={effectiveDirection} environment={envActive} flash={flash} onDirty={setDirty} ratio={splitRatio} onRatio={setSplitRatio} onCount={choosePaneCount}/> : <div className={`api-document-layout ${effectiveDirection} ${splitTabId !== null ? 'split' : ''}`}><div className="api-document-pane" style={{ width: effectiveDirection==='horizontal' && splitTabId !== null ? `${splitRatio}%` : '100%', height:effectiveDirection==='vertical'&&splitTabId!==null?`${splitRatio}%`:undefined }}>{active.node?.kind === 'setup' ? <SetupFileView key={active.node.id} node={active.node}/> : <ApiView key={active.id} flash={flash} environment={envActive} requestName={active.node?.name ?? active.label} profileId={active.node?.kind === 'profile' ? active.node.id : undefined} tabId={active.id} onDirty={(dirty) => setDirty(active.id, dirty)}/>}</div>{splitTabId !== null && tabs.some((tab) => tab.id === splitTabId && tab.view === 'api') && <><div className="api-document-divider" role="separator" aria-label="Resize API panes" aria-orientation={effectiveDirection==='vertical'?'horizontal':'vertical'} aria-valuenow={splitRatio} aria-valuemin={30} aria-valuemax={70} tabIndex={0} onPointerDown={startSplitResize} onDoubleClick={() => setSplitRatio(50)} onKeyDown={(event) => { if (event.key === 'ArrowLeft'||event.key==='ArrowUp') setSplitRatio((value) => Math.max(30, value - 2)); if (event.key === 'ArrowRight'||event.key==='ArrowDown') setSplitRatio((value) => Math.min(70, value + 2)); }}/><div className="api-document-pane" style={{ flex: 1 }}><div className="api-pane-caption">{tabs.find((tab) => tab.id === splitTabId)?.label}<Button size="sm" variant="ghost" onClick={() => {setSplitTabId(null);setPaneCount(1);}}>Close split</Button></div>{(() => { const tab = tabs.find((item) => item.id === splitTabId)!; return tab.node?.kind === 'setup' ? <SetupFileView key={tab.node.id} node={tab.node}/> : <ApiView key={tab.id} flash={flash} environment={envActive} requestName={tab.node?.name ?? tab.label} profileId={tab.node?.kind === 'profile' ? tab.node.id : undefined} tabId={tab.id} onDirty={(dirty) => setDirty(tab.id, dirty)}/>; })()}</div></>}</div>}</div>}
          {section === 'rules' && (isTauri()?<NativeRulesView/>:<RulesView flash={flash}/>)}
          {section === 'history' && <HistoryView flash={flash} selection={historySelection} sidebarVisible={sidebarKind === 'history'} onShowSidebar={() => setShowSidebar(true)} onOpenRequest={(name) => openTab('api', name)} onImport={() => setSessionOpen(true)} onShowTraffic={() => { if(historySelection?.kind==='session'){const saved=readPreviewSessions().find(s=>s.id===historySelection.id);if(saved){loadSession(saved);return;}const fixture=findSession(historySelection.id);if(fixture){loadSession({id:fixture.id,name:fixture.name,flows:flowsForSession(fixture.id),details:{},created:new Date().toISOString()});return;}}loadSamples(); }}/>}
          {section === 'devices' && <DevicesView onPairing={()=>{setIntegrationTab('LAN pairing');setSettingsPage('Integrations');}} flash={flash} selected={deviceSelected} onSelect={setDeviceSelected}/>}
          {section === 'tools' && <ToolboxView algorithm={toolboxAlgorithm} flash={flash} tool={toolboxTool} mode={toolboxMode} onTool={setToolboxTool} onMode={setToolboxMode} showList={sidebarKind !== 'toolbox'}/>}
          {section === 'tracker' && (isTauri()?<NativeTrackerView/>:<TrackerView flash={flash}/>)}
          {section === 'analytics' && (isTauri()?<NativeAnalyticsView/>:<AnalyticsView onInspectHost={(host) => { setTrafficFilter(`host:${host}`); setActiveTab(tabs.find((tab) => tab.view === 'traffic')?.id ?? 0); setShowDemo(true); setSection('traffic'); }}/>) }
          {section === 'environments' && <EnvironmentsView flash={flash} active={envActive} onActive={setEnvActive} showList={sidebarKind !== 'environment'}/>}
          </Suspense>
        </div>
      </main>
    </div>

    {workbenchVisited&&<div hidden={!workbench}><Suspense fallback={<div className="route-loading" role="status">Loading workbench…</div>}><NativeWorkbench onClose={()=>setWorkbench(false)}/></Suspense></div>}
    <footer className="status-bar"><div className="status-left"><span className={`footer-led ${recording ? 'live' : ''}`}/><span>{isTauri()?'DESKTOP APP':capturePhase==='Error'?'SAMPLE ERROR':capturePhase==='Starting'||capturePhase==='Stopping'?`${capturePhase.toUpperCase()} SAMPLE`:recording ? 'SAMPLE RUNNING' : 'LOCAL WORKSPACE'}</span><span className="status-divider"/><span>{endpoint}</span></div><div className="status-center">{isTauri()?'Local desktop app · Capture status in the toolbar':'Browser mode · Sample data only'}</div><div className="status-right"><DiagnosticsStatus native={isTauri()}/><button title="Expand view" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14}/></button></div></footer>

    {editingEndpoint && <div className="modal-backdrop" onClick={() => setEditingEndpoint(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-icon"><Globe2 size={20}/></div><h2>Proxy address</h2><p>Choose the local interface and port used by the desktop capture engine.</p><label htmlFor="endpoint-input">LISTEN ADDRESS</label><input id="endpoint-input" autoFocus value={endpointDraft} onChange={(event) => setEndpointDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && /^.+:\d+$/.test(endpointDraft)) { saveEndpoint(); } }}/><div className="modal-actions"><Button onClick={() => setEditingEndpoint(false)}><UiText text={"Cancel"}/></Button><Button variant="default" disabled={!/^.+:\d+$/.test(endpointDraft)} onClick={() => { saveEndpoint(); }}>Save address</Button></div><div className="modal-note">Workspace default only. Configure and start the native listener in Capture.</div></div></div>}
    {infoPanel && <div className="modal-backdrop" onClick={() => setInfoPanel(null)}><div className="modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-icon">{infoPanel === 'about' ? <Info size={20}/> : <Keyboard size={20}/>}</div>
      <h2>{infoPanel === 'about' ? 'About Traffic Studio' : 'Keyboard Shortcuts'}</h2>
      {infoPanel === 'about'
        ? <><p>Traffic Studio is a local Windows desktop workspace. Browser mode uses sample data; the native app provides local storage, HTTP sending and an optional local capture runtime. Capture availability depends on local setup and certificate trust.</p><RuntimeSummary/></>
        : <ul className="shortcut-list">{shortcutList.map(([keys, label]) => <li key={keys}><kbd>{keys}</kbd><span>{label}</span></li>)}</ul>}
      <div className="modal-actions"><Button variant="default" onClick={() => setInfoPanel(null)}><UiText text={"Close"}/></Button></div>
      {infoPanel === 'about' && <div className="modal-note">Version 0.1.0 · Browser mode shows sample traffic. Open the native app for local capture.</div>}
    </div></div>}
    {zen && <Button variant="ghost" className="zen-exit" onClick={() => setZen(false)}>Exit Zen</Button>}
    {clipboardCurl!==null && <CurlImport initialText={clipboardCurl} applyLabel="Create API draft" onApply={importClipboardDraft} onClose={()=>setClipboardCurl(null)}/>}
    <Suspense fallback={<div className="settings-backdrop"><div className="dialog-loading" role="status">Loading dialog…</div></div>}>
    {sessionOpen && <SessionManager flows={allFlows} details={details} onLoad={loadSession} onClose={() => setSessionOpen(false)}/>}
    {compareOpen && <FlowCompare flows={allFlows} details={details} onClose={() => setCompareOpen(false)}/>}
    {protocolOpen && <ProtocolPreview onClose={() => setProtocolOpen(false)}/>}
    {settingsPage && <SettingsCenter integrationTab={integrationTab} initial={settingsPage} certificateTarget={certificateTarget} onClose={() => setSettingsPage(null)} flash={flash} motion={motionEnabled} onMotion={() => setMotionEnabled(v => !v)}/>}
    </Suspense>
    {layoutOpen && <LayoutManager current={{ sidebarWidth, showSidebar, splitRatio, direction, zen, paneCount }} onApply={applyLayout} onClose={() => setLayoutOpen(false)}/>}
    {notificationOpen && <NotificationCenter items={notifications} onRead={() => setNotifications(v => v.map(n => ({ ...n, read: true })))} onClear={() => setNotifications([])} onClose={() => setNotificationOpen(false)}/>}
    {notice && <div className="toast" role="status">{/error|invalid|failed|unavailable/i.test(notice)?<CircleAlert size={16}/>:<Check size={16}/>} {notice}</div>}
  </div>;
}

function titleFor(view: View) { return ({ traffic: 'Traffic', api: 'API', rules: 'Rules', history: 'History', devices: 'Devices', tools: 'Toolbox', tracker: 'Tracker', analytics: 'Analytics', environments: 'Environments' })[view]; }
function iconFor(view: View) { return ({ traffic: <Radio size={15}/>, api: <Code2 size={15}/>, rules: <SlidersHorizontal size={15}/>, history: <History size={15}/>, devices: <Wifi size={15}/>, tools: <Wrench size={15}/>, tracker: <KanbanSquare size={15}/>, analytics: <BarChart3 size={15}/>, environments: <KeyRound size={15}/> })[view]; }
function RailButton({icon,label,active,onClick,hint}:{icon:ReactNode;label:string;active?:boolean;onClick:()=>void;hint?:string}) { const ui = useUiTranslation(); return <button className={`rail-button ${active ? 'active' : ''}`} title={hint ? `${ui.translate(label)} · ${ui.translate(hint)}` : ui.translate(label)} aria-label={ui.translate(label)} onClick={onClick}>{icon}<span className="rail-label"><UiText text={label}/></span></button>; }

export default App;
