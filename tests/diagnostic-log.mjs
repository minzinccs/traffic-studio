import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
globalThis.window = new EventTarget();

const log = await import('../src/features/diagnostics/diagnosticLog.ts');
for (let index = 0; index < 240; index++) {
  log.recordDiagnostic('native', `command_${index}`, 'runtime');
}
assert.equal(log.readDiagnostics().length, 200, 'the in-memory ring stays bounded');

log.recordDiagnostic('native', 'https://private.invalid/?token=supersecret', 'secretvalue');
const latest = log.readDiagnostics().at(-1);
assert.equal(latest.action, 'unknown_action');
assert.equal(latest.code, 'unknown_error');
assert.equal(JSON.stringify(log.readDiagnostics()).includes('supersecret'), false, 'unexpected private input is not stored');

const key = 'traffic-studio-diagnostic-errors-v1';
values.set(key, JSON.stringify([{ id: 'other-window', time: Date.now(), source: 'frontend', action: 'react_render', code: 'render_error', count: 1 }]));
const storageEvent = new Event('storage');
Object.defineProperty(storageEvent, 'key', { value: key });
Object.defineProperty(storageEvent, 'newValue', { value: values.get(key) });
window.dispatchEvent(storageEvent);
assert.equal(log.readDiagnostics().length, 200, 'another window merges into the bounded visible log');
assert.equal(log.readDiagnostics().at(-1).id, 'other-window');
assert.equal(JSON.parse(values.get(key)).at(-1).id, 'other-window', 'merged log is persisted for both windows');

localStorage.setItem = () => { throw new Error('storage full'); };
log.recordDiagnostic('frontend', 'window_error', 'script_error');
assert.equal(log.diagnosticsPersisted(), false, 'storage failure is reported');
assert.equal(log.readDiagnostics().length, 200, 'storage failure retains the bounded in-memory log');
console.log('diagnostic log: bounds, redaction, cross-window merge and storage fallback passed');
