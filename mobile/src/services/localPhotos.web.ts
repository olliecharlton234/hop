/* Web: photo files go into IndexedDB (not localStorage, which is tiny and would slow every
   save). The album keeps an "idb:<key>" reference; screens resolve it to a blob URL.
   V7: Supabase Storage replaces this, and the album keeps a storage path instead. */
import { useEffect, useState } from 'react';

const DB = 'hop-photos', STORE = 'files';
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const urls = new Map<string, string>();

export const localPhotos = {
  async save(uri: string, name: string): Promise<string> {
    try {
      const blob = await (await fetch(uri)).blob();
      const d = await db();
      await new Promise<void>((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, name); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      urls.set(`idb:${name}`, URL.createObjectURL(blob));
      return `idb:${name}`;
    } catch {
      return uri; // private mode / storage blocked: keep for this visit only
    }
  },
  peek(uri: string): string { return uri.startsWith('idb:') ? urls.get(uri) || '' : uri; },
  async resolve(uri: string): Promise<string> {
    if (!uri.startsWith('idb:')) return uri;
    const hit = urls.get(uri); if (hit) return hit;
    try {
      const d = await db();
      const blob = await new Promise<Blob | undefined>((res, rej) => { const r = d.transaction(STORE).objectStore(STORE).get(uri.slice(4)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (!blob) return '';
      const u = URL.createObjectURL(blob); urls.set(uri, u); return u;
    } catch { return ''; }
  },
};
export function useLocalPhotoUri(uri: string): string {
  const [u, setU] = useState(() => localPhotos.peek(uri));
  useEffect(() => {
    if (!uri.startsWith('idb:')) { setU(uri); return; }
    let live = true;
    const now = localPhotos.peek(uri);
    if (now) setU(now); else localPhotos.resolve(uri).then((x) => { if (live) setU(x); });
    return () => { live = false; };
  }, [uri]);
  return u;
}
