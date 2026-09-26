export type ApiProfile = { id: string; name: string; method: string; url: string; headers: { key: string; value: string }[]; body: string; notes: string };
export type ApiCollection = { id: string; name: string; profiles: ApiProfile[]; parentId?: string | null };
export const collectionsKey = 'traffic-studio-api-collections-v1';

export function readCollections(): ApiCollection[] {
  try {
    if (!localStorage.getItem('traffic-studio-explorer-migrated-v1')) {
      const existing = JSON.parse(localStorage.getItem(collectionsKey) ?? '[]') as ApiCollection[];
      const legacy = JSON.parse(localStorage.getItem('traffic-studio-explorer-v1') ?? '[]') as {id:string;name:string;kind:string}[];
      const saved = JSON.parse(localStorage.getItem('traffic-studio-api-requests') ?? '[]') as ApiProfile[];
      const profiles = Array.isArray(legacy) ? legacy.filter(n=>n.kind==='request').map(n=>{const old=Array.isArray(saved)?saved.find(p=>p.name===n.name):undefined;return {id:n.id,name:n.name,method:old?.method??'GET',url:old?.url??'',headers:(old?.headers??[]).filter(h=>!/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key)),body:old?.body??'',notes:old?.notes??''};}) : [];
      if(profiles.length) localStorage.setItem(collectionsKey,JSON.stringify([...(Array.isArray(existing)?existing:[]),{id:'migrated-explorer',name:'Imported Explorer requests',profiles}]));
      localStorage.setItem('traffic-studio-explorer-migrated-v1','true');
    }
    const value = JSON.parse(localStorage.getItem(collectionsKey) ?? 'null') as ApiCollection[] | null;
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeCollections(collections: ApiCollection[]) {
  localStorage.setItem(collectionsKey, JSON.stringify(collections.map(c=>({...c,profiles:c.profiles.map(p=>({...p,headers:p.headers.filter(h=>!/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(h.key.trim()))}))}))));
  window.dispatchEvent(new Event('traffic-studio-collections-change'));
}

export function readProfile(id: string): ApiProfile | undefined {
  return readCollections().flatMap((collection) => collection.profiles).find((profile) => profile.id === id);
}

export function updateProfile(id: string, changes: Omit<ApiProfile, 'id'>): boolean {
  const collections = readCollections();
  if (!collections.some((collection) => collection.profiles.some((profile) => profile.id === id))) return false;
  writeCollections(collections.map((collection) => ({ ...collection, profiles: collection.profiles.map((profile) => profile.id === id ? { id, ...changes } : profile) })));
  return true;
}
