import { UiText } from '../localization';
import { VariableEditor } from '../environments/VariableEditor';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Code2, Copy, FolderPlus, Pencil, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { readCollections, writeCollections, type ApiCollection, type ApiProfile } from './collections';
import './collections.css';
import './collectionRow.css';
import { CollectionTransfer } from './CollectionTransfer';
import { SelectField } from '../../shell/SelectField';

export function CollectionsPanel({ focusId, onShowExplorer, onOpenProfile, onOpenCollection }: {
  focusId?: string | null;
  onShowExplorer: () => void;
  onOpenProfile: (profile: ApiProfile) => void;
  onOpenCollection: (collection: ApiCollection) => void;
}) {
  const [transfer, setTransfer] = useState(false);
  const [collections, setCollections] = useState(readCollections);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [newCollection, setNewCollection] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'collection' | 'profile'; id: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setCollections(readCollections());
    window.addEventListener('traffic-studio-collections-change', refresh);
    return () => window.removeEventListener('traffic-studio-collections-change', refresh);
  }, []);
  useEffect(() => { if (focusId) { setExpanded(current => current.includes(focusId) ? current : [...current, focusId]); setMenuId(focusId); } }, [focusId]);

  const owner = collections.find(c => c.profiles.some(p => p.id === selected));
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
  const depth = (id: string) => { let d = 0; let c = collections.find(c => c.id === id); const seen = new Set<string>(); while (c?.parentId && !seen.has(c.parentId)) { seen.add(c.parentId); d++; c = collections.find(x => x.id === c!.parentId); } return d; };
  const addFolder = (parentId: string) => { const id = crypto.randomUUID(); setAll([...collections, { id, name: 'New folder', profiles: [], parentId }]); setExpanded(v => [...v, parentId, id]); setRenaming(id); setRenameValue('New folder'); };
  const addProfile = (collectionId: string) => {
    const item: ApiProfile = { id: crypto.randomUUID(), name: 'New API profile', method: 'GET', url: '', headers: [], body: '', notes: '' };
    setAll(collections.map((collection) => collection.id === collectionId ? { ...collection, profiles: [...collection.profiles, item] } : collection));
    setExpanded((items) => items.includes(collectionId) ? items : [...items, collectionId]);
    setSelected(item.id); setNotice('New profile · edit and save locally');
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
    const removed = new Set([deleteTarget.id]);
    if (deleteTarget.kind === 'collection') {
      let changed = true;
      while (changed) { changed = false; for (const c of collections) if (c.parentId && removed.has(c.parentId) && !removed.has(c.id)) { removed.add(c.id); changed = true; } }
    }
    const next = deleteTarget.kind === 'collection' ? collections.filter((collection) => !removed.has(collection.id)) : collections.map((collection) => ({ ...collection, profiles: collection.profiles.filter((item) => item.id !== deleteTarget.id) }));
    setAll(next);
    if (selected === deleteTarget.id || deleteTarget.kind === 'collection') setSelected(null);
    setDeleteTarget(null); setNotice('Removed locally');
  };

  return <aside className="explorer-sidebar collections-sidebar" aria-label="API collections">
    <div className="explorer-title"><span>COLLECTION · LOCAL</span><FolderPlus size={15} /></div>
    <div><button className="sidebar-action" onClick={onShowExplorer}><ChevronLeft size={14} /> <UiText text={"Collection"} /></button></div>
    <div className="collection-scroll">
      <button className="sidebar-action" onClick={() => setTransfer(true)}><UiText text={"Import / Export JSON"} /></button>
      {transfer && <CollectionTransfer onClose={() => setTransfer(false)} />}
      <p className="collection-explain">Profiles are local API test templates. Auth and credential headers are excluded when saving from the editor; review body and notes before saving.</p>
      <div className="collection-add">
        <input aria-label="New collection name" placeholder="Collection name" value={newCollection} onChange={(event) => setNewCollection(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCollection(); }} />
        <button onClick={addCollection} disabled={!newCollection.trim()} aria-label="Add collection"><Plus size={15} /></button>
      </div>
      {collections.length === 0 && <div className="explorer-hint"><UiText text={"No collections yet. Create one to keep API test profiles."} /></div>}
      {collections.map((collection) => <div key={collection.id}>
        <div className={`collection-folder ${menuId === collection.id ? 'menu-open' : ''}`} style={{ paddingLeft: depth(collection.id) * 12 }}>
          <button aria-label={`${expanded.includes(collection.id) ? 'Collapse' : 'Expand'} ${collection.name}`} onClick={() => setExpanded((items) => items.includes(collection.id) ? items.filter((id) => id !== collection.id) : [...items, collection.id])}>
            {expanded.includes(collection.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {renaming === collection.id
            ? <input className="collection-rename" aria-label="Rename collection" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameCollection(collection.id); if (event.key === 'Escape') setRenaming(null); }} onBlur={() => renameCollection(collection.id)} />
            : <button className="collection-name-btn" type="button" title={`Open ${collection.name}`} onClick={() => onOpenCollection(collection)}><strong>{collection.name}</strong></button>}
          <span>{collection.profiles.length}</span>
          <div className="collection-hover-actions">
            <button type="button" title={`Add profile to ${collection.name}`} aria-label={`Add profile to ${collection.name}`} onClick={() => addProfile(collection.id)}><Plus size={14} /></button>
            <button type="button" title={`Options for ${collection.name}`} aria-label={`Options for ${collection.name}`} aria-expanded={menuId === collection.id} onClick={() => setMenuId(current => current === collection.id ? null : collection.id)}><Settings2 size={14} /></button>
          </div>
          {menuId === collection.id && <div className="collection-row-menu" role="group" aria-label={`${collection.name} options`} onKeyDown={event => { if (event.key === 'Escape') setMenuId(null); }}>
            <button onClick={() => { setRenaming(collection.id); setRenameValue(collection.name); setMenuId(null); }}><Pencil size={13} /> Rename</button>
            <button onClick={() => { addFolder(collection.id); setMenuId(null); }}><FolderPlus size={13} /> Add subcollection</button>
            <button onClick={() => { setDeleteTarget({ kind: 'collection', id: collection.id }); setMenuId(null); }}><Trash2 size={13} /> Delete…</button>
          </div>}
        </div>
        {expanded.includes(collection.id) && (collection.profiles.length
          ? collection.profiles.map((item) => <div key={item.id} className={`collection-profile ${selected === item.id ? 'selected' : ''}`}>
            <button onClick={() => { setSelected(item.id); setNotice(''); }} title={`Edit ${item.name}`}><Code2 size={13} /><span>{item.name}</span></button>
            <button title={`Delete profile ${item.name}`} aria-label={`Delete profile ${item.name}`} onClick={() => setDeleteTarget({ kind: 'profile', id: item.id })}><Trash2 size={12} /></button>
          </div>)
          : <div className="explorer-hint"><UiText text={"No profiles in this collection."} /></div>)}
      </div>)}
      {deleteTarget && <div className="explorer-delete-confirm">
        Delete this {deleteTarget.kind} locally?{deleteTarget.kind === 'collection' && ' Its profiles and nested folders will also be removed.'}
        <div><button onClick={() => setDeleteTarget(null)}><UiText text={"Cancel"} /></button><button onClick={remove}><UiText text={"Delete"} /></button></div>
      </div>}
    </div>
    {profile && <div className="collection-editor">
      <div className="collection-editor-head"><strong><UiText text={"PROFILE"} /></strong><button onClick={saveProfile}><Save size={13} /> <UiText text={"Save"} /></button></div>
      <div className="collection-profile-actions">
        <button title="Duplicate profile" onClick={duplicateProfile}><Copy size={13} /> <UiText text={"Duplicate"} /></button>
        <label><UiText text={"Move to"} /> <SelectField label="Move profile to collection" value={collections.find((collection) => collection.profiles.some((item) => item.id === profile.id))?.id ?? ''} onChange={(value) => moveProfile(value)} options={collections.map((collection) => ({ value: collection.id, label: collection.name }))} /></label>
      </div>
      <label><UiText text={"Name"} /><input aria-label="Profile name" value={profile.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
      <label>Method<SelectField label="Profile method" value={profile.method} onChange={(value) => updateSelected({ method: value })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((method) => ({ value: method, label: method }))} /></label>
      <label>URL<input aria-label="Profile URL" placeholder="https://api.example.com/v1" value={profile.url} onChange={(event) => updateSelected({ url: event.target.value })} /></label>
      <label><UiText text={"Notes"} /><textarea aria-label="Profile notes" value={profile.notes} onChange={(event) => updateSelected({ notes: event.target.value })} /></label>
      <VariableEditor label="Collection variables" rows={owner?.variables ?? []} onChange={variables => setAll(collections.map(c => c.id === owner?.id ? { ...c, variables } : c))} />
      <VariableEditor label="Profile variables" rows={profile.variables ?? []} onChange={variables => updateSelected({ variables })} />
      <span className="collection-notice">{notice}</span>
      <button className="collection-open" onClick={() => { writeCollections(collections); onOpenProfile(profile); }}><UiText text={"Open in API client"} /></button>
    </div>}
  </aside>;
}