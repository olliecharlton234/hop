/* App-level navigation actions, so components never hard-code routes. */
import { router } from 'expo-router';
import { panel, setUi, getUi } from '@/store/uiStore';
import { outingService } from '@/services/outingService';

let onMapHome = false;
export const setOnMapHome = (v: boolean) => { onMapHome = v; };
/** Venue/event sheets: on the map they replace the sheet; elsewhere they open as a modal sheet */
let modalOpener: { venue: (id: string) => void; event: (id: string) => void } | null = null;
export const registerDetailModals = (m: typeof modalOpener) => { modalOpener = m; };

export const go = {
  venue(id: string) {
    if (getUi().picking) { router.navigate({ pathname: '/outings/pick', params: { id: getUi().picking!, venue: id } }); return; }
    if (onMapHome) panel.push({ kind: 'venue', id }); else modalOpener?.venue(id);
  },
  venueOnMap(id: string) { panel.push({ kind: 'venue', id }); router.navigate('/'); },
  event(id: string) { if (onMapHome) panel.push({ kind: 'event', id }); else modalOpener?.event(id); },
  area(id: string) { panel.push({ kind: 'area', id }); if (!onMapHome) router.navigate('/'); },
  whatson(when?: 'tonight' | 'tomorrow' | 'weekend') { setUi({ lens: 'events', ...(when ? { evWhen: when } : {}), evGroup: null }); panel.reset(); panel.push({ kind: 'whatson' }); if (!onMapHome) router.navigate('/'); },
  outing(id: string, tab?: 'plan' | 'chat' | 'photos') {
    const o = outingService.get(id); if (!o) return;
    router.push({ pathname: '/outings/[id]', params: tab ? { id, tab } : { id } });
  },
  chat(id: string) { go.outing(id, 'chat'); },
  album(id: string) { router.push({ pathname: '/album/[id]', params: { id } }); },
  camera(id: string) { router.push({ pathname: '/camera', params: { id } }); },
  photo(params: { outing?: string; venue?: string; id: string }) { router.push({ pathname: '/photo', params: params as any }); },
  create(params: Record<string, string> = {}) { router.push({ pathname: '/outings/create', params: { fresh: '1', ...params } }); },
  pick(outingId: string) { setUi({ picking: outingId }); router.push({ pathname: '/outings/pick', params: { id: outingId } }); },
  home() { panel.reset(); router.navigate('/'); },
};
