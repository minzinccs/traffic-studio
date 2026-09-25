import { useEffect, useState } from 'react';

// FE-2 — Shared environment store.
//
// The Environment sidebar (mode F3) and the Environments view must read and
// write the same data, so the storage lives here instead of inside the view.
// Secret values are stripped on every write: a masked variable never persists
// its plain value to localStorage.
export type EnvironmentRow = { id: number; key: string; value: string; secret: boolean };
export type EnvironmentRows = Record<string, EnvironmentRow[]>;

export const environmentNamesKey = 'traffic-studio-environment-names-v1';
export const environmentRowsKey = 'traffic-studio-environment-rows-v1';
export const environmentsEvent = 'traffic-studio-environments-change';

const defaultNames = ['Global'];
const defaultRows: EnvironmentRows = { Global: [{ id: 1, key: 'base_url', value: 'https://api.example.com', secret: false }] };

export function withoutSecretValues(rows: EnvironmentRows): EnvironmentRows {
  return Object.fromEntries(Object.entries(rows).map(([name, variables]) => [name, variables.map((row) => row.secret ? { ...row, value: '' } : row)]));
}

function read<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch { return fallback; }
}

export function readEnvironmentNames(): string[] {
  const names = read<string[]>(environmentNamesKey, defaultNames);
  return Array.isArray(names) && names.length ? names : defaultNames;
}

export function readEnvironmentRows(): EnvironmentRows {
  const rows = read<EnvironmentRows>(environmentRowsKey, defaultRows);
  return rows && typeof rows === 'object' ? rows : defaultRows;
}

export function writeEnvironments(names: string[], rows: EnvironmentRows) {
  try {
    localStorage.setItem(environmentNamesKey, JSON.stringify(names));
    localStorage.setItem(environmentRowsKey, JSON.stringify(withoutSecretValues(rows)));
  } catch { /* Storage may be unavailable; the in-memory editor session still works. */ }
  window.dispatchEvent(new Event(environmentsEvent));
}

// Secret values are never persisted, so a plain re-read from storage would blank
// them out in the editor. Keep the value that is already in memory for rows that
// are still marked secret.
function mergeSecretValues(stored: EnvironmentRows, inMemory: EnvironmentRows): EnvironmentRows {
  return Object.fromEntries(Object.entries(stored).map(([name, variables]) => [name, variables.map((row) => {
    if (!row.secret || row.value) return row;
    const prior = (inMemory[name] ?? []).find((item) => item.id === row.id);
    return prior?.secret && prior.value ? { ...row, value: prior.value } : row;
  })]));
}

// Shared hook: keeps every mounted consumer in step through a change event, so
// the sidebar and the view cannot drift apart.
export function useEnvironments() {
  const [names, setNames] = useState<string[]>(readEnvironmentNames);
  const [rows, setRows] = useState<EnvironmentRows>(readEnvironmentRows);
  useEffect(() => {
    const sync = () => {
      setNames(readEnvironmentNames());
      setRows((current) => mergeSecretValues(readEnvironmentRows(), current));
    };
    window.addEventListener(environmentsEvent, sync);
    return () => window.removeEventListener(environmentsEvent, sync);
  }, []);
  // Write first, then update local state: the change event is dispatched
  // synchronously, so the storage copy is already the sanitized one by the time
  // the listeners read it back.
  const commit = (nextNames: string[], nextRows: EnvironmentRows) => {
    writeEnvironments(nextNames, nextRows);
    setNames(nextNames);
    setRows(nextRows);
  };
  return { names, rows, commit };
}

export function resolveActiveEnvironment(names: string[], requested: string | undefined): string {
  if (requested && names.includes(requested)) return requested;
  return names[0] ?? 'Global';
}
