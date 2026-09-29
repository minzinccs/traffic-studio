import { UiText } from '../localization';
import { useDialogFocus } from '../../shell/useDialogFocus';
import { useRef, useState } from 'react';
import type { Flow, FlowDetail } from '../../domain/types';
import { getFlowDetail } from '../../bridge/mockBridge';
export function FlowCompare({ flows, details, onClose }: { flows: Flow[]; details: Record<number, FlowDetail>; onClose: () => void }) {
  const dialogRoot=useRef<HTMLDivElement>(null); useDialogFocus(dialogRoot,onClose);
  const [left,setLeft]=useState(flows[0]?.id ?? 0); const [right,setRight]=useState(flows[1]?.id ?? flows[0]?.id ?? 0); const [part,setPart]=useState('Response body');
  const text = (id: number) => {const f=flows.find(f=>f.id===id);const d=details[id] ?? getFlowDetail(id);return part==='Summary' ? f ? JSON.stringify(f,null,2) : '' : part==='Request body' ? d?.requestBody ?? '' : part==='Headers' ? JSON.stringify(d?.responseHeaders ?? [],null,2) : d?.responseBody ?? '';};
  const a=text(left),b=text(right);const aLines=a.split('\n'),bLines=b.split('\n');
  return <div className="settings-backdrop"><div ref={dialogRoot} className="protocol-preview" role="dialog" aria-modal="true" aria-label="Compare flows"><header><h2>Compare preview flows</h2><button onClick={onClose}><UiText text={"Close"}/></button></header><p>Line comparison of local preview data. Differences are highlighted by line position.</p><select aria-label="Compare content" value={part} onChange={e=>setPart(e.target.value)}>{['Summary','Request body','Response body','Headers'].map(v=><option key={v}>{v}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>{([{id:left,set:setLeft,lines:aLines,other:bLines},{id:right,set:setRight,lines:bLines,other:aLines}]).map((side,i)=><div key={i}><select aria-label={i?'Right flow':'Left flow'} value={side.id} onChange={e=>side.set(Number(e.target.value))}>{flows.map(f=><option key={f.id} value={f.id}>#{f.id} {f.method} {f.host}{f.path}</option>)}</select><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:420,overflow:'auto'}}>{side.lines.map((line,n)=><div key={n} style={{background:line!==side.other[n]?'#604a2b':undefined}}>{line || '\u00a0'}</div>)}</pre></div>)}</div><p>{a===b?'Identical displayed content.':'Displayed content differs.'}</p></div></div>;
}
