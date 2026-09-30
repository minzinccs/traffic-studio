import { useEffect, useRef, useState } from 'react';
import { bridge, bridgeError } from '../../bridge';
import type { StoredEntity } from '../../domain/workspace';

export interface FlowSearchState {
  results: StoredEntity[] | null;
  searching: boolean;
  error: string;
  usingServer: boolean;
}

export function useFlowSearch(workspaceId: string, sessionId: string, query: string): FlowSearchState {
  const [results, setResults] = useState<StoredEntity[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const text = query.trim();
  useEffect(() => {
    generation.current++;
    if (!workspaceId || !text) {
      setResults(null);
      setSearching(false);
      setError('');
      return;
    }
    const ticket = ++generation.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await bridge.command('flow_search', {
            workspaceId,
            query: text,
            sessionId: sessionId || null,
            limit: 200,
          });
          if (ticket === generation.current) {
            setResults(rows);
            setError('');
          }
        } catch (e) {
          if (ticket === generation.current) {
            setResults(null);
            setError(bridgeError(e).message);
          }
        } finally {
          if (ticket === generation.current) setSearching(false);
        }
      })();
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [workspaceId, sessionId, text]);
  return { results, searching, error, usingServer: results !== null };
}
