import { useState } from 'react';
import { FileJson2 } from 'lucide-react';
import type { Flow, View } from '../domain/types';
import { CollectionExplorer } from '../features/api/CollectionExplorer';
import { TrafficExplorer } from '../features/capture/TrafficExplorer';
import './explorer.css';
export type ExplorerNode = {id:string;parentId:string|null;kind:'group'|'request'|'setup'|'profile';name:string};
export type ExplorerProps = {section:View;flows:Flow[];trackedIds:number[];favoriteIds:number[];selectedFlow:number|null;onSelectFlow:(id:number)=>void;onTrack:(id:number)=>void;onFavorite:(id:number)=>void;onOpenNode:(node:ExplorerNode)=>void;onCreateRequest:()=>void;onSetTrafficFilter:(value:string)=>void;trafficFilter:string;onShowCollections:()=>void;source?:string};
export function ExplorerSidebar(props:ExplorerProps){if(props.section==='api')return <CollectionExplorer onOpen={props.onOpenNode} onManage={props.onShowCollections} onNew={props.onCreateRequest}/>;if(props.section==='traffic')return <TrafficExplorer {...props}/>;return null;}
export function SetupFileView({ node }: { node: Pick<ExplorerNode, 'id' | 'name' | 'kind'> }) {
  const key = `traffic-studio-setup-${node.id}`;
  const [content, setContent] = useState(() => localStorage.getItem(key) ?? '{\n  "baseUrl": "https://api.example.com"\n}');
  const [message, setMessage] = useState('Local draft');
  const save = () => { try { JSON.parse(content); localStorage.setItem(key, content); setMessage('Saved locally'); } catch { setMessage('Invalid JSON — fix it before saving'); } };
  return <div className="setup-view"><div className="setup-header"><div><span className="eyebrow">WORKSPACE SETUP FILE</span><h1><FileJson2 size={21}/>{node.name}</h1><p>Editable JSON file stored in this browser profile. This is a UI draft, not a filesystem file.</p></div><button className="primary-action" onClick={save}>Save file</button></div><div className="setup-editor-head"><span>JSON EDITOR</span><span>{message}</span></div><textarea spellCheck={false} aria-label="Setup file content" value={content} onChange={(event) => { setContent(event.target.value); setMessage('Unsaved changes'); }}/></div>;
}
