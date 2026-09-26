import { useDialogFocus } from '../../shell/useDialogFocus';
import { useRef, useState } from 'react';
type Imported = { method: string; url: string; headers: { key: string; value: string }[]; body: string };
export function parseCurl(source: string): Imported {
  const tokens = (source.replace(/\\\r?\n/g, ' ').match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g) ?? []).map(v => v[0] === "'" ? v.slice(1,-1) : v[0] === '"' ? v.slice(1,-1).replace(/\\"/g,'"') : v);
  if (tokens.shift() !== 'curl') throw Error('Paste a curl command. Nothing is executed.');
  let method = 'GET', url = '', body = ''; let explicitMethod=false; const headers: Imported['headers'] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '-X' || token === '--request') { method = tokens[++i] ?? ''; explicitMethod=true; }
    else if (token === '-H' || token === '--header') { const header = tokens[++i] ?? ''; const split = header.indexOf(':'); if (split < 1) throw Error('Invalid header.'); headers.push({ key: header.slice(0,split), value: header.slice(split+1).trim() }); }
    else if (['-d','--data','--data-raw','--data-binary'].includes(token)) { body = tokens[++i] ?? ''; if (body.startsWith('@')) throw Error('File payloads are not supported.'); if (method === 'GET'&&!explicitMethod) method = 'POST'; }
    else if (token === '--url') url = tokens[++i] ?? '';
    else if (token === '--compressed' || token === '-L' || token === '--location') continue;
    else if (/^https?:\/\//.test(token)) url = token;
    else throw Error(`Unsupported cURL option: ${token}`);
  }
  const parsed = new URL(url); if (!['http:','https:'].includes(parsed.protocol) || !/^[A-Z-]+$/.test(method)) throw Error('Invalid HTTP URL or method.');
  return { method, url, headers, body };
}
export function CurlImport({ onApply, onClose, initialText = '', applyLabel = 'Replace current draft' }: { onApply: (value: Imported) => void; onClose: () => void; initialText?:string;applyLabel?:string }) {
  const dialogRoot=useRef<HTMLDivElement>(null); useDialogFocus(dialogRoot,onClose);
  const [text, setText] = useState(initialText); const [preview, setPreview] = useState<Imported | null>(null); const [error, setError] = useState('');
  return <div className="settings-backdrop"><div ref={dialogRoot} className="layout-manager" role="dialog" aria-modal="true" aria-label="Import cURL"><h2>Import cURL</h2><p>Parse an HTTP request locally. Commands are never executed; imported credentials remain in memory.</p><textarea aria-label="cURL command" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} style={{ width: '100%', height: 150 }}/><button onClick={() => { try { setPreview(parseCurl(text)); setError(''); } catch(e) { setPreview(null); setError(e instanceof Error ? e.message : 'Invalid command'); } }}>Preview request</button>{preview && <><p>{preview.method} {preview.url} · {preview.headers.length} headers · {preview.body.length} body characters</p><button onClick={() => { onApply(preview); onClose(); }}>{applyLabel}</button></>}{error && <p role="alert">{error}</p>}<button onClick={onClose}>Cancel</button></div></div>;
}
