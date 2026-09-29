export type Hello = { protocolVersion: 1; token: string; adapter: 'whistle' | 'mitmproxy' };
export type EngineCommand = { protocolVersion: 1; token: string; operationId: string; command: 'capabilities' | 'start' | 'stop' | 'shutdown' | 'body' | 'rules'; input?: unknown };
export type EngineReply = { operationId: string; sequence: number; ok: boolean; result?: unknown; error?: { code: string; message: string } };
export type EngineCapabilities = { http1: boolean; http2: boolean; http3: boolean; websocket: boolean; sse: boolean; rules: string[]; authenticated: boolean };
