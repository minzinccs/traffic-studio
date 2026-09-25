export type View = 'traffic' | 'api' | 'rules' | 'history' | 'devices' | 'tools';
export type Tab = { id: number; label: string; view: View };
export type Flow = { id: number; method: string; host: string; path: string; status: number; type: string; duration: number; size: string };

