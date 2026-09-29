import { useState } from 'react';
import type { CommandMap } from '../../bridge';
import './mcpSetup.css';

type Status = CommandMap['mcp_status']['result'];
type Phase = 'checking' | 'starting' | 'stopping' | 'ready' | 'error';

export function McpSetupPanel({ status, phase, workspaceName, token, onFeedback }: {
  status: Status | null;
  phase: Phase;
  workspaceName: string;
  token: string;
  onFeedback: (message: string) => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const running = status?.running === true;
  const endpoint = running && status.port !== null ? `http://127.0.0.1:${status.port}/mcp` : '';
  const config = endpoint ? JSON.stringify({ mcpServers: { 'traffic-studio-local': { type: 'streamable-http', url: endpoint, headers: { Authorization: `Bearer ${token || 'PASTE_TOKEN_SHOWN_ON_START'}` } } } }, null, 2) : '';
  const stateLabel = phase === 'starting' ? 'Starting listener…' : phase === 'stopping' ? 'Stopping listener…' : phase === 'checking' ? 'Checking local service…' : phase === 'error' ? 'Connection error' : running ? 'Listening on localhost' : 'Stopped';
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); onFeedback(`${label} copied.`); }
    catch { onFeedback('Clipboard unavailable. Select and copy the text manually.'); }
  }
  return <div className="mcp-setup" aria-label="MCP connection setup">
    <div className="mcp-setup-status" role="status" aria-live="polite"><span className={`mcp-state-dot ${running && phase === 'ready' ? 'online' : ''} ${['checking','starting','stopping'].includes(phase) ? 'loading' : ''}`}/><strong>{stateLabel}</strong>{workspaceName && <span>Workspace: {workspaceName}</span>}</div>
    {running && <><div className="mcp-setup-endpoint"><code>{endpoint}</code><button type="button" onClick={() => void copy(endpoint, 'Endpoint')}>Copy URL</button></div>
      <p>Local MCP clients can connect to this loopback URL with the bearer token shown when Start MCP succeeds. The token is issued once per start and revoked on Stop.</p>
      <p>Active permissions: metadata read{status.flowReads ? ', captured HTTP flow read' : ''}{status.draftWrites ? ', draft write' : ''}.</p>
      <div className="mcp-setup-actions"><button type="button" onClick={() => setShowConfig(value => !value)} aria-expanded={showConfig}>{showConfig ? 'Hide client setup' : 'Show client setup JSON'}</button><button type="button" disabled={!token} onClick={() => void copy(config, 'Client setup JSON')}>Copy setup JSON</button></div>
      {showConfig && <div className="mcp-setup-code"><p>Use this for a client that accepts a Streamable HTTP URL and request headers. Client config formats vary; this server currently implements a subset of MCP over HTTP.</p><pre>{config}</pre></div>}
    </>}
    {!running && phase !== 'checking' && <p>Select one workspace, grant the read permission, then start the localhost listener. No network or OS proxy settings change.</p>}
  </div>;
}
