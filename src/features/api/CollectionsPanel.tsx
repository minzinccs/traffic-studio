import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, Copy, FolderPlus, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { readCollections, writeCollections, type ApiCollection, type ApiProfile } from './collections';
import './collections.css';

export function CollectionsPanel({ onShowExplorer, onOpenProfile }: { onShowExplorer: () => void; onOpenProfile: (profile: ApiProfile) => void }) {
  const [collections, setCollections] = useState(readCollections);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [newCollection, setNewCollection] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'collection' | 'profile'; id: string } | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const refresh = () => setCollections(readCollections());
    window.addEventListener('traffic-studio-collections-change', refresh);
    return () => window.removeEventListener('traffic-studio-collections-change', refresh);
  }, []);
  const profile = collections.flatMap((collection) => collection.profiles).find((item) => item.id === selected);
  const setAll = (next: ApiCollection[]) => { setCollections(next); writeCollections(next); };
  const updateSelected = (patch: Partial<ApiProfile>) => {
    if (!selected) return;
    setCollections((current) => current.map((collection) => ({ ...collection, profiles: collection.profiles.map((item) => item.id === selected ? { ...item, ...patch } : item) })));
    setNotice('Unsaved profile changes');
  };
  const saveProfile = () => { writeCollections(collections); setNotice('Profile saved locally'); };
  const addCollection = () => {
    const name = newCollection.trim(); if (!name) return;
    const id = crypto.randomUUID();
    setAll([...collections, { id, name, profiles: [] }]); setExpanded((items) => [...items, id]); setNewCollection('');
  };
  const addProfile = (collectionId: string) => {
    const item: ApiProfile = { id: crypto.randomUUID(), name: 'New API profile', method: 'GET', url: '', headers: [], body: '', notes: '' };
    setAll(collections.map((collection) => collection.id === collectionId ? { ...collection, profiles: [...collection.profiles, item] } : collection));
    setExpanded((items) => items.includes(collectionId) ? items : [...items, collectionId]); setSelected(item.id); setNotice('New profile · edit and save locally');
  };
  const renameCollection = (id: string) => {
    const name = renameValue.trim();
    if (name) setAll(collections.map((collection) => collection.id === id ? { ...collection, name } : collection));
    setRenaming(null);
  };
  const duplicateProfile = () => {
    if (!profile) return;
    const id = crypto.randomUUID();
    const next = collections.map((collection) => collection.profiles.some((item) => item.id === profile.id) ? { ...collection, profiles: [...collection.profiles, { ...profile, id, name: `${profile.name} copy` }] } : collection);
    setAll(next); setSelected(id); setNotice('Profile duplicated locally');
  };
  const moveProfile = (collectionId: string) => {
    if (!profile) return;
    setAll(collections.map((collection) => ({ ...collection, profiles: collection.id === collectionId ? [...collection.profiles.filter((item) => item.id !== profile.id), profile] : collection.profiles.filter((item) => item.id !== profile.id) })));
    setExpanded((current) => current.includes(collectionId) ? current : [...current, collectionId]);
    setNotice('Profile moved locally');
  };
  const remove = () => {
    if (!deleteTarget) return;
    const next = deleteTarget.kind === 'collection' ? collections.filter((collection) => collection.id !== deleteTarget.id) : collections.map((collection) => ({ ...collection, profiles: collection.profiles.filter((item) => item.id !== deleteTarget.id) }));
    setAll(next); if (selected === deleteTarget.id || deleteTarget.kind === 'collection') setSelected(null); setDeleteTarget(null); setNotice('Removed locally');
  };
  return <aside className="explorer-sidebar collections-sidebar" aria-label="API collections"><div className="explorer-title"><span>COLLECTIONS · LOCAL</span><FolderPlus size={15}/></div><div className="api-sidebar-tabs"><button onClick={onShowExplorer}>Explorer</button><button className="active">Collections</button></div><div className="collection-scroll"><p className="collection-explain">Profiles are local API test templates. Auth and credential headers are excluded when saving from the editor; review body and notes before saving.</p><div className="collection-add"><input aria-label="New collection name" placeholder="Collection name" value={newCollection} onChange={(event) => setNewCollection(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCollection(); }}/><button onClick={addCollection} disabled={!newCollection.trim()} aria-label="Add collection"><Plus size={15}/></button></div>{collections.length === 0 && <div className="explorer-hint">No collections yet. Create one to keep API test profiles.</div>}{collections.map((collection) => <div key={collection.id}><div className="collection-folder"><button aria-label={`${expanded.includes(collection.id) ? 'Collapse' : 'Expand'} ${collection.name}`} onClick={() => setExpanded((items) => items.includes(collection.id) ? items.filter((id) => id !== collection.id) : [...items, collection.id])}>{expanded.includes(collection.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>{renaming === collection.id ? <input className="collection-rename" aria-label="Rename collection" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameCollection(collection.id); if (event.key === 'Escape') setRenaming(null); }} onBlur={() => renameCollection(collection.id)}/> : <strong title={collection.name}>{collection.name}</strong>}<span>{collection.profiles.length}</span><button title={`Rename ${collection.name}`} aria-label={`Rename ${collection.name}`} onClick={() => { setRenaming(collection.id); setRenameValue(collection.name); }}><Pencil size={12}/></button><button title={`Add profile to ${collection.name}`} aria-label={`Add profile to ${collection.name}`} onClick={() => addProfile(collection.id)}><Plus size={13}/></button><button title={`Delete collection ${collection.name}`} aria-label={`Delete collection ${collection.name}`} onClick={() => setDeleteTarget({ kind: 'collection', id: collection.id })}><Trash2 size={12}/></button></div>{expanded.includes(collection.id) && (collection.profiles.length ? collection.profiles.map((item) => <div key={item.id} className={`collection-profile ${selected === item.id ? 'selected' : ''}`}><button onClick={() => { setSelected(item.id); setNotice(''); }} title={`Edit ${item.name}`}><Code2 size={13}/><span>{item.name}</span></button><button title={`Delete profile ${item.name}`} aria-label={`Delete profile ${item.name}`} onClick={() => setDeleteTarget({ kind: 'profile', id: item.id })}><Trash2 size={12}/></button></div>) : <div className="explorer-hint">No profiles in this collection.</div>)}</div>)}{deleteTarget && <div className="explorer-delete-confirm">Delete this {deleteTarget.kind} locally?{deleteTarget.kind === 'collection' && ' Its profiles will also be removed.'}<div><button onClick={() => setDeleteTarget(null)}>Cancel</button><button onClick={remove}>Delete</button></div></div>}</div>{profile && <div className="collection-editor"><div className="collection-editor-head"><strong>PROFILE</strong><button onClick={saveProfile}><Save size={13}/> Save</button></div><div className="collection-profile-actions"><button title="Duplicate profile" onClick={duplicateProfile}><Copy size={13}/> Duplicate</button><label>Move to <select aria-label="Move profile to collection" value={collections.find((collection) => collection.profiles.some((item) => item.id === profile.id))?.id ?? ''} onChange={(event) => moveProfile(event.target.value)}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label></div><label>Name<input aria-label="Profile name" value={profile.name} onChange={(event) => updateSelected({ name: event.target.value })}/></label><label>Method<select aria-label="Profile method" value={profile.method} onChange={(event) => updateSelected({ method: event.target.value })}>{['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map((method) => <option key={method}>{method}</option>)}</select></label><label>URL<input aria-label="Profile URL" placeholder="https://api.example.com/v1" value={profile.url} onChange={(event) => updateSelected({ url: event.target.value })}/></label><label>Notes<textarea aria-label="Profile notes" value={profile.notes} onChange={(event) => updateSelected({ notes: event.target.value })}/></label><span className="collection-notice">{notice}</span><button className="collection-open" onClick={() => { writeCollections(collections); onOpenProfile(profile); }}>Open in API client</button></div>}</aside>;
}
