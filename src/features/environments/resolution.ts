import type { EnvironmentRow } from './environments';

export type Variable = Pick<EnvironmentRow, 'key' | 'value' | 'secret'>;
export function sanitizeVariables(rows: Variable[] = []): Variable[] {
  return rows.map(row => ({ ...row, value: row.secret ? '' : row.value }));
}
export function validateVariables(raw: unknown): Variable[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 1000 || raw.some(row => !row || typeof row.key !== 'string' || typeof row.value !== 'string' || typeof row.secret !== 'boolean')) throw Error('Variables must be key/value/secret rows (maximum 1000).');
  return sanitizeVariables(raw);
}

// Layers are ordered from Global through workspace/folders to request.
// A blank secret masks lower scopes rather than falling back to their value.
export function createVariableResolver(layers: Variable[][]) {
  const values = new Map<string, Variable>();
  for (const rows of layers) for (const row of rows) if (row.key.trim()) values.set(row.key.trim(), row);
  const errors = new Set<string>();
  function interpolate(text: string, path: string[] = []): string {
    return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token, name: string) => {
      const key = name.trim();
      if (path.includes(key)) { errors.add(`Variable cycle: ${[...path, key].join(' → ')}`); return token; }
      const row = values.get(key);
      if (!row || (row.secret && !row.value)) { errors.add(`Unresolved variable: ${key}`); return token; }
      if (path.length >= 32) { errors.add('Variable nesting exceeds 32 levels.'); return token; }
      return interpolate(row.value, [...path, key]);
    });
  }
  return { interpolate, errors };
}
