import { useDialogFocus } from '../../shell/useDialogFocus';
import { useRef, useState } from 'react';
import './layout.css';
export type LayoutSnapshot = { sidebarWidth: number; showSidebar: boolean; splitRatio: number; direction: 'horizontal' | 'vertical'; zen: boolean; paneCount?: number };
type Named = { id: string; name: string; value: LayoutSnapshot };
const key = 'traffic-studio-named-layouts-v1';
function read(): Named[] { try { const data = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(data) ? data.filter(v => typeof v.name === 'string' && v.value && typeof v.value.sidebarWidth === 'number') : []; } catch { return []; } }
export function LayoutManager({ current, onApply, onClose }: { current: LayoutSnapshot; onApply: (value: LayoutSnapshot) => void; onClose: () => void }) {
  const dialogRoot=useRef<HTMLDivElement>(null); useDialogFocus(dialogRoot,onClose);
  const [items, setItems] = useState(read);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  function write(next: Named[]) { localStorage.setItem(key, JSON.stringify(next)); setItems(next); }
  return <div className="settings-backdrop"><div ref={dialogRoot} className="layout-manager" role="dialog" aria-modal="true" aria-label="Named layouts"><h2>Workspace layouts</h2><p>Save display geometry. API drafts and open tabs remain independent.</p><label>Layout name<input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}/></label><button disabled={!name.trim() || items.some(v => v.name === name.trim())} onClick={() => { write([...items, { id: crypto.randomUUID(), name: name.trim(), value: current }]); setName(''); setMessage('Layout saved locally.'); }}>Save current layout</button><div>{items.length ? items.map(item => <div className="named-layout" key={item.id}><strong>{item.name}</strong><button onClick={() => { onApply(item.value); setMessage(`Applied ${item.name}.`); }}>Apply</button><button onClick={() => write(items.filter(v => v.id !== item.id))}>Delete</button></div>) : <p>No named layouts yet.</p>}</div><p role="status">{message}</p><button onClick={() => onApply({ sidebarWidth: 272, showSidebar: true, splitRatio: 50, direction: 'horizontal', zen: false })}>Reset geometry</button> <button onClick={onClose}>Close</button></div></div>;
}
