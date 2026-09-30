import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Radio, Search, Star } from 'lucide-react';
import type { Flow } from '../../domain/types';
import type { ExplorerProps } from '../../shell/ExplorerSidebar';
import { readAnnotations } from './FlowAnnotations';
export function TrafficExplorer({flows,trackedIds,favoriteIds,selectedFlow,onSelectFlow,onTrack,onFavorite,onSetTrafficFilter,trafficFilter,section,source='Sample traffic'}:ExplorerProps){
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const sync=()=>setRevision(v=>v+1);window.addEventListener('traffic-studio-annotations-change',sync);return()=>window.removeEventListener('traffic-studio-annotations-change',sync);},[]);
  void revision;
  const annotations=readAnnotations();
  const folders=Array.from(new Set(flows.map(f=>annotations[`${source}:${f.id}`]?.folder).filter(Boolean)));
  const [trafficGroups,setTrafficGroups]=useState(['Favorite','Bookmark','Device','Application','Domain','Structure']);
  const [trafficNodes,setTrafficNodes]=useState<string[]>([]);
  const [trafficSearch,setTrafficSearch]=useState('');
  const [rowLimit,setRowLimit]=useState(100);
    const tracked = flows.filter((flow) => trackedIds.includes(flow.id));
    const favorites = flows.filter((flow) => favoriteIds.includes(flow.id));
    const devices = Array.from(new Set(flows.map((flow) => flow.device).filter(Boolean))) as string[];
    const apps = Array.from(new Set(flows.map((flow) => flow.app).filter(Boolean))) as string[];
    const hosts = Array.from(new Set(flows.map((flow) => flow.host)));
    const paths = Array.from(new Set(flows.map((flow) => flow.path.split('/').filter(Boolean)[0]).filter(Boolean)));
    const toggle = (name: string) => setTrafficGroups((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    const group = (name: string, count?: number) => <button className="explorer-section" onClick={() => toggle(name)}>{trafficGroups.includes(name) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} {name} {count !== undefined && <strong>{count}</strong>}</button>;
    const trace = (flow: Flow, onRemove?: () => void) => <div key={flow.id} className={`explorer-trace ${selectedFlow === flow.id ? 'selected' : ''}`}>
      {onRemove && <input type="checkbox" checked onChange={onRemove} aria-label={`Remove bookmark ${flow.method} ${flow.path}`}/>}
      <button className="explorer-trace-main" onClick={() => onSelectFlow(flow.id)} title={`${flow.method} ${flow.host}${flow.path}`}><span>{flow.method}</span>{flow.path}</button>
    </div>;
    const matchesSearch = (flow: Flow) => `${flow.id} ${flow.method} ${flow.host} ${flow.path} ${flow.app ?? ''} ${flow.device ?? ''}`.toLowerCase().includes(trafficSearch.toLowerCase());
    const categoryNode = (category: string, value: string, filter: string, matching: Flow[]) => {
      const key = `${category}:${value}`;
      const open = trafficNodes.includes(key) || Boolean(trafficSearch);
      const shown = matching.filter(matchesSearch);
      if (trafficSearch && !shown.length && !value.toLowerCase().includes(trafficSearch.toLowerCase())) return null;
      return <div className="explorer-category" key={key}><div className={`explorer-category-head ${trafficFilter === filter ? 'selected' : ''}`}><button className="explorer-category-expand" aria-label={`${open ? 'Collapse' : 'Expand'} ${value}`} aria-expanded={open} onClick={() => setTrafficNodes((current) => open ? current.filter((item) => item !== key) : [...current, key])}>{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button><button className="explorer-category-filter" onClick={() => onSetTrafficFilter(filter)} title={`Filter traffic by ${value}`}>{value}</button><span>{matching.length}</span></div>{open && (shown.length ? shown.slice(0,rowLimit).map((flow) => trace(flow)) : <div className="explorer-hint">No matching requests.</div>)}</div>;
    };
  return <aside className="explorer-sidebar" aria-label="Traffic explorer"><div className="explorer-title"><span>{flows.length?(source==='Sample traffic'?'EXPLORER · SAMPLE':'EXPLORER · SESSION'):'EXPLORER · NO FLOWS'}</span><Radio size={15}/></div><div className="bookmark-folders">{section==='traffic'&&folders.map(folder=><button className="sidebar-action" key={folder} onClick={()=>onSetTrafficFilter(`folder:${folder}`)}><Folder size={13}/>{folder}</button>)}</div><div className="explorer-search"><Search size={14}/><input aria-label="Search Traffic explorer" placeholder="Search groups and requests" value={trafficSearch} onChange={(event) => setTrafficSearch(event.target.value)}/></div><div className="traffic-explorer-scroll">
      {group('Favorite', favorites.length)}
      {trafficGroups.includes('Favorite') && (favorites.length ? favorites.filter(matchesSearch).slice(0,rowLimit).map((flow) => <div key={flow.id} className={`explorer-trace ${selectedFlow === flow.id ? 'selected' : ''}`}><button className="explorer-star" title="Unfavorite" onClick={() => onFavorite(flow.id)}><Star size={13} fill="currentColor"/></button><button className="explorer-trace-main" onClick={() => onSelectFlow(flow.id)} title={`${flow.method} ${flow.host}${flow.path}`}><span>{flow.method}</span>{flow.path}</button></div>) : <div className="explorer-hint"><Star size={15}/><span>Star a request to add it here.</span></div>)}
      {group('Bookmark', tracked.length)}
      {trafficGroups.includes('Bookmark') && (tracked.length ? tracked.filter(matchesSearch).slice(0,rowLimit).map((flow) => trace(flow, () => onTrack(flow.id))) : <div className="explorer-hint"><Star size={15}/><span>Tick a request to bookmark it here.</span></div>)}
      {group('Device', devices.length)}
      {trafficGroups.includes('Device') && (devices.length ? devices.map((device) => categoryNode('device', device, `device:${device}`, flows.filter((flow) => flow.device === device))) : <div className="explorer-hint"><span>No device data yet.</span></div>)}
      {group('Application', apps.length)}
      {trafficGroups.includes('Application') && (apps.length ? apps.map((app) => categoryNode('app', app, `app:${app}`, flows.filter((flow) => flow.app === app))) : <div className="explorer-hint"><span>No app data yet.</span></div>)}
      {group('Domain', hosts.length)}
      {trafficGroups.includes('Domain') && hosts.map((host) => categoryNode('host', host, `host:${host}`, flows.filter((flow) => flow.host === host)))}
      {group('Structure')}
      {trafficGroups.includes('Structure') && paths.map((path) => categoryNode('path', `/${path}`, `path:/${path}`, flows.filter((flow) => flow.path.startsWith(`/${path}`))))}
    {flows.length>0&&<><p className="explorer-hint">Up to {rowLimit} requests per expanded group. Search by ID to find a specific flow.</p><button className="sidebar-action" onClick={()=>setRowLimit(v=>v+100)}>Show 100 more per group</button></>}</div></aside>;
}
