import { useEffect,useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge } from '../../bridge';
import type { ProxyRecovery } from '../../domain/platform';
import './proxyRecovery.css';
export function ProxyRecoveryNotice({onOpen}:{onOpen:()=>void}){
  const [state,setState]=useState<ProxyRecovery|null>(null);
  useEffect(()=>{if(!isTauri())return;let alive=true;let sequence=0;async function refresh(){const operation=++sequence;try{const next=await bridge.command('windows_proxy_recovery',undefined);if(alive&&operation===sequence)setState(next);}catch{/* Runtime/storage panels report bridge failures separately. */}}void refresh();window.addEventListener('focus',refresh);window.addEventListener('traffic-studio-proxy-change',refresh);return()=>{alive=false;window.removeEventListener('focus',refresh);window.removeEventListener('traffic-studio-proxy-change',refresh);};},[]);
  if(!state?.id)return null;
  return <aside className="proxy-recovery-notice" role="status"><span>Windows manual proxy backup retained · {state.state}. Inspect settings or restore the app backup.</span><button onClick={onOpen}>Open proxy recovery</button></aside>;
}
