export type EditablePair = { id: number; key: string; value: string; enabled: boolean };

let nextId = Date.now() * 1000;
export function createPairId() { return ++nextId; }

export function parsePairs(text: string): EditablePair[] {
  if (text.length > 1024 * 1024) throw Error('Pasted pairs exceed 1 MB.');
  const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim());
  if (lines.length > 1000) throw Error('A grid supports up to 1,000 rows.');
  return lines.map(line => {
    const tab = line.indexOf('\t'); const colon = line.indexOf(':'); const equal = line.indexOf('=');
    const separators = [colon,equal].filter(index=>index>=0);
    const index = tab >= 0 ? tab : separators.length ? Math.min(...separators) : -1;
    return { id: createPairId(), key: (index < 0 ? line : line.slice(0,index)).trim(), value: index < 0 ? '' : line.slice(index+1).trim(), enabled: true };
  });
}
