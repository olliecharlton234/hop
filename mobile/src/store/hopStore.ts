/* HOP local state container.
   Holds the demo database (today) and acts as the local cache for Supabase (V7).
   - persisted to AsyncStorage (debounced)
   - components subscribe with useHop(selector): they re-render only when their selected
     value changes, so a chat message doesn't re-render the map */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { CrowdReport, HopEvent, Message, Outing, OutingMember, OutingStop, Photo, PublicPhoto, SavedCollection, ChatPref } from '@/types/models';
import { clock, demoOffset, now } from '@/utils/clock';

export interface Presence { userId: string; venueId: string | null; eventId: string | null; since: number }
export interface HopState {
  v: number;
  clockOffset: number;
  realtime: boolean;
  outings: Outing[];
  attendees: OutingMember[];
  stops: OutingStop[];
  photos: Photo[];
  presence: Presence[];
  messages: Message[];
  reads: Record<string, Record<string, number>>;
  events: HopEvent[];
  reports: CrowdReport[];
  venuePhotos: PublicPhoto[];
  collections: Record<string, SavedCollection[]>;
  chatPrefs: Record<string, Record<string, ChatPref>>;
  recentSearches: string[];
  /** people from invite links who aren't in the demo friend list */
  guests?: import('@/types/models').User[];
}

const KEY = 'hop.state.v6.native';
const SCHEMA = 6;
let state: HopState | null = null;
let version = 0;
const listeners = new Set<() => void>();
const typed = new Set<(type: string, payload: any) => void>();
let factory: ((now: number) => Omit<HopState, 'v' | 'clockOffset' | 'realtime'>) | null = null;

export const hop = {
  get state(): HopState { if (!state) throw new Error('HOP store not loaded'); return state; },
  get ready() { return !!state; },
  get version() { return version; },
};

/** Register how a fresh demo database is built (data/demo/repository.ts) */
export function setFactory(f: typeof factory) { factory = f; }

function fresh(realtime = false): HopState {
  const offset = realtime ? 0 : demoOffset();
  clock.set(offset);
  clock.setRealtime(realtime);
  return { v: SCHEMA, clockOffset: offset, realtime, ...factory!(now()) };
}

export async function loadStore() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as HopState;
      if (s.v === SCHEMA) { state = s; clock.set(s.clockOffset); clock.setRealtime(!!s.realtime); bump(); return; }
    }
  } catch { /* storage unavailable: run in memory */ }
  state = fresh();
  persist();
  bump();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (state) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }, 400);
}

function bump() { version++; listeners.forEach((l) => l()); }

/** Every mutation ends with commit(): persist, notify subscribers, emit a typed event. */
export function commit(type: string, payload: any = {}) {
  persist();
  bump();
  typed.forEach((fn) => fn(type, payload));
}
/** Re-evaluate time-based values (e.g. "4m ago", "Busy now") without changing data */
export function tick() { bump(); }
export function onEvent(fn: (type: string, payload: any) => void) { typed.add(fn); return () => { typed.delete(fn); }; }

export async function resetStore(realtime = clock.realtime) {
  state = fresh(realtime);
  persist();
  commit('reset');
}

// ---- subscriptions -------------------------------------------------------------
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const getVersion = () => version;
export function useHopVersion() { return useSyncExternalStore(subscribe, getVersion, getVersion); }

export function shallowEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}
/** JSON-ish deep equality for small derived values (labels, id lists) */
export const deepEqual = (a: any, b: any) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/** Subscribe to a derived value. Re-renders only when the selector's result changes. */
export function useHop<T>(selector: () => T, deps: unknown[] = [], eq: (a: T, b: T) => boolean = shallowEqual): T {
  const cache = useRef<{ v: number; key: string; val: T } | null>(null);
  const key = JSON.stringify(deps);
  const sel = useRef(selector);
  sel.current = selector;
  const getSnap = useCallback(() => {
    const c = cache.current;
    if (c && c.v === version && c.key === key) return c.val;
    const val = state ? sel.current() : (undefined as T);
    if (c && c.key === key && eq(c.val, val)) { c.v = version; return c.val; }
    cache.current = { v: version, key, val };
    return val;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}
