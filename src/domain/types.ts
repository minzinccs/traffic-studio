export type View = 'traffic' | 'api' | 'rules' | 'history' | 'devices' | 'tools' | 'tracker' | 'analytics' | 'environments';

export type Tab = {
  id: number;
  label: string;
  view: 'traffic' | 'api';
  node?: { id: string; name: string; kind: 'request' | 'setup' | 'profile' };
  dirty?: boolean;
  pinned?: boolean;
  loading?: boolean;
};

export type Flow = {
  id: number;
  method: string;
  host: string;
  path: string;
  status: number;
  type: string;
  duration: number;
  size: string;
  device?: string;
  app?: string;
  scheme?: 'http' | 'https';
};

export type Pair = { key: string; value: string };

export type TimelinePhase = { label: string; ms: number };

export type FlowDetail = {
  id: number;
  scheme: 'http' | 'https';
  url: string;
  startedAt: string;
  device: string;
  app: string;
  timeline: TimelinePhase[];
  query: Pair[];
  requestHeaders: Pair[];
  responseHeaders: Pair[];
  requestBody?: string;
  responseBody: string;
  responseBodyBase64?: string; // Original HAR bytes, retained independently of decoded text.
  note?: string;
};

export type MockResponse = {
  id: number;
  simulated: true;
  status: number;
  statusText: string;
  durationMs: number;
  size: string;
  headers: Pair[];
  body: string;
};

export type SendInput = {
  method: string;
  url: string;
  headers: Pair[];
  body?: string;
};
