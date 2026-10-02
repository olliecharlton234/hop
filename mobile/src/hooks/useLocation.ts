import { useSyncExternalStore } from 'react';
import { locationService } from '@/services/locationService';
/** Current location HOP uses (demo spot until the user taps locate and allows it) */
export function useLocation() {
  return useSyncExternalStore(locationService.subscribe, locationService.status, locationService.status);
}
export const here = () => locationService.current();
