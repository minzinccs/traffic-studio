// FE-2 — Toolbox catalogue.
//
// Only tools that really run in the browser are `available`. Anything that would
// need a crypto/JWT/QR library is listed but disabled with a plain reason, so the
// sidebar never offers a button that silently does nothing.
export type ToolGroup = 'Codec' | 'Generate' | 'Later';

export type ToolDef = {
  id: string;
  label: string;
  group: ToolGroup;
  available: boolean;
  hint?: string;
};

export const toolGroups: ToolGroup[] = ['Codec', 'Generate', 'Later'];

export const tools: ToolDef[] = [
  { id: 'Base64', label: 'Base64', group: 'Codec', available: true },
  { id: 'URL', label: 'URL', group: 'Codec', available: true },
  { id: 'JSON format', label: 'JSON format', group: 'Codec', available: true },
  { id: 'Timestamp', label: 'Timestamp', group: 'Generate', available: true },
  { id: 'UUID', label: 'UUID', group: 'Generate', available: true },
  { id: 'JWT', label: 'JWT', group: 'Later', available: false, hint: 'JWT decoding needs a JWT library.' },
  { id: 'Hash / HMAC', label: 'Hash / HMAC', group: 'Later', available: false, hint: 'No crypto core is wired up.' },
  { id: 'AES', label: 'AES', group: 'Later', available: false, hint: 'No crypto core is wired up.' },
  { id: 'Regex', label: 'Regex', group: 'Later', available: false, hint: 'The regex tester is not built yet.' },
  { id: 'QR code', label: 'QR code', group: 'Later', available: false, hint: 'QR rendering is not built yet.' },
];

export const defaultTool = 'Base64';

export function findTool(id: string): ToolDef | undefined {
  return tools.find((tool) => tool.id === id);
}

export function toolsInGroup(group: ToolGroup): ToolDef[] {
  return tools.filter((tool) => tool.group === group);
}
