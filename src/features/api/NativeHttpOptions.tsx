import { useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { RequestDraft } from './requestDraft';
import { Button } from '../../shell/Button';
export function NativeHttpOptions({draft,onChange,workspaceId}:{draft:RequestDraft;onChange:(patch:Partial<RequestDraft>)=>void;workspaceId:string}) {
  const [message,setMessage]=useState('');
  async function clear(){try{await bridge.command('http_clear_cookies',{workspaceId});setMessage('Workspace session cookies cleared.');}catch(error){setMessage(bridgeError(error).message);}}
  return <section><h4>Native request transport</h4><label>Per-request proxy<input aria-label="Per-request proxy URL" value={draft.proxyUrl??''} placeholder="http://127.0.0.1:8080 (blank = direct)" onChange={e=>onChange({proxyUrl:e.target.value})}/></label><label>Custom CA certificate (PEM)<textarea aria-label="Request custom CA PEM" value={draft.customCaPem??''} spellCheck={false} onChange={e=>onChange({customCaPem:e.target.value})}/></label><label><input type="checkbox" checked={draft.tlsVerify??true} onChange={e=>onChange({tlsVerify:e.target.checked})}/> Verify TLS certificates and hostnames</label>{draft.tlsVerify===false&&<p role="status">TLS verification is disabled for this request only. Windows trust is unchanged.</p>}<label><input type="checkbox" checked={draft.cookiesEnabled??false} onChange={e=>onChange({cookiesEnabled:e.target.checked})}/> Use workspace session cookie jar</label><p>Cookie values stay in native memory, follow domain/path/expiry rules, and clear when the app exits. Cookie jars are off by default.</p><Button size="sm" disabled={!workspaceId} onClick={()=>void clear()}>Clear workspace cookies</Button><p role="status">{message}</p></section>;
}
