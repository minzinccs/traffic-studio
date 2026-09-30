import { sanitizeDocument, type StoredEntity, type WorkspaceRecord, type RevisionEvent } from '../domain/workspace';
import { BridgeError, type Bridge, type CommandMap } from './contracts';
const databaseName = 'traffic-studio-preview-repository-v1';
let opened: Promise<IDBDatabase> | undefined;
const events = new EventTarget();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${databaseName}-revisions`);
channel?.addEventListener('message', event => {
  const value = event.data as Partial<RevisionEvent> | null;
  if (value?.schemaVersion === 1 && typeof value.workspaceId === 'string' && typeof value.entityId === 'string' && typeof value.kind === 'string' && Number.isSafeInteger(value.revision) && Number.isSafeInteger(value.sequence)) events.dispatchEvent(new CustomEvent('revision', { detail: value }));
});
let sequence = 0;
function database() {
  if (!opened) opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', { keyPath: 'id' });
      const entities = db.objectStoreNames.contains('entities') ? request.transaction!.objectStore('entities') : db.createObjectStore('entities', { keyPath: ['workspaceId', 'id'] });
      if (!entities.indexNames.contains('workspace')) entities.createIndex('workspace', 'workspaceId');
      if (!entities.indexNames.contains('workspace_kind_updated')) entities.createIndex('workspace_kind_updated', ['workspaceId', 'kind', 'updatedAt', 'id']);
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opened = undefined; }; resolve(request.result); };
    request.onerror = () => { opened = undefined; reject(new BridgeError('storage', 'Browser database could not be opened.')); };
    request.onblocked = () => { opened = undefined; reject(new BridgeError('busy', 'Close older preview windows before upgrading storage.')); };
  });
  return opened;
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, success: (value: T) => void, fail: (error: BridgeError) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode); let result: T; let customError: BridgeError | undefined;
    tx.oncomplete = () => resolve(result); tx.onabort = tx.onerror = () => reject(customError ?? new BridgeError('storage', 'Browser transaction failed. Data was not saved.'));
    try { run(tx, value => { result = value; }, error => { customError = error; tx.abort(); }); } catch { customError = new BridgeError('storage', 'Invalid storage operation.'); tx.abort(); }
  });
}
function emit(workspaceId: string, entityId: string, kind: string, revision: number) {
  const detail: RevisionEvent = { workspaceId, entityId, kind, revision, sequence: ++sequence, schemaVersion: 1 };
  events.dispatchEvent(new CustomEvent<RevisionEvent>('revision', { detail })); channel?.postMessage(detail);
}
async function execute(name: keyof CommandMap, args: unknown): Promise<unknown> {
  if (name === 'runtime_diagnostics') return { hostWorkingSetBytes: null, uptimeSeconds: Math.floor(performance.now() / 1000) };
  if (name === 'native_error_log') return [];
  if (name === 'native_error_clear') return;
  if (name === 'runtime_info') return { mode: 'browser', schemaVersion: 1, storage: true, secrets: false, engine: false, http: false, capture: false, message: 'Browser IndexedDB repository only. Rust storage, credential vault and network services are unavailable in this preview.' };
  if (name === 'workspace_list') return transaction<WorkspaceRecord[]>(['workspaces'], 'readonly', (tx, done) => { const read = tx.objectStore('workspaces').getAll(); read.onsuccess = () => done(read.result); });
  if (name === 'workspace_create') {
    const { name: title } = args as CommandMap['workspace_create']['args'];
    if (!title.trim() || title.trim().length > 80) throw new BridgeError('validation', 'Workspace name must contain 1–80 characters.');
    const value: WorkspaceRecord = { id: crypto.randomUUID(), name: title.trim(), revision: 1, createdAt: Date.now(), updatedAt: Date.now() };
    await transaction<void>(['workspaces'], 'readwrite', (tx, done) => { tx.objectStore('workspaces').add(value); done(); }); emit(value.id, value.id, 'workspace', 1); return value;
  }
  if (name === 'workspace_rename') {
    const input = args as CommandMap['workspace_rename']['args'];
    if (!input.name.trim() || input.name.length > 80) throw new BridgeError('validation', 'Invalid workspace name.');
    const value = await transaction<WorkspaceRecord>(['workspaces'], 'readwrite', (tx, done, fail) => {
      const store = tx.objectStore('workspaces'); const read = store.get(input.id); read.onsuccess = () => {
        const current = read.result as WorkspaceRecord | undefined; if (!current || current.revision !== input.expectedRevision) { fail(new BridgeError('conflict', 'Workspace changed. Reload before renaming.')); return; }
        const next = { ...current, name: input.name.trim(), revision: current.revision + 1, updatedAt: Date.now() }; store.put(next); done(next);
      };
    }); emit(value.id, value.id, 'workspace', value.revision); return value;
  }
  if (name === 'entity_query') {
    const input = args as CommandMap['entity_query']['args'];
    if (!Number.isSafeInteger(input.offset) || input.offset < 0 || !Number.isSafeInteger(input.limit) || input.limit < 1) throw new BridgeError('validation', 'Invalid document page.');
    return transaction<StoredEntity[]>(['entities'], 'readonly', (tx, done) => {
      const rows: StoredEntity[] = [];
      const range = IDBKeyRange.bound([input.workspaceId, input.kind, 0], [input.workspaceId, input.kind, Number.MAX_SAFE_INTEGER]);
      const read = tx.objectStore('entities').index('workspace_kind_updated').openCursor(range, 'prev');
      let skipped = 0;
      const limit = Math.min(200, input.limit);
      read.onsuccess = () => {
        const cursor = read.result;
        if (!cursor || rows.length >= limit) { done(rows); return; }
        if (skipped++ >= input.offset) rows.push(cursor.value as StoredEntity);
        if (rows.length >= limit) done(rows); else cursor.continue();
      };
    });
  }
  if (name === 'entity_get') {
    const input = args as CommandMap['entity_get']['args'];
    return transaction<StoredEntity>(['entities'], 'readonly', (tx, done, fail) => { const read = tx.objectStore('entities').get([input.workspaceId, input.id]); read.onsuccess = () => read.result ? done(read.result) : fail(new BridgeError('not_found', 'Document no longer exists.')); });
  }
  if (name === 'entity_save') {
    const { input } = args as CommandMap['entity_save']['args'];
    if (!input.name.trim() || input.name.length > 80 || !input.payload || Array.isArray(input.payload) || JSON.stringify(input.payload).length > 1024 * 1024) throw new BridgeError('validation', 'Expected a named JSON object up to 1 MB.');
    const value = await transaction<StoredEntity>(['entities','workspaces'], 'readwrite', (tx, done, fail) => {
      const readWorkspace = tx.objectStore('workspaces').get(input.workspaceId); readWorkspace.onsuccess = () => {
        if (!readWorkspace.result) { fail(new BridgeError('not_found', 'Workspace no longer exists.')); return; }
        const store = tx.objectStore('entities'); const read = store.get([input.workspaceId, input.id]); read.onsuccess = () => {
          const current = read.result as StoredEntity | undefined;
          if ((current?.revision ?? 0) !== input.expectedRevision || current && current.kind !== input.kind) { fail(new BridgeError('conflict', 'Document changed. Reload or save a copy.')); return; }
          const next: StoredEntity = { workspaceId: input.workspaceId, id: input.id, kind: input.kind, name: input.name.trim(), schemaVersion: 1, revision: input.expectedRevision + 1, payload: sanitizeDocument(input.payload) as StoredEntity['payload'], updatedAt: Date.now() }; store.put(next); done(next);
        };
      };
    }); emit(value.workspaceId, value.id, value.kind, value.revision); return value;
  }
  if (name === 'entity_delete') {
    const input = args as CommandMap['entity_delete']['args'];
    await transaction<void>(['entities'], 'readwrite', (tx, done, fail) => { const store = tx.objectStore('entities'); const read = store.get([input.workspaceId, input.id]); read.onsuccess = () => {
      if (!read.result || read.result.revision !== input.expectedRevision) { fail(new BridgeError('conflict', 'Document changed or was deleted.')); return; } store.delete([input.workspaceId, input.id]); done();
    }; }); emit(input.workspaceId,input.id,'deleted',input.expectedRevision+1); return;
  }
  if (name === 'flow_search') {
    const input = args as CommandMap['flow_search']['args'];
    const text = input.query.trim().toLowerCase();
    if (!text || text.length > 256) throw new BridgeError('validation', 'Search text must contain 1-256 characters.');
    const limit = Math.min(200, Math.max(1, input.limit));
    return transaction<StoredEntity[]>(['entities'], 'readonly', (tx, done) => {
      const rows: StoredEntity[] = [];
      const range = IDBKeyRange.bound([input.workspaceId, 'flow', 0], [input.workspaceId, 'flow', Number.MAX_SAFE_INTEGER]);
      const read = tx.objectStore('entities').index('workspace_kind_updated').openCursor(range, 'prev');
      read.onsuccess = () => {
        const cursor = read.result;
        if (!cursor || rows.length >= limit) { done(rows); return; }
        const row = cursor.value as StoredEntity;
        const session = typeof row.payload?.sessionId === 'string' ? row.payload.sessionId : '';
        if ((!input.sessionId || session === input.sessionId) && `${row.payload?.method ?? ''} ${row.payload?.url ?? ''} ${row.payload?.status ?? ''}`.toLowerCase().includes(text)) rows.push(row);
        cursor.continue();
      };
    });
  }
  throw new BridgeError('unsupported', 'This operation requires the native backend. Browser preview has no plaintext secret or network fallback.');
}
export const browserBridge: Bridge = {
  async command<K extends keyof CommandMap>(name: K, args: CommandMap[K]['args']): Promise<CommandMap[K]['result']> { return await execute(name, args) as CommandMap[K]['result']; },
  async onRevision(callback) { const handler = (event: Event) => callback((event as CustomEvent<RevisionEvent>).detail); events.addEventListener('revision',handler); return () => events.removeEventListener('revision',handler); },
};
