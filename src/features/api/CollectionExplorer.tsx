import { UiText } from '../localization';
import { useEffect, useState } from 'react';
import { Code2, Folder, Plus, Settings2 } from 'lucide-react';
import { readCollections, writeCollections, type ApiProfile } from './collections';
import type { ExplorerNode } from '../../shell/ExplorerSidebar';
import './collectionRow.css';

export function CollectionExplorer({ onOpen, onManage, onNew }: { onOpen: (node: ExplorerNode) => void; onManage: (collectionId?: string) => void; onNew: () => void }) {
  const [items, setItems] = useState(readCollections);
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => { const refresh = () => setItems(readCollections()); window.addEventListener('traffic-studio-collections-change', refresh); return () => window.removeEventListener('traffic-studio-collections-change', refresh); }, []);
  const depth=(id:string)=>{let d=0,c=items.find(c=>c.id===id);const seen=new Set<string>();while(c?.parentId&&!seen.has(c.parentId)){seen.add(c.parentId);d++;c=items.find(x=>x.id===c!.parentId);}return d;};
  const shown = items;
  const addProfile = (collectionId: string) => {
    const profile: ApiProfile = { id: crypto.randomUUID(), name: 'New request', method: 'GET', url: '', headers: [], body: '', notes: '' };
    writeCollections(readCollections().map(collection => collection.id === collectionId ? { ...collection, profiles: [...collection.profiles, profile] } : collection));
    setOpen(current => current.includes(collectionId) ? current : [...current, collectionId]);
    onOpen({ id: profile.id, parentId: collectionId, name: profile.name, kind: 'profile' });
  };
  return <aside className="explorer-sidebar" aria-label="API collection"><div className="explorer-title"><span>COLLECTION · LOCAL</span><Folder size={15}/></div><div className="explorer-tree"><button className="sidebar-action" onClick={onNew}><Plus size={14}/> <UiText text={"New scratch request"}/></button><button className="sidebar-action" onClick={() => { const name = `Collection ${items.length + 1}`; writeCollections([...items, { id: crypto.randomUUID(), name, profiles: [] }]); }}><Folder size={14}/> <UiText text={"New collection"}/></button>{shown.length ? shown.map(c => <div key={c.id} className="explorer-collection" style={{paddingLeft:depth(c.id)*12}}><div className="explorer-collection-row"><button className="explorer-collection-main" aria-expanded={open.includes(c.id)} onClick={() => setOpen(v => v.includes(c.id) ? v.filter(id => id !== c.id) : [...v, c.id])}><Folder size={14}/><span>{c.name}</span><small>{c.profiles.length}</small></button><div className="collection-hover-actions"><button type="button" title={`Add request to ${c.name}`} aria-label={`Add request to ${c.name}`} onClick={() => addProfile(c.id)}><Plus size={14}/></button><button type="button" title={`Manage ${c.name}`} aria-label={`Manage ${c.name}`} onClick={() => onManage(c.id)}><Settings2 size={14}/></button></div></div>{open.includes(c.id) && c.profiles.map(p => <button className="sidebar-action" key={p.id} style={{ paddingLeft: 28 }} onClick={() => onOpen({ id: p.id, parentId: c.id, name: p.name, kind: 'profile' })}><Code2 size={13}/>{p.method} · {p.name}</button>)}</div>) : <p className="explorer-hint">No collections. Create one or use a scratch request.</p>}<p className="explorer-hint">Collections are local. Use the gear action on a collection to rename, move or delete.</p></div></aside>;
}
