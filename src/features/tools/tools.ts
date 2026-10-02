// FE-2 — Toolbox catalogue.
//
// Available tools run locally: browser codecs, a bounded Regex worker, Web Crypto,
// and the MIT qrcode encoder. JWT decoding does not verify signatures.
export type ToolGroup = 'Codec' | 'Generate' | 'Capture' | 'Later';

export type ToolDef = {
  id: string;
  label: string;
  group: ToolGroup;
  available: boolean;
  hint?: string;
};

export const toolGroups: ToolGroup[] = ['Codec', 'Generate', 'Capture'];

export const tools: ToolDef[] = [
  { id: 'Base64', label: 'Base64', group: 'Codec', available: true },
  { id: 'URL', label: 'URL', group: 'Codec', available: true },
  { id: 'JSON format', label: 'JSON format', group: 'Codec', available: true },
  { id: 'Hex', label: 'Hex', group: 'Codec', available: true },
  { id: 'Timestamp', label: 'Timestamp', group: 'Generate', available: true },
  { id: 'UUID', label: 'UUID', group: 'Generate', available: true },
  { id: 'JWT', label: 'JWT', group: 'Codec', available: true, hint: 'Decode claims only; signature not verified.' },
  { id: 'Hash / HMAC', label: 'Hash / HMAC', group: 'Codec', available: true, hint: 'Web Crypto runs locally.' },
  { id: 'Decoder script', label: 'Decoder script', group: 'Codec', available: true, hint: 'Native bounded script with an in-memory key and reusable code-only profiles.' },
  { id: 'AES', label: 'AES', group: 'Codec', available: true, hint: 'Web Crypto runs locally.' },
  { id: 'RSA', label: 'RSA', group: 'Codec', available: true },
  { id: 'Regex', label: 'Regex', group: 'Codec', available: true },
  { id: 'QR code', label: 'QR code', group: 'Generate', available: true, hint: 'Local QR encoding.' },
  { id: 'Packet capture', label: 'Packet capture', group: 'Capture', available: true, hint: 'Local dumpcap/Npcap frames + TLS key log. Optional; driver not installed by this app.' },
];

export const defaultTool = 'Base64';

export function findTool(id: string): ToolDef | undefined {
  return tools.find((tool) => tool.id === id);
}

export function toolsInGroup(group: ToolGroup): ToolDef[] {
  return tools.filter((tool) => tool.group === group);
}
