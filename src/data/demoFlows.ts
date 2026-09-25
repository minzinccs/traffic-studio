import type { Flow } from '../domain/types';

export const demoFlows: Flow[] = [
  { id: 1, method: 'GET', host: 'api.example.dev', path: '/v1/projects', status: 200, type: 'application/json', duration: 128, size: '4.8 KB' },
  { id: 2, method: 'POST', host: 'api.example.dev', path: '/v1/session', status: 201, type: 'application/json', duration: 241, size: '1.2 KB' },
  { id: 3, method: 'GET', host: 'cdn.example.dev', path: '/assets/dashboard.js', status: 200, type: 'application/javascript', duration: 79, size: '38 KB' },
  { id: 4, method: 'GET', host: 'api.example.dev', path: '/v1/metrics', status: 404, type: 'application/json', duration: 94, size: '312 B' },
  { id: 5, method: 'PATCH', host: 'api.example.dev', path: '/v1/projects/42', status: 204, type: '—', duration: 182, size: '0 B' },
];

