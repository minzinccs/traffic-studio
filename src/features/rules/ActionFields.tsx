type Field={key:string;label:string;type?:string;options?:string[]};
const fields:Record<string,Field[]>={
  Breakpoint:[{key:'phase',label:'Pause phase',options:['Request','Response','Both']}],
  Rewrite:[{key:'target',label:'Redirect URL'},{key:'status',label:'Response status',type:'number'},{key:'body',label:'Response body'}],
  'Map local':[{key:'path',label:'Local file path (draft only)'}],
  'Map remote':[{key:'target',label:'Remote URL'}],Gateway:[{key:'target',label:'Gateway target'}],
  'Mirror host':[{key:'target',label:'Mirror target host'}],'Reverse proxy':[{key:'target',label:'Reverse target URL'}],
  'Upstream proxy':[{key:'target',label:'Upstream URL without credentials'}],
  Throttle:[{key:'delayMs',label:'Delay (ms)',type:'number'},{key:'downloadKbps',label:'Download limit (KB/s)',type:'number'},{key:'uploadKbps',label:'Upload limit (KB/s)',type:'number'}],
  'Access control':[{key:'allow',label:'Allow addresses'},{key:'deny',label:'Deny addresses'}],
  'Report server':[{key:'target',label:'Report destination URL'}],
  'Auto highlight':[{key:'color',label:'Highlight color',type:'color'}],
};
export function ActionFields({kind,value,onChange}:{kind:string;value:string;onChange:(value:string)=>void}){
  let current:Record<string,unknown>={};try{const v=JSON.parse(value);if(v&&typeof v==='object'&&!Array.isArray(v))current=v;}catch{/* Keep invalid JSON visible in the advanced editor. */}
  return <div className="rule-action-fields">{(fields[kind]??[]).map(f=><label key={f.key}>{f.label}{f.options?<select value={String(current[f.key]??f.options[0])} onChange={e=>onChange(JSON.stringify({...current,[f.key]:e.target.value},null,2))}>{f.options.map(v=><option key={v}>{v}</option>)}</select>:<input type={f.type??'text'} min={0} value={String(current[f.key]??(f.type==='color'?'#dfa73d':''))} onChange={e=>onChange(JSON.stringify({...current,[f.key]:f.type==='number'?Number(e.target.value):e.target.value},null,2))}/>}</label>)}</div>;
}
