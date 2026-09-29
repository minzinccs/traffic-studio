(() => {
  'use strict';
  const parse = JSON.parse.bind(JSON), stringify = JSON.stringify.bind(JSON);
  const input = parse(__input);
  const request = input.request || {};
  const response = input.response || null;
  const variables = Object.assign(Object.create(null), input.variables || {});
  const assertions = [], logs = [];
  const ts = Object.freeze({
    request, response,
    getVariable: key => variables[String(key)],
    setVariable: (key, value) => { key = String(key); if(key.length>180 || Object.keys(variables).length>=1000) throw Error('Variable limit'); variables[key]=String(value); },
    test: (name, fn) => {if(assertions.length>=100)throw Error('Assertion limit');let passed=false;try{passed=fn()!==false;}catch{}assertions.push({name:String(name).slice(0,180),passed});},
    assert: value => {if(!value)throw Error('Assertion failed');},
    log: () => {if(logs.length<32)logs.push('[script log content suppressed]');}
  });
  const console = Object.freeze({log:ts.log,warn:ts.log,error:ts.log});
  const returned = new Function('ts','console', '"use strict";\n'+__source)(ts,console);
  if (returned && typeof returned.then==='function') throw Error('Async scripts unsupported');
  return stringify({request,variables,assertions,logs});
})()
