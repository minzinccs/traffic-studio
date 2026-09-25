import type { Flow, FlowDetail, MockResponse, SendInput } from '../domain/types';
import { demoFlows } from '../data/demoFlows';
import { flowDetails } from '../data/flowDetails';

// Single source of truth for all mock data. The app has NO backend yet, so
// every read goes through here. DEMO must stay true until a real bridge exists;
// UI labels use it to mark simulated results instead of claiming real captures.
export const DEMO = true as const;

const statusText = (status: number): string => {
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error',
  };
  return map[status] ?? 'OK';
};

// Attach the synthetic device/app/scheme so the Explorer can group by them.
export function listFlows(): Flow[] {
  return demoFlows.map((flow) => {
    const detail = flowDetails[flow.id];
    return detail
      ? { ...flow, device: detail.device, app: detail.app, scheme: detail.scheme }
      : flow;
  });
}

export function getFlowDetail(id: number): FlowDetail | undefined {
  return flowDetails[id];
}

// Deterministic-enough simulated latency so repeated sends look stable.
function mockLatency(input: SendInput): number {
  const seed = (input.method.length * 7 + input.url.length * 3 + input.headers.length * 11) % 140;
  return 60 + seed;
}

export function sendMockRequest(input: SendInput): MockResponse {
  const cleanUrl = input.url.trim();
  if (!cleanUrl) {
    return {
      id: Date.now(),
      simulated: true,
      status: 400,
      statusText: 'Bad Request',
      durationMs: 0,
      size: '0 B',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{\n  "error": "missing_url",\n  "message": "Enter a request URL before sending."\n}',
    };
  }

  const hasBody = input.method === 'POST' || input.method === 'PUT' || input.method === 'PATCH';
  const status = input.method === 'DELETE' ? 204 : hasBody ? 201 : 200;
  const latency = mockLatency(input);

  const echo = {
    method: input.method,
    url: cleanUrl,
    simulated: true,
    receivedHeaders: input.headers.filter((h) => h.key && h.value),
    receivedBody: input.body || null,
  };
  const body = status === 204 ? '' : JSON.stringify(echo, null, 2);
  const bytes = body ? new Blob([body]).size : 0;
  const size = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

  return {
    id: Date.now(),
    simulated: true,
    status,
    statusText: statusText(status),
    durationMs: latency,
    size,
    headers: [
      { key: 'Content-Type', value: 'application/json; charset=utf-8' },
      { key: 'X-Mock-Response', value: 'traffic-studio-preview' },
      { key: 'X-Response-Time', value: `${latency}ms` },
    ],
    body,
  };
}
