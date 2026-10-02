import { UiText } from '../localization';
import { Button } from '../../shell/Button';
import type { Variable } from './resolution';
import './variables.css';

export function VariableEditor({ label, rows, onChange }: { label: string; rows: Variable[]; onChange: (rows: Variable[]) => void }) {
  function patch(index: number, value: Partial<Variable>) { onChange(rows.map((row, i) => i === index ? { ...row, ...value } : row)); }
  return <fieldset className="scoped-variables"><legend>{label}</legend><p>Overrides lower scopes. Secrets clear on reload and are excluded from exports.</p>{rows.map((row, index) => <div className="scoped-variable" key={index}>
    <input aria-label={`${label} key ${index + 1}`} placeholder="Variable name" value={row.key} onChange={e => patch(index, { key: e.target.value })}/>
    <input aria-label={`${label} value ${index + 1}`} placeholder="Value or {{variable}}" type={row.secret ? 'password' : 'text'} autoComplete="off" value={row.value} onChange={e => patch(index, { value: e.target.value })}/>
    <label><input type="checkbox" checked={row.secret} onChange={e => patch(index, { secret: e.target.checked })}/> <UiText text={"Secret"}/></label>
    <Button variant="ghost" size="sm" type="button" aria-label={`Remove ${label} variable ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>×</Button>
  </div>)}<Button size="sm" type="button" onClick={() => onChange([...rows, { key: '', value: '', secret: false }])}><UiText text={"Add variable"}/></Button></fieldset>;
}
