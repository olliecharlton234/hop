/* Web app install (PWA) helpers. All no-ops on native. */
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
let deferred: any = null; // Chrome/Edge/Samsung: the browser's own install prompt, saved for when we ask
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

if (web) {
  window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export const pwa = {
  isWeb: web,
  /** Opened from the Home Screen (no browser bars) */
  standalone: () => web && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true),
  isIOS: () => web && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)),
  isMobile: () => web && (pwa.isIOS() || /Android|Mobile/i.test(navigator.userAgent)),
  canPrompt: () => !!deferred,
  /** Android/Chrome install flow. Returns true if the person installed. */
  async prompt(): Promise<boolean> {
    if (!deferred) return false;
    const e = deferred; deferred = null; emit();
    try { e.prompt(); const r = await e.userChoice; return r?.outcome === 'accepted'; } catch { return false; }
  },
  /** Can we offer "Add to Home Screen" here at all? */
  installable: () => web && !pwa.standalone() && (pwa.isIOS() || !!deferred),
};
export function useInstallable() {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => pwa.installable(), () => false);
}

/** Register the service worker (production web only). Network-first for the app, so a new
    deploy reaches people on their next open; hashed assets are cached for speed. */
export function registerServiceWorker() {
  if (!web || __DEV__ || !('serviceWorker' in navigator)) return;
  const go = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
  if (document.readyState === 'complete') setTimeout(go, 1500); else window.addEventListener('load', () => setTimeout(go, 1500));
}

/** Fade out the HTML loading screen once the app has painted (web) */
export function hideBootScreen() {
  if (!web) return;
  const el = document.getElementById('hop-boot'); if (!el) return;
  requestAnimationFrame(() => { el.classList.add('done'); setTimeout(() => el.remove(), 300); });
}
