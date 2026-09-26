import { useDialogFocus } from '../../shell/useDialogFocus';
import { useEffect, useRef, useState } from 'react';
import './protocols.css';
type Frame = { id: number; direction: string; text: string; time: string };
export function ProtocolPreview({ onClose }: { onClose: () => void }) {
  const dialogRoot=useRef<HTMLDivElement>(null); useDialogFocus(dialogRoot,onClose);
  const [protocol, setProtocol] = useState('WebSocket');
  const [url, setUrl] = useState('wss://example.com/events');
  const [state, setState] = useState('Disconnected');
  const [scenario, setScenario] = useState('Success');
  const [message, setMessage] = useState('');
  const [frames, setFrames] = useState<Frame[]>([]);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function append(direction: string, text: string) { setFrames(f => [...f, { id: Date.now() + Math.random(), direction, text, time: new Date().toLocaleTimeString() }].slice(-500)); }
  function disconnect() { window.clearTimeout(timer.current); setState('Disconnected'); }
  function connect() {
    const valid = protocol === 'WebSocket' ? /^wss?:\/\// : /^https?:\/\//;
    if (!valid.test(url)) { setState('Invalid URL'); return; }
    setState('Connecting (simulation)');
    timer.current = window.setTimeout(() => { if (scenario === 'Failure') setState('Connection failed (simulation)'); else { setState('Connected (simulation)'); append('RECEIVED', protocol === 'SSE' ? 'event: ready\ndata: {"simulated":true}' : '{"event":"ready","simulated":true}'); } }, 350);
  }
  return <div className="settings-backdrop"><div ref={dialogRoot} className="protocol-preview" role="dialog" aria-modal="true" aria-label="Protocol preview"><header><h2>WebSocket / SSE</h2><button onClick={onClose}>Close</button></header><p>MOCK ONLY · No socket or HTTP stream is opened. Frames stay in memory.</p><div className="protocol-controls"><label>Protocol<select value={protocol} onChange={e => { disconnect(); setFrames([]); setProtocol(e.target.value); setUrl(e.target.value === 'SSE' ? 'https://example.com/events' : 'wss://example.com/events'); }}><option>WebSocket</option><option>SSE</option></select></label><label>Scenario<select value={scenario} onChange={e => setScenario(e.target.value)}><option>Success</option><option>Failure</option></select></label></div><label>Endpoint<input aria-label="Protocol endpoint" value={url} onChange={e => setUrl(e.target.value)}/></label><div className="protocol-controls"><button disabled={state.startsWith('Connected') || state.startsWith('Connecting')} onClick={connect}>Connect mock</button><button onClick={disconnect}>Disconnect</button><button onClick={() => setFrames([])}>Clear frames</button><span role="status">{state}</span></div><div className="protocol-frames">{frames.length ? frames.map(f => <article key={f.id}><small>{f.time} · {f.direction} · SAMPLE</small><pre>{f.text}</pre></article>) : <p>No frames. Connect the mock or send a message.</p>}</div><label>Message<textarea aria-label="Protocol message" value={message} onChange={e => setMessage(e.target.value)}/></label><button disabled={!state.startsWith('Connected') || !message.trim() || protocol === 'SSE'} onClick={() => { append('SENT', message); append('RECEIVED · MOCK ECHO', message); setMessage(''); }}>Send mock message</button><button disabled={!state.startsWith('Connected')} onClick={() => append('RECEIVED', protocol === 'SSE' ? 'event: update\ndata: {"sample":42}' : '{"sample":42}')}>Inject sample event</button></div></div>;
}
