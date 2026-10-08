/* Small per-device flags: has this person seen onboarding, dismissed the Home Screen tip,
   their anonymous analytics id, how many times they've opened HOP. Not part of the data model. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface Prefs {
  onboarded: boolean;
  installTipDone: boolean;
  anonId: string;
  opens: number;
  firstOpenAt: number;
}
const KEY = 'hop.prefs.v1';
let prefs: Prefs = { onboarded: false, installTipDone: false, anonId: '', opens: 0, firstOpenAt: 0 };
const subs = new Set<() => void>();

const rid = () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('');

export async function loadPrefs() {
  try { const raw = await AsyncStorage.getItem(KEY); if (raw) prefs = { ...prefs, ...JSON.parse(raw) }; } catch { /* storage blocked: in memory */ }
  setPrefs({ anonId: prefs.anonId || rid(), opens: prefs.opens + 1, firstOpenAt: prefs.firstOpenAt || Date.now() });
  return prefs;
}
export const getPrefs = () => prefs;
export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  subs.forEach((s) => s());
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}
export function usePrefs<T>(sel: (p: Prefs) => T): T {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => sel(prefs), () => sel(prefs));
}
