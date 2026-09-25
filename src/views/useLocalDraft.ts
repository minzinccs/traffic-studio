import { useEffect, useState } from 'react';

export function useLocalDraft<T>(key: string, fallback: T, sanitize?: (value: T) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : fallback;
    } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(sanitize ? sanitize(value) : value)); }
    catch { /* Storage may be unavailable or full; the current editor session still works. */ }
  }, [key, value, sanitize]);
  return [value, setValue] as const;
}
