/* Small UI state shared across screens (not part of the data model): map lens, heat layer,
   time window, what the map sheet shows, picking stops. Persisted per device where useful. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { TimeWindow } from '@/types/models';

export type Lens = 'tonight' | 'friends' | 'places' | 'events';
export type Panel =
  | { kind: 'tonight' }
  | { kind: 'search' }
  | { kind: 'venue'; id: string; stopId?: string }
  | { kind: 'event'; id: string }
  | { kind: 'area'; id: string }
  | { kind: 'whatson' };

export interface UiState {
  heatOn: boolean;
  heatWindow: TimeWindow;
  legend: boolean;
  lens: Lens;
  lensSub: { friends: 'out' | 'outings' | 'recent'; places: 'all' | 'pub' | 'bar' | 'club' | 'food' | 'late' };
  panels: Panel[]; // stack: last is shown
  picking: string | null; // outing id while adding stops
  evWhen: 'tonight' | 'tomorrow' | 'weekend';
  evGroup: string | null;
  previewHour: number | null; // prototype: preview Home at another time of day
  query: string;
}
let ui: UiState = {
  heatOn: true, heatWindow: 'now', legend: true, lens: 'tonight', lensSub: { friends: 'out', places: 'all' },
  panels: [{ kind: 'tonight' }], picking: null, evWhen: 'tonight', evGroup: null, previewHour: null, query: '',
};
const subs = new Set<() => void>();
const KEY = 'hop.ui.v1';
export function setUi(patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) {
  const p = typeof patch === 'function' ? patch(ui) : patch;
  ui = { ...ui, ...p };
  subs.forEach((s) => s());
  if ('heatOn' in p || 'legend' in p) AsyncStorage.setItem(KEY, JSON.stringify({ heatOn: ui.heatOn, legend: ui.legend })).catch(() => {});
}
export const getUi = () => ui;
export async function loadUi() {
  try { const raw = await AsyncStorage.getItem(KEY); if (raw) setUi(JSON.parse(raw)); } catch { /* ignore */ }
}
export function useUi<T>(sel: (u: UiState) => T): T {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => sel(ui), () => sel(ui));
}

// ---- the map sheet's panel stack -------------------------------------------------
export const panel = {
  push(p: Panel) { setUi((u) => ({ panels: [...u.panels.filter((x) => !(x.kind === p.kind && x.kind !== 'tonight')), p] })); },
  replaceTop(p: Panel) { setUi((u) => ({ panels: [...u.panels.slice(0, -1), p] })); },
  back() { setUi((u) => ({ panels: u.panels.length > 1 ? u.panels.slice(0, -1) : u.panels })); },
  reset() { setUi({ panels: [{ kind: 'tonight' }] }); },
  top: () => ui.panels[ui.panels.length - 1],
};
