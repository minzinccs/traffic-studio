import type { Flow } from '../../domain/types';
import { listFlows } from '../../bridge/mockBridge';

// FE-2 — History data sources.
//
// There is no capture backend yet, so this module only ever returns two honest
// things: bundled *sample* fixtures (clearly labelled in the UI) and request
// drafts the user saved in this browser profile. Nothing here may be presented
// as a real captured session, and no fake "session id" is invented.
export type HistorySession = {
  id: string;
  name: string;
  requestCount: number;
  size: string;
  capturedAt: string;
  note: string;
  flowIds: number[];
};

export type SavedRequest = { name: string; method: string; url: string };

export type HistorySelection =
  | { kind: 'session'; id: string }
  | { kind: 'saved'; name: string }
  | null;

const requestsKey = 'traffic-studio-api-requests';

function parseSize(value: string): number {
  const match = /^([\d.]+)\s*(KB|MB|B)$/i.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'MB') return amount * 1024 * 1024;
  if (unit === 'KB') return amount * 1024;
  return amount;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const flows = listFlows();
const sumSize = (list: Flow[]) => formatBytes(list.reduce((total, flow) => total + parseSize(flow.size), 0));
const apiFlows = flows.filter((flow) => flow.host.startsWith('api.'));
const assetFlows = flows.filter((flow) => flow.host.startsWith('cdn.'));

export const sampleSessions: HistorySession[] = [
  {
    id: 'sample-walkthrough',
    name: 'Sample traffic walkthrough',
    requestCount: flows.length,
    size: sumSize(flows),
    capturedAt: 'Bundled fixture',
    note: 'The complete synthetic fixture that ships with this UI preview. It is not a real capture.',
    flowIds: flows.map((flow) => flow.id),
  },
  {
    id: 'sample-api',
    name: 'Sample API calls',
    requestCount: apiFlows.length,
    size: sumSize(apiFlows),
    capturedAt: 'Bundled fixture',
    note: 'Subset of the sample fixture limited to api.example.dev. Sample data only.',
    flowIds: apiFlows.map((flow) => flow.id),
  },
  {
    id: 'sample-assets',
    name: 'Sample asset loads',
    requestCount: assetFlows.length,
    size: sumSize(assetFlows),
    capturedAt: 'Bundled fixture',
    note: 'Subset of the sample fixture limited to cdn.example.dev. Sample data only.',
    flowIds: assetFlows.map((flow) => flow.id),
  },
];

export function readSavedRequests(): SavedRequest[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(requestsKey) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is SavedRequest => {
        const candidate = item as Partial<SavedRequest> | null;
        return Boolean(candidate) && typeof candidate?.name === 'string' && typeof candidate?.method === 'string' && typeof candidate?.url === 'string';
      })
      : [];
  } catch { return []; }
}

export function findSession(id: string): HistorySession | undefined {
  return sampleSessions.find((session) => session.id === id);
}

export function flowsForSession(id: string): Flow[] {
  const session = findSession(id);
  if (!session) return [];
  return flows.filter((flow) => session.flowIds.includes(flow.id));
}

// Matches a sample session or a saved request against a free-text query.
export function matchesSession(session: HistorySession, query: string): boolean {
  return `${session.name} ${session.note} ${session.capturedAt}`.toLowerCase().includes(query);
}

export function matchesSavedRequest(request: SavedRequest, query: string): boolean {
  return `${request.name} ${request.method} ${request.url}`.toLowerCase().includes(query);
}
