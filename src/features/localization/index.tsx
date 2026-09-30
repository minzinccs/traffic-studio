import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { vietnamese } from './vi';
import { SelectField } from '../../shell/SelectField';
export type Locale = 'en' | 'vi';
const key='traffic-studio-locale-v1';
const Context=createContext<{locale:Locale;setLocale:(locale:Locale)=>void}>({locale:'en',setLocale:()=>{}});
function readLocale():Locale {try{return localStorage.getItem(key)==='vi'?'vi':'en';}catch{return'en';}}
export function LocaleRoot({children}:{children:ReactNode}) {
  const [locale,setLocale]=useState<Locale>(readLocale);
  const [error,setError]=useState('');
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  function change(next:Locale){try{localStorage.setItem(key,next);setError('');}catch{setError('Language is changed for this session; browser storage is unavailable.');}setLocale(next);}
  return <Context.Provider value={{locale,setLocale:change}}>{children}{error&&<div role="status" className="locale-storage-error">{error}</div>}</Context.Provider>;
}
export function useUiTranslation(){const {locale}=useContext(Context);const tag=locale==='vi'?'vi-VN':'en-US';return {locale,translate:(text:string)=>locale==='vi'?(vietnamese[text]??text):text,number:(value:number,options?:Intl.NumberFormatOptions)=>new Intl.NumberFormat(tag,options).format(value),date:(value:Date|number,options?:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(tag,options).format(value)};}
export function UiText({text}:{text:string}){return useUiTranslation().translate(text);}
export function LocalePicker(){const {locale,setLocale}=useContext(Context);return <label>Language / Ngôn ngữ<SelectField label="Interface language" value={locale} options={[{value:'en',label:'English'},{value:'vi',label:'Tiếng Việt'}]} onChange={value=>setLocale(value as Locale)} /><small>Applies immediately / Áp dụng ngay</small></label>;}
