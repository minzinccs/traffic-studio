import { UiText } from '../localization';
import { Button } from '../../shell/Button';
import { Globe2, Info, KeyRound, Plus } from 'lucide-react';
import { useEnvironments } from './environments';
import './environmentSidebar.css';

// FE-2 — Environment sidebar (mode F3).
//
// Lists the environments stored in this browser profile and picks the active
// one. Editing variables stays in the Environments view; both read the same
// store so they never disagree.
export function EnvironmentSidebar({ active, onActive }: { active: string; onActive: (name: string) => void }) {
  const { names, rows, commit } = useEnvironments();
  const add = () => {
    const name = `Environment ${names.length}`;
    commit([...names, name], { ...rows, [name]: [] });
    onActive(name);
  };

  return <aside className="explorer-sidebar" aria-label="Environment sidebar">
    <div className="explorer-title"><span>ENVIRONMENT · LOCAL</span><Globe2 size={15}/></div>
    <div className="env-sidebar-actions"><Button className="env-add" onClick={add}><Plus size={14}/> <UiText text={"New environment"}/></Button></div>
    <div className="env-scroll">
      {names.map((name) => <button
        key={name}
        className={`env-row ${active === name ? 'selected' : ''}`}
        onClick={() => onActive(name)}
        aria-pressed={active === name}
      >
        {name === 'Global' ? <Globe2 size={14}/> : <KeyRound size={14}/>}
        <span className="env-row-copy"><strong>{name}</strong><small>{(rows[name] ?? []).length} variables</small></span>
      </button>)}
      {names.length === 0 && <div className="explorer-hint">No environments yet.</div>}
      <div className="env-note"><Info size={14}/><span>Secret values stay in memory and clear on reload. Nothing is sent anywhere.</span></div>
    </div>
  </aside>;
}
