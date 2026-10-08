/* Location. Foreground only, on request, one fix at a time — no continuous tracking.
   HOP works fully without permission: it falls back to the demo location (Surry Hills).
   Outside inner Sydney the demo data has nothing near you, so the demo location is kept. */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { metres } from '@/utils/format';
import type { LatLng } from '@/types/models';

export const DEMO_LOCATION: LatLng = { lat: -33.8846, lng: 151.2116 }; // Surry Hills
const SYDNEY = { lat: -33.8728, lng: 151.2048 };
export type LocationMode = 'demo' | 'device';
type Status = { mode: LocationMode; fix: LatLng | null; permission: 'unknown' | 'granted' | 'denied'; note: string };
let status: Status = { mode: 'demo', fix: null, permission: 'unknown', note: '' };
const listeners = new Set<() => void>();
const set = (p: Partial<Status>) => { status = { ...status, ...p }; listeners.forEach((l) => l()); };

/** Web: the browser's own geolocation prompt, once. If it was refused, don't ask again. */
function locateWeb(): Promise<{ ok: boolean; message: string }> {
  const off = { ok: false, message: 'Location is off for HOP in this browser, so it’s using a demo spot in Surry Hills. You can allow it in your browser’s site settings.' };
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve({ ok: false, message: 'This browser can’t share your location. Using the demo spot in Surry Hills.' });
  if (status.permission === 'denied') return Promise.resolve(off);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (metres(fix, SYDNEY) > 30000) { set({ permission: 'granted', fix, mode: 'demo', note: 'outside' }); resolve({ ok: false, message: 'You’re outside inner Sydney, where the demo data is. Showing Surry Hills instead.' }); return; }
      set({ permission: 'granted', fix, mode: 'device', note: '' }); resolve({ ok: true, message: '' });
    }, (err) => {
      if (err.code === 1) { set({ permission: 'denied', mode: 'demo' }); resolve(off); return; }
      set({ mode: 'demo' }); resolve({ ok: false, message: 'Couldn’t get your location. Using the demo spot in Surry Hills.' });
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  });
}

export const locationService = {
  /** The location HOP uses for "near you", distances and crowd-report checks */
  current(): LatLng { return status.mode === 'device' && status.fix ? status.fix : DEMO_LOCATION; },
  status: () => status,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  useDemo() { set({ mode: 'demo', note: '' }); },
  /** Ask (only when the user taps something that needs it), then take one fix. */
  async locate(): Promise<{ ok: boolean; message: string }> {
    if (Platform.OS === 'web') return locateWeb();
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        set({ permission: 'denied', mode: 'demo' });
        return { ok: false, message: 'Location is off. HOP is using a demo spot in Surry Hills. You can turn it on in Settings.' };
      }
      set({ permission: 'granted' });
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (metres(fix, SYDNEY) > 30000) {
        set({ fix, mode: 'demo', note: 'outside' });
        return { ok: false, message: 'You’re outside inner Sydney, where the demo data is. Showing Surry Hills instead.' };
      }
      set({ fix, mode: 'device', note: '' });
      return { ok: true, message: '' };
    } catch {
      set({ mode: 'demo' });
      return { ok: false, message: 'Couldn’t get your location. Using the demo spot in Surry Hills.' };
    }
  },
};
