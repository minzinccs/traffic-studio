import { useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { CommandMap } from '../../bridge';
export function WindowsProxyPanel() {
  const [state,setState]=useState<CommandMap['windows_proxy_read']['result']|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function read(){setBusy(true);setError('');try{setState(await bridge.command('windows_proxy_read',undefined));}catch(error){setError(bridgeError(error).message);}finally{setBusy(false);}}
  return <section><h4>Windows proxy observation</h4><button disabled={busy} onClick={()=>void read()}>{busy?'Reading…':'Read current Windows proxy'}</button>{error&&<p role="alert">{error}</p>}{state&&<><dl><dt>Scope</dt><dd>{state.scope}</dd><dt>Manual proxy enabled</dt><dd>{state.enabled?'Yes':'No'}</dd><dt>Server</dt><dd>{state.server||'Not configured'}</dd><dt>Bypass</dt><dd>{state.bypass||'Not configured'}</dd><dt>PAC URL</dt><dd>{state.pacUrl||'Not configured'}</dd><dt>Observed</dt><dd>{new Date(state.observedAt).toLocaleString()}</dd></dl><p>{state.message}</p></>}</section>;
}
