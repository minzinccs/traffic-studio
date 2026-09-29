// Exercise data contracts without a browser or another test dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
const storage = new Map();
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
function load(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (name === 'react') return {};
    if (name.endsWith('.css')) return {};
    const target = path.resolve(path.dirname(file), name);
    return load(fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx');
  }, URL, Blob, atob, btoa, TextEncoder, TextDecoder, crypto: require('node:crypto').webcrypto, localStorage, window: { dispatchEvent() {} }, Event: class {} }, { filename: file });
  return exports;
}
const { createVariableResolver, sanitizeVariables } = load('src/features/environments/resolution.ts');
const variable = (key, value, secret = false) => ({ key, value, secret });
let resolver = createVariableResolver([
  [variable('host', 'global'), variable('url', 'https://{{host}}/v1')],
  [variable('host', 'workspace')], [variable('host', 'collection')], [variable('host', 'request')],
]);
assert.equal(resolver.interpolate('{{url}}'), 'https://request/v1');
assert.equal(resolver.errors.size, 0);
resolver = createVariableResolver([[variable('a', '{{b}}'), variable('b', '{{a}}')]]);
resolver.interpolate('{{a}}');
assert.match([...resolver.errors][0], /cycle/);
resolver = createVariableResolver([[variable('token', 'fallback')], [variable('token', '', true)]]);
assert.equal(resolver.interpolate('{{token}}'), '{{token}}');
assert.match([...resolver.errors][0], /Unresolved/);
assert.equal(sanitizeVariables([variable('token', 'private', true)])[0].value, '');

const { binding, validateKeybindings, keyChord } = load('src/features/settings/shortcuts.tsx');
assert.equal(binding({}, 'newRequest'), 'Ctrl+T');
assert.equal(binding({ newRequest: '' }, 'newRequest'), '');
assert.match(validateKeybindings({ newRequest: 'Ctrl+G' }), /Duplicate/);
assert.equal(validateKeybindings({ newRequest: 'Ctrl+Shift+N' }), '');
assert.match(validateKeybindings({ newRequest: 'N' }), /use Ctrl/);
assert.equal(keyChord({ key: 'Control', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }), '');
assert.equal(keyChord({ key: 'n', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false }), 'Ctrl+Shift+N');

const collections = load('src/features/api/collections.ts');
collections.writeCollections([
  { id: 'parent', name: 'Parent', variables: [variable('host', 'parent')], profiles: [] },
  { id: 'child', parentId: 'parent', name: 'Child', variables: [variable('host', 'child')], profiles: [{ id: 'profile', name: 'Profile', method: 'GET', url: '', body: '', notes: '', headers: [], variables: [variable('token', 'private', true)] }] },
]);
assert.equal(createVariableResolver(collections.profileVariableLayers('profile')).interpolate('{{host}}'), 'child');
assert.equal(createVariableResolver(collections.profileVariableLayers('profile')).interpolate('{{token}}'), 'private');
assert.ok(!storage.get(collections.collectionsKey).includes('private'));
const transfer = load('src/features/api/CollectionTransfer.tsx');
assert.throws(() => transfer.validateCollections('[{"id":"a","parentId":"a","name":"A","profiles":[]}]'), /cycle|itself/);
assert.equal(transfer.validateCollections(storage.get(collections.collectionsKey))[1].profiles[0].variables[0].value, '');

const { validateBackup } = load('src/features/settings/BackupRecovery.tsx');
assert.throws(() => validateBackup('{"version":2,"entries":{}}'), /version 1/);
const draft = { name: 'Draft', method: 'GET', url: 'https://example.com', body: '', auth: 'private', params: [], headers: [{ key: 'Authorization', value: 'private', enabled: true }] };
const recovered = validateBackup(JSON.stringify({ version: 1, entries: {
  'traffic-studio-api-draft-1': JSON.stringify(draft),
  'traffic-studio-api-requests': JSON.stringify([{ ...draft, name: 'Saved' }]),
  'traffic-studio-preferences-v1': '{}',
} }));
assert.equal(JSON.parse(recovered.entries['traffic-studio-api-requests']).length, 2);
assert.ok(!JSON.stringify(recovered.entries).includes('private'));
assert.equal(recovered.ignored.length, 1);
assert.throws(() => validateBackup(JSON.stringify({ version: 1, entries: { 'traffic-studio-environment-names-v1': '["Global"]' } })), /together/);
console.log('Frontend contracts passed: environment precedence/cycles/secrets, folder inheritance, shortcuts, collection validation and backup recovery.');

const { parseHar, exportHar } = load('src/features/capture/sessionFiles.ts');
const binary = btoa(String.fromCharCode(0, 255, 128, 65));
const har = { log: { entries: [{ request: { method: 'GET', url: 'https://example.com/image', headers: [] }, response: { status: 200, headers: [], content: { text: binary, encoding: 'base64', mimeType: 'application/octet-stream', size: 4 } }, time: 0 }] } };
const session = parseHar(JSON.stringify(har));
assert.equal(session.details[1].responseBodyBase64, binary);
const output = JSON.parse(exportHar(session.flows, session.details)).log.entries[0].response.content;
assert.equal(output.text, binary);
assert.equal(output.encoding, 'base64');
assert.equal(output.size, 4);
har.log.entries[0].response.content.text = 'not valid base64!';
assert.throws(() => parseHar(JSON.stringify(har)), /Base64/);
console.log('HAR original binary bytes round trip and malformed Base64 checks passed.');


const profileConfig = { params: [{ id: 4, key: 'q', value: '{{host}}', enabled: false }], bodyMode: 'JSON', docs: 'Saved docs', script: '// draft only', timeoutMs: 1200, followRedirects: false };
collections.updateProfile('profile', { ...collections.readProfile('profile'), requestConfig: profileConfig });
assert.equal(collections.readProfile('profile').requestConfig.docs, 'Saved docs');
const importedConfig = transfer.validateCollections(storage.get(collections.collectionsKey))[1].profiles[0].requestConfig;
assert.equal(importedConfig.params[0].enabled, false);
assert.equal(importedConfig.timeoutMs, 1200);
assert.equal(importedConfig.followRedirects, false);
console.log('Collection profile query/docs/script/settings persistence and transfer passed.');
