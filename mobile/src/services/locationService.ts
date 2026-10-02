/* Location. Foreground only, on request, one fix at a time — no continuous tracking.
   HOP works fully without permission: it falls back to the demo location (Surry Hills).
   Outside inner Sydney the demo data has nothing near you, so the demo location is kept. */
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

export const locationService = {
  /** The location HOP uses for "near you", distances and crowd-report checks */
  current(): LatLng { return status.mode === 'device' && status.fix ? status.fix : DEMO_LOCATION; },
  status: () => status,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  useDemo() { set({ mode: 'demo', note: '' }); },
  /** Ask (only when the user taps something that needs it), then take one fix. */
  async locate(): Promise<{ ok: boolean; message: string }> {
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
