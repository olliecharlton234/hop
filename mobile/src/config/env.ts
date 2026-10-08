/* Build-time configuration.
   Only EXPO_PUBLIC_* values reach the app, and they are PUBLIC: they end up in the JavaScript
   that every visitor downloads. Never put a secret here (no service-role keys, no API secrets).
   Each value must be read as a literal `process.env.EXPO_PUBLIC_X` so Expo can inline it. */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

const clean = (v?: string) => (v && v.trim() ? v.trim().replace(/\/+$/, '') : undefined);

export const env = {
  /** Public base URL for shared links, e.g. https://hop-beta.vercel.app or https://gethop.app.
      On web the current origin is used when this is not set, so previews and custom domains just work. */
  appUrl: clean(process.env.EXPO_PUBLIC_APP_URL),
  /** Map tiles for the web map (public, browser-safe). Defaults to Esri's keyless dark basemap. */
  mapTiles: clean(process.env.EXPO_PUBLIC_MAP_TILE_URL),
  mapLabels: clean(process.env.EXPO_PUBLIC_MAP_LABELS_URL),
  mapAttribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION?.trim(),
  /** Analytics (optional). PostHog project API key is a public, write-only key. */
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim(),
  posthogHost: clean(process.env.EXPO_PUBLIC_POSTHOG_HOST) || 'https://eu.i.posthog.com',
  /** Feedback: a form URL (Tally, Google Forms…) and/or an email address. */
  feedbackUrl: clean(process.env.EXPO_PUBLIC_FEEDBACK_URL),
  feedbackEmail: process.env.EXPO_PUBLIC_FEEDBACK_EMAIL?.trim(),
  /** V7: Supabase project URL + anon key are public by design (row-level security protects data). */
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  /** Shown in Profile / feedback */
  version: '0.6.1',
  channel: 'beta' as const,
};

/** Absolute URL for a path inside HOP, for sharing. */
export function appLink(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (env.appUrl) return env.appUrl + p;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin + p;
  return Linking.createURL(p.slice(1)); // native without a public URL configured: hop://…
}
/** "hop-beta.vercel.app/outing/o_x" (no protocol, no query) for display */
export function displayLink(path: string): string {
  return appLink(path).replace(/^[a-z]+:\/\//, '').replace(/\?.*$/, '');
}
