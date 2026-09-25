import { useEffect, useState } from 'react';
import { ArrowDownToLine, Copy, X } from 'lucide-react';
import type { Flow, Pair } from '../../domain/types';
import { getFlowDetail } from '../../bridge/mockBridge';
import './inspectorResize.css';

type Tab = 'overview' | 'raw' | 'headers' | 'body' | 'timeline';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Summary' },
  { id: 'raw', label: 'Raw' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'timeline', label: 'Timeline' },
];

function KVList({ title, pairs }: { title: string; pairs: Pair[] }) {
  if (pairs.length === 0) return null;
  return <div className="kv-block"><div className="detail-label section-gap">{title}</div>{pairs.map((pair) => <div className="kv-row" key={pair.key}><span className="kv-key">{pair.key}</span><span className="kv-val">{pair.value}</span></div>)}</div>;
}

export function TrafficInspector({ flow, onClose, flash }: { flow: Flow | undefined; onClose: () => void; flash: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [width, setWidth] = useState(() => { const saved = Number(localStorage.getItem('traffic-studio-inspector-width')); return saved >= 280 && saved <= 650 ? saved : 360; });
  useEffect(() => { setTab('overview'); }, [flow?.id]);
  useEffect(() => { localStorage.setItem('traffic-studio-inspector-width', String(width)); }, [width]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault(); const start = event.clientX; const initial = width;
    const move = (next: PointerEvent) => setWidth(Math.min(650, Math.max(280, initial + start - next.clientX)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  };

  if (!flow) return null;
  const detail = getFlowDetail(flow.id);
  const total = detail ? detail.timeline.reduce((sum, p) => sum + p.ms, 0) : flow.duration;
  const copy = (text: string) => { void navigator.clipboard.writeText(text); flash('Copied to clipboard.'); };
  const requestRaw = detail ? `${flow.method} ${detail.url}\n${detail.requestHeaders.map((header) => `${header.key}: ${header.value}`).join('\n')}${detail.requestBody ? `\n\n${detail.requestBody}` : ''}` : '';
  const responseRaw = detail ? `SIMULATED RESPONSE ${flow.status}\n${detail.responseHeaders.map((header) => `${header.key}: ${header.value}`).join('\n')}${detail.responseBody ? `\n\n${detail.responseBody}` : ''}` : '';

  return <div className="inspector-shell" style={{ width }}><div className="inspector-resizer" role="separator" aria-label="Resize inspector" aria-orientation="vertical" aria-valuenow={width} aria-valuemin={280} aria-valuemax={650} tabIndex={0} onPointerDown={startResize} onDoubleClick={() => setWidth(360)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setWidth((value) => Math.min(650, value + 16)); if (event.key === 'ArrowRight') setWidth((value) => Math.max(280, value - 16)); }}/><aside className="inspector">
    <div className="inspector-title">
      <div><span className="eyebrow">REQUEST #{flow.id}</span><h2>{flow.method} {flow.path}</h2></div>
      <button className="icon-button" onClick={onClose} title="Close inspector"><X size={17}/></button>
    </div>
    <div className="inspector-tabs">
      {tabs.map((t) => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      <span className="inspector-flag">MOCK</span>
    </div>
    <div className="inspector-body" key={`${flow.id}-${tab}`}>
      {!detail && <div className="no-results">No detail available for this sample request.</div>}
      {detail && tab === 'overview' && <>
        <div className="detail-label">GENERAL</div>
        <Detail label="Host" value={flow.host}/>
        <Detail label="Method" value={flow.method}/>
        <Detail label="Status" value={String(flow.status)}/>
        <Detail label="Scheme" value={detail.scheme.toUpperCase()}/>
        <Detail label="Duration" value={`${flow.duration} ms`}/>
        <Detail label="Content type" value={flow.type}/>
        <Detail label="Device" value={detail.device}/>
        <Detail label="App" value={detail.app}/>
        <div className="detail-label section-gap">RESPONSE</div>
        <Detail label="Result" value={flow.status >= 400 ? 'Error response' : 'Completed sample'}/>
        <Detail label="Size" value={flow.size}/>
        <div className="detail-label section-gap">RAW URL</div>
        <div className="raw-url">{detail.url}</div>
        {detail.query.length > 0 && <div className="detail-label section-gap">QUERY</div>}
        {detail.query.map((q) => <div className="kv-row" key={q.key}><span className="kv-key">{q.key}</span><span className="kv-val">{q.value}</span></div>)}
      </>}
      {detail && tab === 'raw' && <>
        <div className="detail-label">REQUEST · SAMPLE</div>
        <div className="body-block"><button className="body-copy" title="Copy raw request" onClick={() => copy(requestRaw)}><Copy size={13}/></button><pre>{requestRaw}</pre></div>
        <div className="detail-label section-gap">RESPONSE · SAMPLE</div>
        <div className="body-block"><button className="body-copy" title="Copy raw response" onClick={() => copy(responseRaw)}><Copy size={13}/></button><pre>{responseRaw}</pre></div>
      </>}
      {detail && tab === 'headers' && <>
        <KVList title="REQUEST HEADERS" pairs={detail.requestHeaders}/>
        <KVList title="RESPONSE HEADERS" pairs={detail.responseHeaders}/>
      </>}
      {detail && tab === 'body' && <>
        {detail.requestBody ? <div className="kv-block"><div className="detail-label section-gap">REQUEST BODY</div><div className="body-block"><button className="body-copy" title="Copy" onClick={() => copy(detail!.requestBody!)}><Copy size={13}/></button><pre>{detail.requestBody}</pre></div></div> : null}
        <div className="kv-block">
          <div className="detail-label section-gap">RESPONSE BODY {flow.status === 204 && '(empty)'}</div>
          {detail.responseBody
            ? <div className="body-block"><button className="body-copy" title="Copy" onClick={() => copy(detail!.responseBody)}><Copy size={13}/></button><pre>{detail.responseBody}</pre></div>
            : <div className="no-results">No response body for this status.</div>}
        </div>
      </>}
      {detail && tab === 'timeline' && <>
        <div className="detail-label">WATERFALL</div>
        <div className="timeline">
          {detail.timeline.map((phase) => <div className="timeline-row" key={phase.label}>
            <span className="timeline-label">{phase.label}</span>
            <span className="timeline-track"><span className="timeline-seg" style={{ width: `${(phase.ms / total) * 100}%` }}/></span>
            <span className="timeline-ms">{phase.ms} ms</span>
          </div>)}
        </div>
        <div className="detail-label section-gap">TOTAL</div>
        <div className="timeline-total">{total} ms</div>
        <div className="detail-label section-gap">EXPORT</div>
        <button className="outline-button" onClick={() => flash('HAR export connects to the capture core in the next phase.')}><ArrowDownToLine size={15}/> Export as HAR</button>
      </>}
    </div>
  </aside></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}
