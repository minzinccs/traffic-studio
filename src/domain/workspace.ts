export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type EntityKind = 'request' | 'api_run' | 'collection' | 'environment' | 'session' | 'flow' | 'rule_set' | 'tracker_item' | 'saved_view' | 'dashboard' | 'layout' | 'preferences' | 'legacy_snapshot';
export type WorkspaceRecord = { id: string; name: string; revision: number; createdAt: number; updatedAt: number };
export type StoredEntity = { workspaceId: string; id: string; kind: EntityKind; name: string; schemaVersion: 1; revision: number; payload: Record<string, JsonValue>; updatedAt: number };
export type SaveEntityInput = Pick<StoredEntity, 'workspaceId' | 'id' | 'kind' | 'name' | 'payload'> & { expectedRevision: number };
export type BodyReference = { workspaceId: string; id: string; sha256: string; size: number; mimeType: string };
export type BodyChunk = { data: string; offset: number; nextOffset: number; eof: boolean };
export type RevisionEvent = { workspaceId: string; entityId: string; kind: string; revision: number; sequence: number; schemaVersion: 1 };
export type RuntimeInfo = { mode: 'browser' | 'native'; schemaVersion: 1; storage: boolean; secrets: boolean; engine: boolean; http: boolean; capture: boolean; message: string };
export type MigrationInput = { sourceId: string; name: string; entries: Record<string, string> };
export type MigrationResult = { workspaceId: string; entries: number; alreadyImported: boolean };
export const entityKinds: EntityKind[] = ['request','api_run','collection','environment','session','flow','rule_set','tracker_item','saved_view','dashboard','layout','preferences','legacy_snapshot'];
export function sanitizeDocument(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.filter(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
    const key = String(row.key ?? row.name ?? '').trim();
    return !/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(key);
  }).map(sanitizeDocument);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['auth','password','authPassword','apiKeyValue','cookies','accessToken','refreshToken'].includes(key)).map(([key, child]) => [key, value.secret === true && ['value','currentValue','initialValue'].includes(key) ? '' : sanitizeDocument(child)]));
  return value;
}
