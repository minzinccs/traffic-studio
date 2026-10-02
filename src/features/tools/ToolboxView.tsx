import { UiText } from '../localization';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../../shell/PageChrome';
import { tools } from './tools';
import {DecoderLab} from './DecoderLab';
import { SelectField } from '../../shell/SelectField';
import { Button } from '../../shell/Button';
import './tools.css';

const bytesTo64 = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
const from64 = (text: string) => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export function ToolboxView({ flash, tool = 'Base64', mode = 'Encode', onTool, onMode, showList = true, algorithm = 'SHA-256' }: { flash: (m: string) => void; tool?: string; mode?: 'Encode' | 'Decode'; onTool?: (id: string) => void; onMode?: (mode: 'Encode' | 'Decode') => void; showList?: boolean; algorithm?:string }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [option, setOption] = useState('SHA-256');
  const [secret, setSecret] = useState('');
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ tool: string; result: string }[]>([]);
  const rsaKeys=useRef<CryptoKeyPair|null>(null);
  useEffect(()=>{if(['SHA-1','SHA-256','SHA-384','SHA-512'].includes(algorithm))setOption(algorithm);},[algorithm]);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setOutput(''); setError(''); setBusy(false); }, [tool, mode]);
  useEffect(()=>{setSecret('');},[tool]);
  async function run() {
    const token = ++generation.current; setBusy(true); setError('');
    try {
      let result = ''; const encoder = new TextEncoder();
      if (tool === 'Base64') result = mode === 'Encode' ? bytesTo64(encoder.encode(input)) : new TextDecoder('utf-8', { fatal: true }).decode(from64(input.trim()));
      else if (tool === 'URL') result = mode === 'Encode' ? encodeURIComponent(input) : decodeURIComponent(input);
      else if (tool === 'JSON format') result = JSON.stringify(JSON.parse(input), null, 2);
      else if (tool === 'UUID') result = crypto.randomUUID();
      else if (tool === 'Timestamp') { const date = input.trim() ? /^-?\d+(\.\d+)?$/.test(input.trim()) ? new Date(Number(input) * 1000) : new Date(input) : new Date(); if (!Number.isFinite(date.getTime())) throw Error('Enter Unix seconds or an ISO date.'); result = `${date.toISOString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}`; }
      else if (tool === 'Hex') { if (mode === 'Encode') result = hex(encoder.encode(input)); else { const value = input.replace(/\s/g, ''); if (!/^(?:[a-f\d]{2})*$/i.test(value)) throw Error('Hex needs complete pairs of digits.'); result = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(value.match(/../g) ?? [], b => parseInt(b, 16))); } }
      else if (tool === 'JWT') { const parts = input.trim().split('.'); if (parts.length !== 3) throw Error('JWT must have three dot-separated parts.'); const decode = (part: string) => JSON.parse(new TextDecoder().decode(from64(part.replace(/-/g, '+').replace(/_/g, '/')))); result = JSON.stringify({ header: decode(parts[0]), payload: decode(parts[1]), signatureVerified: false }, null, 2); }
      else if (tool === 'Hash / HMAC') { if(algorithm==='HMAC'&&!secret)throw Error('Enter an HMAC key.'); if (secret) { const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: option }, false, ['sign']); result = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(input)))); } else result = hex(new Uint8Array(await crypto.subtle.digest(option, encoder.encode(input)))); }
      else if (tool === 'AES') {
        if (!secret) throw Error('Enter a passphrase. It stays in memory.');
        const data = mode === 'Decode' ? JSON.parse(input) : null;
        const salt = data ? from64(data.salt) : crypto.getRandomValues(new Uint8Array(16));
        const iv = data ? from64(data.iv) : crypto.getRandomValues(new Uint8Array(12));
        const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
        result = data ? new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(from64(data.ciphertext)))) : JSON.stringify({ format: 'traffic-studio-aes-gcm-v1', salt: bytesTo64(salt), iv: bytesTo64(iv), ciphertext: bytesTo64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(input)))) }, null, 2);
      }
      else if (tool === 'QR code') { if(!input.trim())throw Error('Enter text or a URL.');result=await QRCode.toDataURL(input,{width:280,margin:2,errorCorrectionLevel:'M'}); }
      else if (tool === 'RSA') { if(!rsaKeys.current)rsaKeys.current=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);result=mode==='Encode'?bytesTo64(new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},rsaKeys.current.publicKey,encoder.encode(input)))):new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},rsaKeys.current.privateKey,new Uint8Array(from64(input.trim())))); }
      else if (tool === 'Regex') {
        result = await new Promise<string>((resolve, reject) => {
          const url = URL.createObjectURL(new Blob([`onmessage = e => { try { const r = new RegExp(e.data.pattern, e.data.flags); const text = e.data.input; const matches = r.global ? Array.from(text.matchAll(r)).slice(0,1000) : [r.exec(text)].filter(Boolean); postMessage({result: JSON.stringify(matches.map(m => ({index:m.index,match:m[0],groups:m.slice(1)})),null,2)}); } catch(e) { postMessage({error:e.message}); } }`], { type: 'text/javascript' }));
          const worker = new Worker(url); const cleanup = () => { worker.terminate(); URL.revokeObjectURL(url); window.clearTimeout(timer); };
          const timer = window.setTimeout(() => { cleanup(); reject(Error('Regex timed out after 500 ms. Simplify the pattern.')); }, 500);
          worker.onmessage = e => { cleanup(); e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result); };
          worker.onerror = () => { cleanup(); reject(Error('Regex worker failed.')); };
          worker.postMessage({ pattern, flags, input });
        });
      } else throw Error('This tool is not available.');
      if (token === generation.current) { setOutput(result); setHistory(h => [{ tool, result }, ...h].slice(0, 8)); }
    } catch (e) { if (token === generation.current) { setOutput(''); setError(e instanceof Error ? e.message : 'Invalid input.'); } }
    finally { if (token === generation.current) setBusy(false); }
  }
  return <div className="workspace-page"><PageHead kicker="LOCAL UTILITIES" title="Toolbox" description="Transforms run locally. Results stay in memory; JWT signatures are not verified."/><div className={`tool-workspace ${showList ? '' : 'no-list'}`}>{showList && <div className="tool-sidebar">{tools.map(t => <button key={t.id} disabled={!t.available} title={t.hint} className={tool === t.id ? 'active' : ''} onClick={() => onTool?.(t.id)}>{t.label}</button>)}</div>}<div className="tool-main">{tool==='Decoder script'?<DecoderLab/>:<><div className="tool-title"><h2>{tool}</h2><span className="local-pill">RUNS LOCALLY</span></div>{['Base64','URL','Hex','AES','RSA'].includes(tool) && <div className="segment compact">{(['Encode','Decode'] as const).map(m => <button key={m} className={mode === m ? 'active' : ''} onClick={() => onMode?.(m)}>{m === 'Encode' && ['AES','RSA'].includes(tool) ? 'Encrypt' : m === 'Decode' && ['AES','RSA'].includes(tool) ? 'Decrypt' : m}</button>)}</div>}{tool === 'Hash / HMAC' && <label>Algorithm <SelectField label="Algorithm" value={option} onChange={setOption} options={['SHA-1','SHA-256','SHA-384','SHA-512'].map(v => ({value:v,label:v}))}/></label>}{['Hash / HMAC','AES'].includes(tool) && <label>{tool === 'AES' ? 'Passphrase' : 'HMAC key (empty for hash)'} <input aria-label="Tool secret" type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)}/></label>}{tool === 'Regex' && <div className="tool-options"><label><UiText text={"Pattern"}/><input value={pattern} onChange={e => setPattern(e.target.value)}/></label><label><UiText text={"Flags"}/><input value={flags} onChange={e => setFlags(e.target.value)}/></label></div>}{tool==='RSA'&&<p className="auth-note">RSA-OAEP / SHA-256 · session keys stay in memory; max plaintext 190 UTF-8 bytes. Encrypt then decrypt in this Toolbox session.</p>}<div className="tool-columns"><label>INPUT<textarea aria-label="Tool input"
value={input} onChange={e => setInput(e.target.value)} placeholder="Paste input"/></label><label>OUTPUT<textarea aria-label="Tool output" readOnly value={output}/></label></div>{tool==='QR code'&&output.startsWith('data:image/')&&<div className="qr-result"><img src={output} alt="QR code of the tool input"/><a href={output} download="traffic-studio-qr.png">Download QR PNG</a></div>}{error && <p className="tool-error" role="alert">{error}</p>}<div className="tool-actions"><Button variant="default" disabled={busy} onClick={() => void run()}>{busy ? 'Working…' : 'Run tool'}</Button><Button disabled={!output} onClick={async () => { try { await navigator.clipboard.writeText(output); flash('Tool result copied.'); } catch { flash('Clipboard unavailable. Select the output manually.'); } }}>Copy result</Button><Button onClick={() => { generation.current++; setBusy(false); setInput(''); setOutput(''); setSecret(''); setError(''); }}><UiText text={"Clear"}/></Button></div><details className="tool-history"><summary>Result history ({history.length}) · memory only</summary>{history.map((item, i) => <button key={i} onClick={() => { onTool?.(item.tool); setInput(item.result); }}>{item.tool} · {item.result.slice(0, 55)}</button>)}<Button size="sm" onClick={() => setHistory([])}><UiText text={"Clear history"}/></Button></details></>}</div></div></div>;
}
