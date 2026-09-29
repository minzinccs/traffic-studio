import { UiText } from '../localization';
import { useState } from 'react';
type Annotation = { note:string; tags:string; folder:string };
const key='traffic-studio-flow-annotations-v1';
export function readAnnotations():Record<string,Annotation>{try{return JSON.parse(localStorage.getItem(key)??'{}');}catch{return{};}}
export function FlowAnnotations({ id, source }: { id:number;source:string }){
  const recordKey=`${source}:${id}`;
  const [value,setValue]=useState(()=>readAnnotations()[recordKey]??{note:'',tags:'',folder:''});
  function update(patch:Partial<Annotation>){const next={...value,...patch};setValue(next);localStorage.setItem(key,JSON.stringify({...readAnnotations(),[recordKey]:next}));window.dispatchEvent(new Event('traffic-studio-annotations-change'));}
  return <div className="flow-annotations"><div className="detail-label section-gap">LOCAL ANNOTATIONS</div><label>Bookmark folder<input aria-label="Flow bookmark folder" value={value.folder} placeholder="e.g. Authentication" onChange={e=>update({folder:e.target.value})}/></label><label><UiText text={"Tags"}/><input aria-label="Flow tags" value={value.tags} onChange={e=>update({tags:e.target.value})}/></label><label><UiText text={"Comment"}/><textarea aria-label="Flow comment" value={value.note} onChange={e=>update({note:e.target.value})}/></label><p>Metadata stays in this browser and does not alter traffic.</p></div>;
}
