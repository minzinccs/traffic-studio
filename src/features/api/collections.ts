export type ApiProfile = { id: string; name: string; method: string; url: string; headers: { key: string; value: string }[]; body: string; notes: string };
export type ApiCollection = { id: string; name: string; profiles: ApiProfile[] };
export const collectionsKey = 'traffic-studio-api-collections-v1';

export function readCollections(): ApiCollection[] {
  try {
    const value = JSON.parse(localStorage.getItem(collectionsKey) ?? 'null') as ApiCollection[] | null;
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeCollections(collections: ApiCollection[]) {
  localStorage.setItem(collectionsKey, JSON.stringify(collections));
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
