import { SelectField } from '../../shell/SelectField';
import { ChevronDown, ChevronRight, Copy, Download, Search, WrapText } from 'lucide-react';
import { useState } from 'react';
import type { Pair } from '../../domain/types';

type Mode = 'raw' | 'headers' | 'body';

function autoFormat(mimeType?: string): string {
  if (!mimeType) return 'text';
  const m = mimeType.toLowerCase();
  if (m.includes('json')) return 'json';
  if (m.startsWith('image/')) return 'image';
  return 'text';
}

export function MessagePane({
  label, raw, headers, body, mode,
  bodyBase64, mimeType, flash, dataLabel = 'PREVIEW',
}: {
  label: string;
  raw: string;
  headers: Pair[];
  body: string;
  mode: Mode;
  bodyBase64?: string;
  mimeType?: string;
  flash: (message: string) => void;
  dataLabel?: string;
}) {
  const [format, setFormat] = useState(() => autoFormat(mimeType));
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [headerJson, setHeaderJson] = useState(false);
  const [wrap, setWrap] = useState(true);

  let bytes = new TextEncoder().encode(body);
  let binaryError = '';
  try { if (bodyBase64 !== undefined) bytes = Uint8Array.from(atob(bodyBase64), c => c.charCodeAt(0)); }
  catch { binaryError = 'Invalid stored Base64 body; showing decoded text.'; }
  const byteCount = bytes.length;
  const image = bodyBase64 !== undefined && /^image\/(png|jpeg|gif|webp)$/i.test(mimeType ?? '')
    ? `data:${mimeType};base64,${bodyBase64}`
    : body;
  const shownHeaders = sorted ? [...headers].sort((a, b) => a.key.localeCompare(b.key)) : headers;

  let formatted = body;
  let formatError = false;
  try { if (format === 'json') formatted = JSON.stringify(JSON.parse(body), null, 2); }
  catch { formatError = true; }

  const text = mode === 'raw'
    ? raw
    : mode === 'headers'
      ? (headerJson ? JSON.stringify(shownHeaders, null, 2) : shownHeaders.map(pair => `${pair.key}: ${pair.value}`).join('\n'))
      : format === 'hex'
        ? Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ')
        : format === 'json' ? formatted : body;

  const matches = query ? text.toLowerCase().split(query.toLowerCase()).length - 1 : 0;

  async function copy() {
    try { await navigator.clipboard.writeText(text); flash(`${label} copied.`); }
    catch { flash('Clipboard unavailable. Select the text and copy manually.'); }
  }

  return <section className="message-pane" aria-label={`${label} preview`}>
    <header className="message-heading">
      <button className="message-collapse" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label.toLowerCase()}`} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <strong>{label}</strong>
      </button>
      <span className="message-source">{dataLabel}</span>
      <span className="message-size">{byteCount.toLocaleString()} B · {headers.length} headers</span>
    </header>
    {!collapsed && <>
      <div className="message-toolbar">
        {mode === 'body' && <SelectField label={`${label} body format`} value={format} onChange={setFormat} options={[
          { value: 'text', label: 'Text' },
          { value: 'json', label: 'JSON' },
          { value: 'hex', label: `Hex ${bodyBase64 !== undefined ? '(original bytes)' : '(UTF-8)'}` },
          { value: 'image', label: 'Image' },
          { value: 'protobuf', label: 'Protobuf' },
        ]} />}
        {mode === 'headers' && <>
          <button aria-pressed={sorted} onClick={() => setSorted(v => !v)}>Sort</button>
          <button aria-pressed={headerJson} onClick={() => setHeaderJson(v => !v)}>JSON</button>
        </>}
        {bodyBase64 !== undefined && mode === 'body' && <button
          title="Download original body bytes"
          aria-label={`Download original ${label.toLowerCase()} body`}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.href = url; a.download = `${label.toLowerCase()}-body.bin`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >Original body</button>}
        <span className="message-toolbar-spacer" />
        <button title="Wrap text" aria-label={`Wrap ${label.toLowerCase()} text`} aria-pressed={wrap} onClick={() => setWrap(v => !v)}><WrapText size={15} /></button>
        <button title="Copy displayed content" aria-label={`Copy ${label.toLowerCase()}`} disabled={!text} onClick={() => void copy()}><Copy size={15} /></button>
        <button
          title="Download displayed content"
          aria-label={`Download ${label.toLowerCase()}`}
          disabled={!text}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url; a.download = `${label.toLowerCase()}-${mode}.txt`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        ><Download size={15} /></button>
      </div>
      {text && <div className="message-search">
        <Search size={13} />
        <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Find in content…" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <span role="status">{matches} matches</span>}
      </div>}
      <div className="message-content">
        {binaryError && <p role="alert">{binaryError}</p>}
        {bodyBase64 !== undefined && mode === 'body' && <p>Text is a UTF-8 preview; Hex and original-body download preserve HAR bytes.</p>}
        {formatError && mode === 'body' && <p>Not valid JSON; showing the original text.</p>}
        {mode === 'headers' && !headerJson && headers.length && !query
          ? <table className="message-headers">
            <thead><tr><th>Header</th><th>Value</th></tr></thead>
            <tbody>{shownHeaders.map((h, i) => <tr key={i}><td>{h.key}</td><td>{h.value}</td></tr>)}</tbody>
          </table>
          : mode === 'body' && format === 'image'
            ? /^data:image\/(png|jpeg|gif|webp);base64,/i.test(image)
              ? <img src={image} alt={`${label} body preview`} style={{ maxWidth: '100%' }} />
              : <p className="no-results">No supported image bytes in this preview.</p>
            : mode === 'body' && format === 'protobuf'
              ? <p className="no-results">No protobuf schema or decoded message in this fixture. Raw/Hex remain available.</p>
              : text
                ? <pre style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre' }}>{query
                  ? text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, index) =>
                    part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : part)
                  : text}</pre>
                : <p className="no-results">No {mode === 'headers' ? 'headers' : 'body'} recorded in this preview.</p>}
      </div>
    </>}
  </section>;
}