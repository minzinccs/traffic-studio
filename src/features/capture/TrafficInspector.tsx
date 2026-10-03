import { UiText } from '../localization';
import { Button } from '../../shell/Button';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, X } from 'lucide-react';
import type { Flow, FlowDetail } from '../../domain/types';
import { getFlowDetail } from '../../bridge/mockBridge';
import './inspectorResize.css';
import { FlowAnnotations } from './FlowAnnotations';
import { MessagePane } from './MessagePane';

type Tab = 'summary' | 'headers' | 'body' | 'raw' | 'timeline';
const tabs: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'raw', label: 'Raw' },
  { id: 'timeline', label: 'Timeline' },
];

export function TrafficInspector({ flow, onClose, flash, detailOverride, onExport, source = 'Sample traffic' }: {
  flow: Flow | undefined;
  onClose: () => void;
  flash: (m: string) => void;
  detailOverride?: FlowDetail;
  onExport?: () => void;
  source?: string;
}) {
  const [paneMode, setPaneMode] = useState<'normal' | 'collapsed' | 'maximized'>('normal');
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('traffic-studio-inspector-width'));
    return saved >= 280 && saved <= 650 ? saved : 360;
  });
  useEffect(() => { localStorage.setItem('traffic-studio-inspector-width', String(width)); }, [width]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault(); const start = event.clientX; const initial = width;
    const move = (next: PointerEvent) => setWidth(Math.min(650, Math.max(280, initial + start - next.clientX)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  };

  if (!flow) return null;
  const detail = detailOverride ?? getFlowDetail(flow.id);
  const total = detail ? detail.timeline.reduce((sum, p) => sum + p.ms, 0) : flow.duration;
  const requestRaw = detail ? `${flow.method} ${detail.url}\n${detail.requestHeaders.map((header) => `${header.key}: ${header.value}`).join('\n')}${detail.requestBody ? `\n\n${detail.requestBody}` : ''}` : '';
  const responseRaw = detail ? `PREVIEW RESPONSE ${flow.status}\n${detail.responseHeaders.map((header) => `${header.key}: ${header.value}`).join('\n')}${detail.responseBody ? `\n\n${detail.responseBody}` : ''}` : '';

  return <div className="inspector-shell" data-maximized={paneMode === 'maximized'} style={{ width: paneMode === 'maximized' ? '100%' : width }}>
    <div className="inspector-resizer" role="separator" aria-label="Resize inspector" aria-orientation="vertical" aria-valuenow={width} aria-valuemin={280} aria-valuemax={650} tabIndex={0} onPointerDown={startResize} onDoubleClick={() => setWidth(360)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setWidth((value) => Math.min(650, value + 16)); if (event.key === 'ArrowRight') setWidth((value) => Math.max(280, value - 16)); }} />
    <aside className="inspector">
      <div className="inspector-title">
        <div><span className="eyebrow">REQUEST #{flow.id}</span><h2>{flow.method} {flow.path}</h2></div>
        <button className="icon-button" aria-label="Inspector options" onClick={() => setMenu(v => !v)}>⋯</button>
        {menu && <div className="inspector-options" role="group" aria-label="Inspector layout">
          <button onClick={() => { setPaneMode('collapsed'); setMenu(false); }}><UiText text={"Collapse"} /></button>
          <button onClick={() => { setPaneMode('normal'); setMenu(false); }}><UiText text={"Expand"} /></button>
          <button onClick={() => { setPaneMode('maximized'); setMenu(false); }}><UiText text={"Maximize"} /></button>
          <button disabled title="Requires a native window bridge"><UiText text={"Detach window"} /></button>
        </div>}
        <button className="icon-button" aria-label="Close inspector" onClick={onClose} title="Close inspector"><X size={17} /></button>
      </div>
      <div className="inspector-tabs">
        {tabs.map((t) => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
        <span className="inspector-flag">{detailOverride ? 'LOCAL PREVIEW' : 'SAMPLE'}</span>
      </div>
      <div className="inspector-body" hidden={paneMode === 'collapsed'} key={`${flow.id}-${tab}`}>
        {!detail && <div className="no-results">No detail available for this sample request.</div>}

        {detail && tab === 'summary' && <>
          <div className="inspector-summary">
            <div className="detail-label">GENERAL</div>
            <Detail label="Host" value={flow.host} />
            <Detail label="Method" value={flow.method} />
            <Detail label="Status" value={String(flow.status)} />
            <Detail label="Scheme" value={detail.scheme.toUpperCase()} />
            <Detail label="Duration" value={`${flow.duration} ms`} />
            <Detail label="Content type" value={flow.type} />
            <Detail label="Device" value={detail.device} />
            <Detail label="App" value={detail.app} />
            <div className="detail-label section-gap">RESPONSE</div>
            <Detail label="Result" value={flow.status >= 400 ? 'Error response' : 'Completed sample'} />
            <Detail label="Size" value={flow.size} />
            <div className="detail-label section-gap">RAW URL</div>
            <div className="raw-url">{detail.url}</div>
            {detail.query.length > 0 && <div className="detail-label section-gap">QUERY</div>}
            {detail.query.map((q) => <div className="kv-row" key={q.key}><span className="kv-key">{q.key}</span><span className="kv-val">{q.value}</span></div>)}
            <FlowAnnotations key={`${source}:${flow.id}`} id={flow.id} source={source} />
          </div>
          <MessagePane
            dataLabel={detailOverride ? 'LOCAL PREVIEW' : 'SAMPLE'}
            label="Response"
            raw={responseRaw}
            headers={detail.responseHeaders}
            body={detail.responseBody ?? ''}
            bodyBase64={detail.responseBodyBase64}
            mimeType={flow.type.split(';')[0].trim()}
            mode="body"
            flash={flash}
          />
        </>}

        {detail && (tab === 'headers' || tab === 'body' || tab === 'raw') && <>
          <MessagePane
            dataLabel={detailOverride ? 'LOCAL PREVIEW' : 'SAMPLE'}
            key={`${flow.id}-request-${tab}`}
            label="Request"
            raw={requestRaw}
            headers={detail.requestHeaders}
            body={detail.requestBody ?? ''}
            mode={tab}
            flash={flash}
          />
          <MessagePane
            dataLabel={detailOverride ? 'LOCAL PREVIEW' : 'SAMPLE'}
            key={`${flow.id}-response-${tab}`}
            label="Response"
            raw={responseRaw}
            headers={detail.responseHeaders}
            body={detail.responseBody ?? ''}
            bodyBase64={detail.responseBodyBase64}
            mimeType={flow.type.split(';')[0].trim()}
            mode={tab}
            flash={flash}
          />
        </>}

        {detail && tab === 'timeline' && <>
          <div className="detail-label">WATERFALL</div>
          <div className="timeline">
            {detail.timeline.length === 0 && <p className="no-results">No timing phases recorded in this preview.</p>}
            {detail.timeline.map((phase) => <div className="timeline-row" key={phase.label}>
              <span className="timeline-label">{phase.label}</span>
              <span className="timeline-track"><span className="timeline-seg" style={{ width: `${(phase.ms / total) * 100}%` }} /></span>
              <span className="timeline-ms">{phase.ms} ms</span>
            </div>)}
          </div>
          <div className="detail-label section-gap">TOTAL</div>
          <div className="timeline-total">{total} ms</div>
          <div className="detail-label section-gap">EXPORT</div>
          <Button onClick={onExport} disabled={!onExport} title="Export local preview data"><ArrowDownToLine size={15} /> Export as HAR</Button>
        </>}
      </div>
    </aside>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><span>{value}</span></div>;
}