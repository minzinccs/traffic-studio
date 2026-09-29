import { useEffect, useRef, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { BodyReference } from '../../domain/workspace';

export function NativeResources({ workspaceId, native }: { workspaceId: string; native: boolean }) {
  const [secretId, setSecretId] = useState<string>(() => crypto.randomUUID());
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [body, setBody] = useState<BodyReference | null>(null);
  const [engine, setEngine] = useState('');
  const cancel = useRef(false);
  const alive = useRef(true);
  const currentWorkspace = useRef(workspaceId); currentWorkspace.current = workspaceId;
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel.current = true; }; }, []);
  useEffect(() => { setSecret(''); setBody(null); setMessage(''); setSecretId(crypto.randomUUID()); cancel.current = true; }, [workspaceId]);
  async function action(run: () => Promise<void>) {
    setBusy(true); setMessage(''); const id = workspaceId;
    try { await run(); if (alive.current && currentWorkspace.current === id) setMessage('Native operation completed.'); }
    catch (error) { if (alive.current && currentWorkspace.current === id) setMessage(bridgeError(error).message); }
    finally { if (alive.current) setBusy(false); }
  }
  async function upload(file: File) {
    const owner = workspaceId; cancel.current = false; setProgress(0); setBody(null);
    const id = await bridge.command('body_begin', { workspaceId: owner, size: file.size, mimeType: file.type || 'application/octet-stream' });
    let finished = false;
    try {
      for (let offset = 0; offset < file.size; offset += 256 * 1024) {
        if (cancel.current || currentWorkspace.current !== owner) throw new Error('Upload cancelled.');
        const bytes = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer());
        let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
        const accepted = await bridge.command('body_append', { workspaceId: owner, id, offset, data: btoa(binary) });
        if (alive.current) setProgress(Math.round(accepted / file.size * 100));
      }
      if (cancel.current || currentWorkspace.current !== owner) throw new Error('Upload cancelled.');
      const result = await bridge.command('body_finish', { workspaceId: owner, id }); finished = true;
      if (alive.current && currentWorkspace.current === owner) { setBody(result); setProgress(100); }
    } finally { if (!finished) await bridge.command('body_cancel', { workspaceId: owner, id }).catch(() => {}); }
  }
  return <section className="native-resources"><h4>Native resources</h4><p>Windows protected credentials and chunked file storage. Available only in the native app; these controls do not start capture.</p>
    <fieldset disabled={!native || !workspaceId || busy}><legend>Protected credential</legend>
      <label>Credential UUID<input value={secretId} onChange={event => { setSecretId(event.target.value); setSecret(''); }}/></label>
      <label>Secret<input type="password" autoComplete="off" value={secret} onChange={event => setSecret(event.target.value)}/></label>
      <button disabled={!secret} onClick={() => void action(async () => { await bridge.command('secret_put', { workspaceId, id: secretId, value: secret }); setSecret(''); })}>Protect and save</button>
      <button onClick={() => void action(async () => { await bridge.command('secret_delete', { workspaceId, id: secretId }); setSecret(''); })}>Delete credential</button>
      <p>Values are cleared from this editor after saving or changing workspace. No reveal, clipboard or export action is provided.</p>
    </fieldset>
    <fieldset disabled={!native || !workspaceId || busy}><legend>Body file store</legend><input type="file" aria-label="Store body file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void action(() => upload(file)); }}/></fieldset>
    {busy && <><progress max={100} value={progress} aria-label="Body upload progress"/><button onClick={() => { cancel.current = true; }}>Cancel file upload</button></>}
    {body && <pre>{JSON.stringify(body, null, 2)}</pre>}
    <button disabled={!native || busy} onClick={() => void action(async () => { const result = await bridge.command('engine_status', undefined); setEngine(`${result.state}: ${result.message}`); })}>Read engine status</button><p>{engine}</p><p role="status">{message}</p>
  </section>;
}
