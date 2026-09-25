import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, FileJson2, Folder, FolderPlus, Plus, Radio, Search, Star, Trash2 } from 'lucide-react';
import type { Flow, View } from '../domain/types';
import './explorer.css';

export type ExplorerNode = { id: string; parentId: string | null; kind: 'group' | 'request' | 'setup' | 'profile'; name: string };
const treeKey = 'traffic-studio-explorer-v1';
const defaultNodes: ExplorerNode[] = [
  { id: 'group-project', parentId: null, kind: 'group', name: 'Project workspace' },
  { id: 'group-requests', parentId: 'group-project', kind: 'group', name: 'API requests' },
  { id: 'request-example', parentId: 'group-requests', kind: 'request', name: 'New request' },
  { id: 'group-config', parentId: 'group-project', kind: 'group', name: 'Setup files' },
  { id: 'setup-environment', parentId: 'group-config', kind: 'setup', name: 'environment.json' },
];
function readNodes(): ExplorerNode[] { try { const value = JSON.parse(localStorage.getItem(treeKey) ?? 'null'); return Array.isArray(value) ? value as ExplorerNode[] : defaultNodes; } catch { return defaultNodes; } }

export function ExplorerSidebar({ section, flows, trackedIds, favoriteIds, selectedFlow, onSelectFlow, onTrack, onFavorite, onOpenNode, onCreateRequest, onSetTrafficFilter, trafficFilter, onShowCollections }: {
  section: View; flows: Flow[]; trackedIds: number[]; favoriteIds: number[]; selectedFlow: number | null;
  onSelectFlow: (id: number) => void; onTrack: (id: number) => void; onFavorite: (id: number) => void;
  onOpenNode: (node: ExplorerNode) => void; onCreateRequest: () => void;
  onSetTrafficFilter: (value: string) => void; trafficFilter: string;
  onShowCollections: () => void;
}) {
  const [nodes, setNodes] = useState<ExplorerNode[]>(readNodes);
  const [expanded, setExpanded] = useState<string[]>(['group-project', 'group-requests', 'group-config']);
  const [selectedGroup, setSelectedGroup] = useState<string | null>('group-requests');
  const [creating, setCreating] = useState<{ kind: ExplorerNode['kind']; parentId: string | null } | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [trafficGroups, setTrafficGroups] = useState<string[]>(['Favorite', 'Bookmark', 'Device', 'Application', 'Domain', 'Structure']);
  const [trafficNodes, setTrafficNodes] = useState<string[]>([]);
  const [trafficSearch, setTrafficSearch] = useState('');
  useEffect(() => { localStorage.setItem(treeKey, JSON.stringify(nodes)); }, [nodes]);

  const create = () => {
    const name = newName.trim(); if (!name || !creating) return;
    const node: ExplorerNode = { id: crypto.randomUUID(), kind: creating.kind, parentId: creating.parentId, name };
    setNodes((current) => [...current, node]);
    if (creating.parentId) setExpanded((current) => current.includes(creating.parentId!) ? current : [...current, creating.parentId!]);
    setCreating(null); setNewName('');
    if (node.kind !== 'group') onOpenNode(node);
  };
  const startCreate = (kind: ExplorerNode['kind'], parentId = selectedGroup) => { setCreating({ kind, parentId }); setNewName(kind === 'group' ? 'New group' : kind === 'setup' ? 'settings.json' : 'New request'); };
  const commitRename = (id: string) => { const name = renameName.trim(); if (name) setNodes((current) => current.map((node) => node.id === id ? { ...node, name } : node)); setRenaming(null); };
  const removeNode = (id: string) => { const toRemove = new Set([id]); let changed = true; while (changed) { changed = false; for (const node of nodes) if (node.parentId && toRemove.has(node.parentId) && !toRemove.has(node.id)) { toRemove.add(node.id); changed = true; } } setNodes((current) => current.filter((node) => !toRemove.has(node.id))); if (selectedGroup && toRemove.has(selectedGroup)) setSelectedGroup(null); };
  const toggleExpand = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const renderNodes = (parentId: string | null, level: number): React.ReactNode => nodes.filter((node) => node.parentId === parentId).map((node) => {
    const matches = node.name.toLowerCase().includes(search.toLowerCase());
    const hasMatchingChild = (id: string): boolean => nodes.some((child) => child.parentId === id && (child.name.toLowerCase().includes(search.toLowerCase()) || hasMatchingChild(child.id)));
    if (search && !matches && !hasMatchingChild(node.id)) return null;
    const isOpen = search ? true : expanded.includes(node.id);
    return <div key={node.id} className="explorer-node-wrap"><div className={`explorer-node ${selectedGroup === node.id ? 'selected' : ''}`} style={{ paddingLeft: 9 + level * 16 }}>
      <button className="explorer-node-main" title={node.name} onClick={() => node.kind === 'group' ? (setSelectedGroup(node.id), toggleExpand(node.id)) : onOpenNode(node)} onDoubleClick={() => { setRenaming(node.id); setRenameName(node.name); }}>
        {node.kind === 'group' ? isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/> : <span className="explorer-leaf-spacer"/>}
        {node.kind === 'group' ? <Folder size={15}/> : node.kind === 'setup' ? <FileJson2 size={15}/> : <Code2 size={15}/>}
        {renaming === node.id ? <input autoFocus value={renameName} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(node.id); if (event.key === 'Escape') setRenaming(null); }} onBlur={() => commitRename(node.id)}/> : <span>{node.name}</span>}
      </button>
      {node.kind === 'group' && <button className="explorer-node-action" title="Add subgroup" onClick={() => { setSelectedGroup(node.id); startCreate('group', node.id); }}><Plus size={13}/></button>}
      {node.id !== 'group-project' && <button className="explorer-node-action remove" title="Delete item and its children" onClick={() => setPendingDelete(node.id)}><Trash2 size={12}/></button>}
    </div>{node.kind === 'group' && isOpen && renderNodes(node.id, level + 1)}</div>;
  });

  if (section === 'traffic') {
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
    const matchesSearch = (flow: Flow) => `${flow.method} ${flow.host} ${flow.path} ${flow.app ?? ''} ${flow.device ?? ''}`.toLowerCase().includes(trafficSearch.toLowerCase());
    const categoryNode = (category: string, value: string, filter: string, matching: Flow[]) => {
      const key = `${category}:${value}`;
      const open = trafficNodes.includes(key) || Boolean(trafficSearch);
      const shown = matching.filter(matchesSearch);
      if (trafficSearch && !shown.length && !value.toLowerCase().includes(trafficSearch.toLowerCase())) return null;
      return <div className="explorer-category" key={key}><div className={`explorer-category-head ${trafficFilter === filter ? 'selected' : ''}`}><button className="explorer-category-expand" aria-label={`${open ? 'Collapse' : 'Expand'} ${value}`} aria-expanded={open} onClick={() => setTrafficNodes((current) => open ? current.filter((item) => item !== key) : [...current, key])}>{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button><button className="explorer-category-filter" onClick={() => onSetTrafficFilter(filter)} title={`Filter traffic by ${value}`}>{value}</button><span>{matching.length}</span></div>{open && (shown.length ? shown.map((flow) => trace(flow)) : <div className="explorer-hint">No matching requests.</div>)}</div>;
    };
    return <aside className="explorer-sidebar" aria-label="Traffic explorer"><div className="explorer-title"><span>EXPLORER · SAMPLE</span><Radio size={15}/></div><div className="explorer-search"><Search size={14}/><input aria-label="Search Traffic explorer" placeholder="Search groups and requests" value={trafficSearch} onChange={(event) => setTrafficSearch(event.target.value)}/></div><div className="traffic-explorer-scroll">
      {group('Favorite', favorites.length)}
      {trafficGroups.includes('Favorite') && (favorites.length ? favorites.filter(matchesSearch).map((flow) => <div key={flow.id} className={`explorer-trace ${selectedFlow === flow.id ? 'selected' : ''}`}><button className="explorer-star" title="Unfavorite" onClick={() => onFavorite(flow.id)}><Star size={13} fill="currentColor"/></button><button className="explorer-trace-main" onClick={() => onSelectFlow(flow.id)} title={`${flow.method} ${flow.host}${flow.path}`}><span>{flow.method}</span>{flow.path}</button></div>) : <div className="explorer-hint"><Star size={15}/><span>Star a request to add it here.</span></div>)}
      {group('Bookmark', tracked.length)}
      {trafficGroups.includes('Bookmark') && (tracked.length ? tracked.filter(matchesSearch).map((flow) => trace(flow, () => onTrack(flow.id))) : <div className="explorer-hint"><Star size={15}/><span>Tick a request to bookmark it here.</span></div>)}
      {group('Device', devices.length)}
      {trafficGroups.includes('Device') && (devices.length ? devices.map((device) => categoryNode('device', device, `device:${device}`, flows.filter((flow) => flow.device === device))) : <div className="explorer-hint"><span>No device data yet.</span></div>)}
      {group('Application', apps.length)}
      {trafficGroups.includes('Application') && (apps.length ? apps.map((app) => categoryNode('app', app, `app:${app}`, flows.filter((flow) => flow.app === app))) : <div className="explorer-hint"><span>No app data yet.</span></div>)}
      {group('Domain', hosts.length)}
      {trafficGroups.includes('Domain') && hosts.map((host) => categoryNode('host', host, `host:${host}`, flows.filter((flow) => flow.host === host)))}
      {group('Structure')}
      {trafficGroups.includes('Structure') && paths.map((path) => categoryNode('path', `/${path}`, `path:/${path}`, flows.filter((flow) => flow.path.startsWith(`/${path}`))))}
    </div></aside>;
  }
  if (section !== 'api') return null;
  return <aside className="explorer-sidebar" aria-label="API explorer"><div className="explorer-title"><span>EXPLORER</span><div><button title="New top-level group" onClick={() => startCreate('group', null)}><FolderPlus size={15}/></button><button title="New request" onClick={() => { if (selectedGroup) startCreate('request'); else onCreateRequest(); }}><Plus size={16}/></button></div></div><div className="api-sidebar-tabs"><button className="active">Explorer</button><button onClick={onShowCollections}>Collections</button></div><div className="explorer-search"><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find in workspace" aria-label="Find in workspace"/></div><div className="explorer-create-bar"><button onClick={() => startCreate('group')}><FolderPlus size={14}/> Group</button><button onClick={() => startCreate('request')}><Code2 size={14}/> Request</button><button onClick={() => startCreate('setup')}><FileJson2 size={14}/> Setup</button></div><div className="explorer-tree"><div className="explorer-tree-caption">WORKSPACE FILES <span>{nodes.length}</span></div>{renderNodes(null, 0)}{creating && <div className="explorer-new"><span>{creating.kind === 'group' ? <Folder size={14}/> : creating.kind === 'setup' ? <FileJson2 size={14}/> : <Code2 size={14}/>}</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); if (event.key === 'Escape') setCreating(null); }} aria-label={`New ${creating.kind} name`}/><button onClick={create}>Add</button></div>}{pendingDelete && <div className="explorer-delete-confirm"><span>Delete {nodes.find((node) => node.id === pendingDelete)?.name} and its children?</span><button onClick={() => setPendingDelete(null)}>Cancel</button><button onClick={() => { removeNode(pendingDelete); setPendingDelete(null); }}>Delete</button></div>}</div><div className="explorer-footer">Right panel opens the selected request or setup file.</div></aside>;
}

export function SetupFileView({ node }: { node: Pick<ExplorerNode, 'id' | 'name' | 'kind'> }) {
  const key = `traffic-studio-setup-${node.id}`;
  const [content, setContent] = useState(() => localStorage.getItem(key) ?? '{\n  "baseUrl": "https://api.example.com"\n}');
  const [message, setMessage] = useState('Local draft');
  const save = () => { try { JSON.parse(content); localStorage.setItem(key, content); setMessage('Saved locally'); } catch { setMessage('Invalid JSON — fix it before saving'); } };
  return <div className="setup-view"><div className="setup-header"><div><span className="eyebrow">WORKSPACE SETUP FILE</span><h1><FileJson2 size={21}/>{node.name}</h1><p>Editable JSON file stored in this browser profile. This is a UI draft, not a filesystem file.</p></div><button className="primary-action" onClick={save}>Save file</button></div><div className="setup-editor-head"><span>JSON EDITOR</span><span>{message}</span></div><textarea spellCheck={false} aria-label="Setup file content" value={content} onChange={(event) => { setContent(event.target.value); setMessage('Unsaved changes'); }}/></div>;
}
