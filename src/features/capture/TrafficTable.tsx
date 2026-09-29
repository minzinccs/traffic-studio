import { UiText } from '../localization';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Bookmark, Braces, Columns3, Copy, Eye, FileCode2, Globe2, GripVertical, RotateCcw, Star, X } from 'lucide-react';
import type { Flow } from '../../domain/types';
import './trafficTable.css';

type ColumnId = 'id' | 'favorite' | 'bookmark' | 'method' | 'url' | 'application' | 'status' | 'type' | 'duration' | 'size' | 'device' | 'scheme';
type Column = { id: ColumnId; label: string; width: number; visible: boolean };
const storageKey = 'traffic-studio-traffic-columns-v1';
const defaults: Column[] = [
  { id: 'id', label: 'ID', width: 58, visible: true },
  { id: 'favorite', label: 'Fav', width: 48, visible: true },
  { id: 'bookmark', label: 'Mark', width: 52, visible: true },
  { id: 'method', label: 'Method', width: 80, visible: true },
  { id: 'url', label: 'URL', width: 300, visible: true },
  { id: 'application', label: 'Application', width: 150, visible: true },
  { id: 'status', label: 'Status', width: 70, visible: true },
  { id: 'type', label: 'Type', width: 150, visible: false },
  { id: 'duration', label: 'Duration', width: 90, visible: true },
  { id: 'size', label: 'Size', width: 82, visible: true },
  { id: 'device', label: 'Device', width: 170, visible: false },
  { id: 'scheme', label: 'Scheme', width: 85, visible: false },
];

function readColumns(): Column[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Column[] | null;
    if (!Array.isArray(saved)) return defaults;
    const valid = saved.filter((column) => defaults.some((item) => item.id === column.id));
    if (valid.length !== defaults.length || !valid.some((column) => column.visible)) return defaults;
    return valid.map((column) => ({ ...defaults.find((item) => item.id === column.id)!, visible: Boolean(column.visible), width: Math.min(480, Math.max(42, Number(column.width) || 80)) }));
  } catch { return defaults; }
}

export function TrafficTable({ flows, selectedFlow, favoriteIds, trackedIds, onSelectFlow, onFavorite, onTrack, density = 'compact', onClearFilters, onCompose, onCompare, onFeedback }: {
  onFeedback?:(message:string)=>void; onCompose?: (id:number)=>void; onCompare?:()=>void; density?: 'compact' | 'comfortable'; onClearFilters?: () => void; flows: Flow[]; selectedFlow: number | null; favoriteIds: number[]; trackedIds: number[];
  onSelectFlow: (id: number) => void; onFavorite: (id: number) => void; onTrack: (id: number) => void;
}) {
  const rowHeight = density === 'comfortable' ? 40 : 32;
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [columns, setColumns] = useState(readColumns);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragged, setDragged] = useState<ColumnId | null>(null);
  const [sort, setSort] = useState<{ id: ColumnId; direction: 1 | -1 } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rowMenu, setRowMenu] = useState<number | null>(null);
  const visible = useMemo(() => columns.filter((column) => column.visible), [columns]);
  const gridStyle = { gridTemplateColumns: visible.map((column) => `${column.width}px`).join(' ') } as CSSProperties;
  const sortedFlows = useMemo(() => {
    if (!sort) return flows;
    const value = (flow: Flow) => {
      switch (sort.id) {
        case 'id': return flow.id; case 'favorite': return Number(favoriteIds.includes(flow.id)); case 'bookmark': return Number(trackedIds.includes(flow.id));
        case 'method': return flow.method; case 'url': return `${flow.host}${flow.path}`; case 'application': return flow.app ?? '';
        case 'status': return flow.status; case 'type': return flow.type; case 'duration': return flow.duration;
        case 'size': return parseFloat(flow.size) * (flow.size.includes('KB') ? 1024 : flow.size.includes('MB') ? 1048576 : 1);
        case 'device': return flow.device ?? ''; case 'scheme': return flow.scheme ?? 'https';
      }
    };
    return [...flows].sort((a, b) => { const left = value(a); const right = value(b); const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right)); return result * sort.direction || a.id - b.id; });
  }, [flows, sort, favoriteIds, trackedIds]);
  const startRow = Math.min(Math.max(0, sortedFlows.length - 1), Math.max(0, Math.floor((scrollTop - 34) / rowHeight) - 8));
  const endRow = Math.min(sortedFlows.length, startRow + Math.ceil(viewportHeight / rowHeight) + 16);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(columns)); }, [columns]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setRowMenu(null); setSelectedIds([]); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);

  function toggleColumn(id: ColumnId) {
    if (visible.length === 1 && visible[0].id === id) return;
    setColumns((current) => current.map((column) => column.id === id ? { ...column, visible: !column.visible } : column));
  }
  function moveColumn(id: ColumnId, targetId: ColumnId) {
    if (id === targetId) return;
    setColumns((current) => {
      const result = [...current];
      const source = result.findIndex((column) => column.id === id);
      const target = result.findIndex((column) => column.id === targetId);
      result.splice(target, 0, result.splice(source, 1)[0]);
      return result;
    });
  }
  function moveStep(id: ColumnId, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.id === id);
    const neighbor = columns[index + direction];
    if (neighbor) moveColumn(id, neighbor.id);
  }
  function startResize(event: React.PointerEvent<HTMLSpanElement>, column: Column) {
    event.stopPropagation(); event.preventDefault();
    const start = event.clientX; const initial = column.width;
    const move = (next: PointerEvent) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, width: Math.min(480, Math.max(42, initial + next.clientX - start)) } : item));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  }
  function sortBy(id: ColumnId) { setSort((current) => current?.id === id ? current.direction === 1 ? { id, direction: -1 } : null : { id, direction: 1 }); }
  function selectRow(event: MouseEvent<HTMLDivElement>, id: number) {
    if (event.shiftKey && selectedIds.length) {
      const first = sortedFlows.findIndex((flow) => flow.id === selectedIds.at(-1)); const last = sortedFlows.findIndex((flow) => flow.id === id);
      setSelectedIds(sortedFlows.slice(Math.min(first < 0 ? last : first, last), Math.max(first, last) + 1).map((flow) => flow.id));
    } else if (event.ctrlKey || event.metaKey) setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    else setSelectedIds([id]);
    onSelectFlow(id);
  }
  const selectedForAction = rowMenu !== null ? selectedIds.includes(rowMenu) ? selectedIds : [rowMenu] : [];
  const firstSelected = flows.find((flow) => flow.id === rowMenu);
  function cell(flow: Flow, id: ColumnId) {
    switch (id) {
      case 'id': return <span className="traffic-cell-mono">{flow.id}</span>;
      case 'favorite': return <button className={`flow-star ${favoriteIds.includes(flow.id) ? 'on' : ''}`} aria-label={`Favorite ${flow.method} ${flow.host}${flow.path}`} title="Favorite" onClick={(event) => { event.stopPropagation(); onFavorite(flow.id); }}><Star size={13} fill={favoriteIds.includes(flow.id) ? 'currentColor' : 'none'}/></button>;
      case 'bookmark': return <input type="checkbox" checked={trackedIds.includes(flow.id)} aria-label={`Bookmark ${flow.method} ${flow.host}${flow.path}`} onClick={(event) => event.stopPropagation()} onChange={() => onTrack(flow.id)}/>;
      case 'method': return <span className={`method method-${flow.method.toLowerCase()} traffic-method`}>{flow.type.includes('json') ? <Braces size={12}/> : flow.type.includes('javascript') ? <FileCode2 size={12}/> : <Globe2 size={12}/>} {flow.method}</span>;
      case 'url': return <span className="traffic-url" title={`${flow.scheme ?? 'https'}://${flow.host}${flow.path}`}>{flow.scheme ?? 'https'}://{flow.host}{flow.path}</span>;
      case 'application': return <span title={flow.app ?? 'Unknown application'}>{flow.app ?? 'Unknown'}</span>;
      case 'status': return <span className={`status-code ${flow.status >= 400 ? 'error' : ''}`}>{flow.status}</span>;
      case 'type': return <span className="content-chip" title={flow.type}>{flow.type}</span>;
      case 'duration': return <span>{flow.duration} ms</span>;
      case 'size': return <span>{flow.size}</span>;
      case 'device': return <span title={flow.device ?? 'Unknown device'}>{flow.device ?? 'Unknown'}</span>;
      case 'scheme': return <span className="protocol-chip">{flow.scheme?.toUpperCase() ?? 'Unknown'}</span>;
    }
  }
  return <div className="traffic-table-wrap">
    <div className="traffic-table-tools"><span>{flows.length} shown{selectedIds.length ? ` · ${selectedIds.length} selected` : ''} · right click a header or use Columns</span><button type="button" className="outline-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><Columns3 size={14}/> <UiText text={"Columns"}/></button></div>
    {menuOpen && <div className="traffic-column-menu" role="dialog" aria-label="Traffic columns"><div className="traffic-column-menu-title">VISIBLE COLUMNS <button type="button" onClick={() => setColumns(defaults)}><RotateCcw size={13}/> <UiText text={"Reset"}/></button></div><p>Tick columns to show them. Drag a header or use arrows to change order.</p>{columns.map((column, index) => <div className="traffic-column-option" key={column.id}><label><input type="checkbox" checked={column.visible} disabled={column.visible && visible.length === 1} onChange={() => toggleColumn(column.id)}/>{column.label}</label><button type="button" aria-label={`Move ${column.label} left`} disabled={index === 0} onClick={() => moveStep(column.id, -1)}>←</button><button type="button" aria-label={`Move ${column.label} right`} disabled={index === columns.length - 1} onClick={() => moveStep(column.id, 1)}>→</button></div>)}<button className="traffic-column-done" onClick={() => setMenuOpen(false)}><UiText text={"Done"}/></button></div>}
    {rowMenu !== null && <div className="traffic-row-menu" role="menu"><div>{selectedForAction.length} request(s)</div><button onClick={() => { if (firstSelected) onSelectFlow(firstSelected.id); setRowMenu(null); }}><Eye size={14}/> Inspect</button><button onClick={()=>{if(firstSelected)onCompose?.(firstSelected.id);setRowMenu(null);}}>Compose API draft</button><button onClick={()=>{onCompare?.();setRowMenu(null);}}>Compare flows</button><button onClick={async()=>{if(!firstSelected)return;const quote=(s:string)=>String.fromCharCode(39)+s.replaceAll(String.fromCharCode(39),String.fromCharCode(39,92,39,39))+String.fromCharCode(39);const text=`curl -X ${firstSelected.method} ${quote(`${firstSelected.scheme??'https'}://${firstSelected.host}${firstSelected.path}`)}`;try{await navigator.clipboard.writeText(text);onFeedback?.('Copied cURL method and URL.');}catch{onFeedback?.('Clipboard unavailable.');}setRowMenu(null);}}>Copy cURL</button><button onClick={() => { if (firstSelected) void navigator.clipboard.writeText(`${firstSelected.scheme ?? 'https'}://${firstSelected.host}${firstSelected.path}`); setRowMenu(null); }}><Copy size={14}/> Copy URL</button><button onClick={() => { selectedForAction.forEach((id) => { if (!trackedIds.includes(id)) onTrack(id); }); setRowMenu(null); }}><Bookmark size={14}/> Bookmark selected</button><button onClick={() => { selectedForAction.forEach((id) => { if (!favoriteIds.includes(id)) onFavorite(id); }); setRowMenu(null); }}><Star size={14}/> Favorite selected</button><button onClick={() => setRowMenu(null)}><X size={14}/> Close menu</button></div>}
    <div className="traffic-table-scroll" ref={viewport} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}><div className="traffic-grid traffic-grid-head" style={gridStyle} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}>{visible.map((column) => <div key={column.id} className={`traffic-head-cell ${dragged === column.id ? 'dragging' : ''}`} draggable onDragStart={(event) => { setDragged(column.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragged) moveColumn(dragged, column.id); setDragged(null); }} onDragEnd={() => setDragged(null)} title={`Drag to reorder ${column.label}; click to sort; drag right edge to resize; right click for columns`}><GripVertical size={11}/><button className="traffic-sort-button" onClick={() => sortBy(column.id)} aria-label={`Sort by ${column.label}`}>{column.label}{sort?.id === column.id && (sort.direction === 1 ? ' ↑' : ' ↓')}</button><span className="traffic-column-resize" role="separator" aria-label={`Resize ${column.label} column`} aria-orientation="vertical" tabIndex={0} onPointerDown={(event) => startResize(event, column)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setColumns((current) => current.map((item) => item.id === column.id ? { ...item, width: Math.min(480, Math.max(42, item.width + (event.key === 'ArrowRight' ? 12 : -12))) } : item)); }}/></div>)}</div>
      <div aria-hidden="true" style={{ height: startRow * rowHeight }}/>{sortedFlows.slice(startRow, endRow).map((flow, rowIndex) => <div key={flow.id} className={`traffic-grid traffic-grid-row ${selectedFlow === flow.id ? 'selected' : ''} ${selectedIds.includes(flow.id) ? 'multi-selected' : ''}`} style={{ ...gridStyle, height: rowHeight }} data-flow-id={flow.id} data-stripe={(startRow + rowIndex) % 2} role="button" tabIndex={0} aria-label={`${flow.method} ${flow.host}${flow.path}, ${flow.status}`} onClick={(event) => selectRow(event, flow.id)} onContextMenu={(event) => { event.preventDefault(); if (!selectedIds.includes(flow.id)) setSelectedIds([flow.id]); setRowMenu(flow.id); }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); const index=sortedFlows.findIndex(f=>f.id===flow.id); const target=event.key==='Home'?0:event.key==='End'?sortedFlows.length-1:Math.max(0,Math.min(sortedFlows.length-1,index+(event.key==='ArrowDown'?1:-1))); const next=sortedFlows[target]; if(next) { onSelectFlow(next.id);setSelectedIds([next.id]);viewport.current?.scrollTo({top:target*rowHeight});window.requestAnimationFrame(()=>viewport.current?.querySelector<HTMLElement>(`[data-flow-id="${next.id}"]`)?.focus()); } } if(event.key==='Enter'||event.key===' ') {event.preventDefault();onSelectFlow(flow.id);setSelectedIds([flow.id]);} }}>{visible.map((column) => <div key={column.id} className="traffic-grid-cell">{cell(flow, column.id)}</div>)}</div>)}
      <div aria-hidden="true" style={{ height: (sortedFlows.length - endRow) * rowHeight }}/>
      {flows.length === 0 && <div className="no-results">No requests match the selected filter. <button onClick={onClearFilters}>Clear filters and search</button></div>}
    </div>
  </div>;
}
