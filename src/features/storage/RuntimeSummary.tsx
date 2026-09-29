import { useEffect, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { RuntimeInfo } from '../../domain/workspace';
export function RuntimeSummary() {
  const [runtime,setRuntime]=useState<RuntimeInfo|null>(null);const [error,setError]=useState('');
  useEffect(()=>{let live=true;void bridge.command('runtime_info',undefined).then(value=>{if(live)setRuntime(value);}).catch(error=>{if(live)setError(bridgeError(error).message);});return()=>{live=false;};},[]);
  return <div className="settings-status" role="status">{error||(!runtime?'Reading runtime…':`Runtime: ${runtime.mode} · HTTP: ${runtime.http?'available through Send HTTP':'preview only'} · Capture: ${runtime.capture?'available':'unavailable'} · Repository: ${runtime.mode==='native'?'local SQLite':'browser IndexedDB'}`)}</div>;
}
