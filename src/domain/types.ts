export type View = 'traffic' | 'api' | 'rules' | 'history' | 'devices' | 'tools' | 'tracker' | 'analytics' | 'environments';
export type Tab = { id: number; label: string; view: 'traffic' | 'api'; node?: { id: string; name: string; kind: 'request' | 'setup' } };
export type Flow = { id: number; method: string; host: string; path: string; status: number; type: string; duration: number; size: string };

