import type { FlowDetail } from '../domain/types';

// Rich, clearly-synthetic detail for each sample flow. Used by the mock bridge
// only — nothing here represents real captured traffic.
export const flowDetails: Record<number, FlowDetail> = {
  1: {
    id: 1,
    scheme: 'https',
    url: 'https://api.example.dev/v1/projects',
    startedAt: '2026-09-25T09:12:04.182Z',
    device: 'Desktop · Chrome 128',
    app: 'Studio Dashboard',
    timeline: [
      { label: 'DNS', ms: 9 },
      { label: 'Connect', ms: 23 },
      { label: 'TLS', ms: 31 },
      { label: 'Server', ms: 47 },
      { label: 'Transfer', ms: 18 },
    ],
    query: [{ key: 'team', value: 'core' }, { key: 'limit', value: '20' }],
    requestHeaders: [
      { key: 'Accept', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer eyJhbGciOi…' },
      { key: 'X-Client-Version', value: '0.1.0' },
    ],
    responseHeaders: [
      { key: 'Content-Type', value: 'application/json; charset=utf-8' },
      { key: 'Cache-Control', value: 'private, max-age=30' },
      { key: 'X-RateLimit-Remaining', value: '498' },
    ],
    responseBody: `{
  "projects": [
    { "id": "prj_01", "name": "Atlas", "members": 12 },
    { "id": "prj_02", "name": "Nimbus", "members": 4 },
    { "id": "prj_03", "name": "Comet", "members": 27 }
  ],
  "total": 3
}`,
    note: 'Synthetic sample — no proxy core connected.',
  },
  2: {
    id: 2,
    scheme: 'https',
    url: 'https://api.example.dev/v1/session',
    startedAt: '2026-09-25T09:12:09.540Z',
    device: 'Desktop · Chrome 128',
    app: 'Studio Dashboard',
    timeline: [
      { label: 'DNS', ms: 8 },
      { label: 'Connect', ms: 19 },
      { label: 'TLS', ms: 28 },
      { label: 'Server', ms: 152 },
      { label: 'Transfer', ms: 34 },
    ],
    query: [],
    requestHeaders: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer eyJhbGciOi…' },
    ],
    requestBody: `{
  "email": "analyst@studio.dev",
  "scopes": ["read", "write"]
}`,
    responseHeaders: [
      { key: 'Content-Type', value: 'application/json; charset=utf-8' },
      { key: 'Location', value: '/v1/session/9f2c' },
      { key: 'Set-Cookie', value: 'sid=9f2c…; HttpOnly; Secure' },
    ],
    responseBody: `{
  "sessionId": "9f2c",
  "expiresIn": 3600,
  "scopes": ["read", "write"]
}`,
  },
  3: {
    id: 3,
    scheme: 'https',
    url: 'https://cdn.example.dev/assets/dashboard.js',
    startedAt: '2026-09-25T09:12:11.003Z',
    device: 'Desktop · Chrome 128',
    app: 'Studio Dashboard',
    timeline: [
      { label: 'DNS', ms: 5 },
      { label: 'Connect', ms: 12 },
      { label: 'TLS', ms: 21 },
      { label: 'Server', ms: 33 },
      { label: 'Transfer', ms: 8 },
    ],
    query: [{ key: 'v', value: '1b3f' }],
    requestHeaders: [
      { key: 'Accept', value: '*/*' },
      { key: 'Referer', value: 'https://studio.dev/' },
    ],
    responseHeaders: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'public, max-age=86400' },
      { key: 'Content-Encoding', value: 'gzip' },
    ],
    responseBody: `/* minified bundle — 38 KB synthetic asset */\n(function(){window.__STUDIO__={boot:Date.now()}})();`,
  },
  4: {
    id: 4,
    scheme: 'https',
    url: 'https://api.example.dev/v1/metrics',
    startedAt: '2026-09-25T09:12:14.771Z',
    device: 'Desktop · Chrome 128',
    app: 'Studio Dashboard',
    timeline: [
      { label: 'DNS', ms: 7 },
      { label: 'Connect', ms: 16 },
      { label: 'TLS', ms: 24 },
      { label: 'Server', ms: 38 },
      { label: 'Transfer', ms: 9 },
    ],
    query: [{ key: 'window', value: '1h' }],
    requestHeaders: [
      { key: 'Accept', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer eyJhbGciOi…' },
    ],
    responseHeaders: [
      { key: 'Content-Type', value: 'application/json; charset=utf-8' },
      { key: 'X-Error-Code', value: 'METRICS_NOT_READY' },
    ],
    responseBody: `{
  "error": "metrics_window_not_ready",
  "message": "No samples for the selected window yet."
}`,
    note: 'Sample 404 — backend would return aggregates once collected.',
  },
  5: {
    id: 5,
    scheme: 'https',
    url: 'https://api.example.dev/v1/projects/42',
    startedAt: '2026-09-25T09:12:18.220Z',
    device: 'Desktop · Chrome 128',
    app: 'Studio Dashboard',
    timeline: [
      { label: 'DNS', ms: 6 },
      { label: 'Connect', ms: 14 },
      { label: 'TLS', ms: 22 },
      { label: 'Server', ms: 128 },
      { label: 'Transfer', ms: 12 },
    ],
    query: [],
    requestHeaders: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer eyJhbGciOi…' },
      { key: 'If-Match', value: '"a1b2c3"' },
    ],
    requestBody: `{
  "name": "Atlas",
  "archived": false
}`,
    responseHeaders: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'ETag', value: '"d4e5f6"' },
    ],
    responseBody: '',
  },
};
