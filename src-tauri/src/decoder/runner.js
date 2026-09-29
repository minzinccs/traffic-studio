(() => {
  'use strict';
  // No Node, filesystem, network, module loader or Tauri bindings are installed.
  // A fresh bounded QuickJS runtime is used for every invocation.
  const decode = new Function('data', 'key', '"use strict";\n' + __source);
  const value = decode(__data, __key);
  if (value && typeof value.then === 'function') throw Error('Async decoder unsupported');
  if (typeof value === 'string') return value;
  const text = JSON.stringify(value);
  if (typeof text !== 'string') throw Error('Decoder must return a value');
  return text;
})()
