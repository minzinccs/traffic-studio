import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { bridge, bridgeError } from '../../bridge';
import type { StoredEntity } from '../../domain/workspace';
import type { Flow } from '../../domain/types';
import { useNativeWorkspace } from '../storage/useNativeWorkspace';

const FLOW_LIMIT = 200;
const SEARCH_DEBOUNCE_MS = 200;
const REVISION_DEBOUNCE_MS = 250;

function isCapturedFlow(row: StoredEntity): boolean {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return (
    (payload.source === 'native_capture' || payload.source === 'har_import') &&
    (payload.type === 'flow' || payload.type === 'paused')
  );
}

/** Deterministic negative id so native rows never collide with sample flow ids. */
export function nativeFlowNumericId(entityId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < entityId.length; index++) {
    hash ^= entityId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return -1000000 - (Math.abs(hash) % 1000000000);
}

function formatBodySize(value: unknown): string {
  const size =
    typeof value === 'object' && value !== null ? Number((value as { size?: unknown }).size ?? NaN) : NaN;
  if (!Number.isFinite(size) || size < 0) return '0 B';
  if (size >= 1048576) return `${(size / 1048576).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${Math.floor(size)} B`;
}

export function mapStoredFlowToExplorerFlow(row: StoredEntity): Flow {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const method = typeof payload.method === 'string' && payload.method ? payload.method : '—';
  const rawUrl = typeof payload.url === 'string' ? payload.url : '';
  let host = 'unknown';
  let path = '/';
  let scheme: 'http' | 'https' = 'https';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      host = parsed.host || 'unknown';
      path = `${parsed.pathname}${parsed.search}` || '/';
      scheme = parsed.protocol === 'http:' ? 'http' : 'https';
    } catch {
      host = 'unknown';
      path = rawUrl.slice(0, 256) || '/';
    }
  }
  const status = Number(payload.status ?? 0);
  const protocol = typeof payload.protocol === 'string' ? payload.protocol : null;
  const kind = typeof payload.type === 'string' ? payload.type : 'flow';
  return {
    id: nativeFlowNumericId(row.id),
    method,
    host,
    path,
    status: Number.isFinite(status) ? status : 0,
    type: protocol ?? kind,
    duration: Number(payload.durationMs ?? 0) || 0,
    size: formatBodySize(payload.responseBody),
    scheme,
  };
}

export interface NativeExplorerFlows {
  active: boolean;
  workspaces: { id: string; name: string }[];
  workspaceId: string;
  workspaceName: string;
  setWorkspaceId: (id: string) => void;
  sessions: StoredEntity[];
  sessionId: string;
  setSessionId: (id: string) => void;
  flows: Flow[];
  flowEntities: StoredEntity[];
  loading: boolean;
  searching: boolean;
  error: string;
  newName: string;
  setNewName: (value: string) => void;
  creating: boolean;
  createError: string;
  createWorkspace: (name: string) => Promise<void>;
  refresh: () => void;
}

/**
 * Real native explorer data. In the desktop app this reads captured/imported
 * flows from the local SQLite repository via entity_query (list) or
 * flow_search (filtered); in the browser it stays idle so sample behavior is
 * unchanged. Native selections use negative synthetic ids and never mix with
 * sample traffic.
 */
export function useNativeExplorerFlows(searchText: string): NativeExplorerFlows {
  const active = isTauri();
  const { workspaces, workspaceId, setWorkspaceId, createWorkspace } = useNativeWorkspace();
  const [entities, setEntities] = useState<StoredEntity[]>([]);
  const [sessions, setSessions] = useState<StoredEntity[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const generation = useRef(0);
  const query = searchText.trim();

  const reload = useCallback(async () => {
    if (!active || !workspaceId) return;
    const ticket = ++generation.current;
    const filtered = query.length > 0;
    if (filtered) setSearching(true);
    else setLoading(true);
    try {
      const [flowRows, sessionRows] = await Promise.all([
        filtered
          ? bridge.command('flow_search', {
              workspaceId,
              query: query.slice(0, 256),
              sessionId: sessionId || null,
              limit: FLOW_LIMIT,
            })
          : bridge.command('entity_query', { workspaceId, kind: 'flow', limit: FLOW_LIMIT, offset: 0 }),
        bridge.command('entity_query', { workspaceId, kind: 'session', limit: FLOW_LIMIT, offset: 0 }),
      ]);
      if (ticket !== generation.current) return;
      const captured = flowRows.filter(isCapturedFlow);
      const inSession = sessionId
        ? captured.filter((row) => String((row.payload as Record<string, unknown>).sessionId ?? '') === sessionId)
        : captured;
      setEntities(inSession);
      setSessions(sessionRows);
      setSessionId((current) =>
        current && sessionRows.some((row) => row.id === current) ? current : '',
      );
      setError('');
    } catch (cause) {
      if (ticket === generation.current) {
        setEntities([]);
        setError(bridgeError(cause).message);
      }
    } finally {
      if (ticket === generation.current) {
        setLoading(false);
        setSearching(false);
      }
    }
  }, [active, workspaceId, sessionId, query]);

  useEffect(() => {
    if (!active || !workspaceId) {
      generation.current++;
      setEntities([]);
      setSessions([]);
      setSessionId('');
      setLoading(false);
      setSearching(false);
      setError('');
      return;
    }
    const timer = window.setTimeout(() => void reload(), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [active, workspaceId, sessionId, query, reload]);

  useEffect(() => {
    if (!active || !workspaceId) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    let timer: number | undefined;
    void bridge
      .onRevision((event) => {
        if (event.workspaceId !== workspaceId) return;
        if (event.kind !== 'flow' && event.kind !== 'session') return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void reload(), REVISION_DEBOUNCE_MS);
      })
      .then((fn) => {
        if (disposed) fn();
        else stop = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stop?.();
      window.clearTimeout(timer);
    };
  }, [active, workspaceId, reload]);

  useEffect(() => {
    setSessionId('');
  }, [workspaceId]);

  async function create(name: string): Promise<void> {
    setCreating(true);
    setCreateError('');
    try {
      await createWorkspace(name);
      setNewName('');
    } catch (cause) {
      setCreateError(bridgeError(cause).message);
    } finally {
      setCreating(false);
    }
  }

  const workspaceName = workspaces.find((row) => row.id === workspaceId)?.name ?? '';
  return {
    active,
    workspaces,
    workspaceId,
    workspaceName,
    setWorkspaceId,
    sessions,
    sessionId,
    setSessionId,
    flows: entities.map(mapStoredFlowToExplorerFlow),
    flowEntities: entities,
    loading,
    searching,
    error,
    newName,
    setNewName,
    creating,
    createError,
    createWorkspace: create,
    refresh: () => void reload(),
  };
}
