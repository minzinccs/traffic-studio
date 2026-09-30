import { useState } from 'react';
import { SelectField } from '../../shell/SelectField';
import type { RequestDraft } from './requestDraft';
const pre='ts.setVariable("nonce", String(Date.now()));\nts.request.headers.push({ key: "X-Request-Nonce", value: "{{nonce}}" });';
const post='ts.test("Successful HTTP status", () => {\n  ts.assert(ts.response.status >= 200 && ts.response.status < 400);\n});';
export function ScriptEditor({draft,onChange,native}:{draft:RequestDraft;onChange:(patch:Partial<RequestDraft>)=>void;native:boolean}){
  const [phase,setPhase]=useState<'Pre-request'|'Tests'>('Pre-request');
  const current=phase==='Tests'?draft.testScript??'':draft.script??'';
  function edit(value:string){onChange(phase==='Tests'?{testScript:value}:{script:value});}
  return <div className="api-field-body"><p>{native?'Native Send runs synchronous JavaScript in an isolated QuickJS context.':'Browser transport keeps scripts as drafts; no script executes.'} Limits: one second, 16 MiB, 256 KiB input context. No network/file/shell/Tauri/Node/Postman APIs. Variables last for this run; logs are suppressed.</p>
    <SelectField label="Script phase" value={phase} onChange={value=>setPhase(value as typeof phase)} options={['Pre-request','Tests'].map(v=>({value:v,label:v}))}/>
    <button onClick={()=>{if(current.trim()&&!window.confirm('Replace this script with the example?'))return;edit(phase==='Tests'?post:pre);}}>Insert {phase==='Tests'?'response assertion':'request variable'} example</button>
    <textarea aria-label="Request script draft" spellCheck={false} value={current} onChange={e=>edit(e.target.value)} placeholder="// ts.request, ts.response, ts.getVariable/setVariable, ts.test, ts.assert"/>
    <p>Pre-request failures block Send. Response script failures preserve the received HTTP response. Assertion summaries are stored; script variables and raw log content are excluded. Response body available to scripts is the 64 KiB preview; check ts.response.previewTruncated.</p>
  </div>;
}
