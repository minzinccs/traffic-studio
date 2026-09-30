import { useState } from 'react';
import type { Preferences } from './preferences';
import { SelectField } from '../../shell/SelectField';

const presets = [
  { name: 'Studio', theme: 'dark', accent: '#dfa73d', density: 'compact', contrast: false },
  { name: 'Ocean', theme: 'dark', accent: '#56b8d8', density: 'comfortable', contrast: false },
  { name: 'Paper', theme: 'light', accent: '#4472c4', density: 'comfortable', contrast: false },
  { name: 'Focus', theme: 'dark', accent: '#f5d76e', density: 'compact', contrast: true },
] as const;
type Style = Pick<Preferences, 'theme'|'accent'|'density'|'zoom'|'fontSize'|'codeFont'|'corners'|'contrast'|'sidebarLabels'>;
const key = 'traffic-studio-appearance-profiles-v1';
function readProfiles(): {name:string; style:Style}[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(v => v && typeof v.name === 'string' && v.style && ['dark','light'].includes(v.style.theme) && /^#[0-9a-f]{6}$/i.test(v.style.accent) && [80,90,100,110,125].includes(v.style.zoom) && [12,13,14,15,16].includes(v.style.fontSize) && ['compact','comfortable'].includes(v.style.density) && ['mono','consolas'].includes(v.style.codeFont) && ['soft','square'].includes(v.style.corners) && typeof v.style.contrast === 'boolean' && typeof v.style.sidebarLabels === 'boolean').slice(0,12) : []; } catch { return []; }
}
export function Personalization({draft,onChange}:{draft:Preferences;onChange:(value:Partial<Preferences>)=>void}) {
  const [profiles,setProfiles]=useState(readProfiles);
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  function store(next:typeof profiles) { try { localStorage.setItem(key,JSON.stringify(next));setProfiles(next);setMessage('Appearance profiles saved locally. Apply locally to activate the selected style.'); } catch { setMessage('Could not save profiles. Browser storage may be full.'); } }
  function save() {
    if(!name.trim()) {setMessage('Enter a style name.');return;}
    const {theme,accent,density,zoom,fontSize,codeFont,corners,contrast,sidebarLabels}=draft;
    const next=profiles.filter(p=>p.name!==name.trim());
    if(next.length>=12) {setMessage('Maximum 12 styles. Remove one before saving.');return;}
    store([...next,{name:name.trim(),style:{theme,accent,density,zoom,fontSize,codeFont,corners,contrast,sidebarLabels}}]);setName('');
  }
  return <section className="personalization" aria-label="Personalization">
    <p>Personalize this browser workspace. Presets edit the draft; Apply locally activates it.</p>
    <label>Workspace display name<input maxLength={32} value={draft.displayName} onChange={e=>onChange({displayName:e.target.value})}/></label>
    <div className="appearance-presets">{presets.map(p=><button key={p.name} onClick={()=>onChange({theme:p.theme,accent:p.accent,density:p.density,contrast:p.contrast})}><span style={{background:p.accent}}/>{p.name}</button>)}</div>
    <label>Interface text size<SelectField label="Interface text size" value={String(draft.fontSize)} options={[{value:'12',label:'12px'},{value:'13',label:'13px'},{value:'14',label:'14px'},{value:'15',label:'15px'},{value:'16',label:'16px'}]} onChange={value=>onChange({fontSize:Number(value)})} /></label>
    <label>Code font<SelectField label="Code font" value={draft.codeFont} options={[{value:'mono',label:'System monospace'},{value:'consolas',label:'Consolas'}]} onChange={value=>onChange({codeFont:value as Preferences['codeFont']})} /></label>
    <label>Corner style<SelectField label="Corner style" value={draft.corners} options={[{value:'soft',label:'Soft'},{value:'square',label:'Square'}]} onChange={value=>onChange({corners:value as Preferences['corners']})} /></label>
    <label><input type="checkbox" checked={draft.contrast} onChange={e=>onChange({contrast:e.target.checked})}/> Stronger contrast</label>
    <label><input type="checkbox" checked={draft.sidebarLabels} onChange={e=>onChange({sidebarLabels:e.target.checked})}/> Show navigation labels</label>
    <div className="appearance-preview" style={{borderColor:draft.accent,fontSize:draft.fontSize,borderRadius:draft.corners==='soft'?8:0,background:draft.theme==='light'?'#f8f8f8':'#242424',color:draft.theme==='light'?'#222':'#eee'}}><strong>{draft.displayName || 'My workspace'}</strong><p>Appearance draft preview</p><code style={{color:draft.accent,fontFamily:draft.codeFont==='consolas'?'Consolas, monospace':'monospace'}}>GET /preview · 200 OK</code></div>
    <label>Save appearance as<input maxLength={32} value={name} onChange={e=>setName(e.target.value)} placeholder="My style"/></label><button onClick={save}>Save appearance profile</button>
    {profiles.map(p=><div className="appearance-profile" key={p.name}><strong>{p.name}</strong><button aria-label={`Use style ${p.name}`} onClick={()=>onChange(p.style)}>Use</button><button aria-label={`Remove style ${p.name}`} onClick={()=>store(profiles.filter(v=>v.name!==p.name))}>Remove style</button></div>)}
    {message&&<p role="status">{message}</p>}
  </section>;
}
