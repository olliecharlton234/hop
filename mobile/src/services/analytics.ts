/* Product analytics for the beta: a tiny, swappable layer.
   - Screens call analytics.track('venue_opened', {...}). Nothing else knows the provider.
   - Default provider: none (events are only logged in development).
   - If EXPO_PUBLIC_POSTHOG_KEY is set: PostHog over plain HTTP (no SDK, no autocapture,
     anonymous events, no person profiles). Swap `remote` for Plausible/Amplitude later.
   - Respects Do Not Track / Global Privacy Control on web.
   Never send names, messages, photos, exact locations or invite links. Ids and counts only. */
import { Platform } from 'react-native';
import { env } from '@/config/env';
import { getPrefs } from '@/store/prefs';

export type AnalyticsEvent =
  | 'app_opened'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'outing_created'
  | 'outing_joined'
  | 'invite_shared'
  | 'invite_opened'
  | 'venue_opened'
  | 'event_opened'
  | 'heatmap_enabled'
  | 'where_next_opened'
  | 'photo_added'
  | 'photo_shared_public'
  | 'memory_opened'
  | 'saved_place_added'
  | 'install_prompt_shown'
  | 'install_accepted'
  | 'feedback_opened';

type Props = Record<string, string | number | boolean | null | undefined>;
interface Provider { send(batch: { event: string; props: Props; at: string }[]): void }

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const optedOut = () => isWeb && ((navigator as any).globalPrivacyControl === true || navigator.doNotTrack === '1');
const standalone = () => isWeb && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

const posthog: Provider | null = env.posthogKey ? {
  send(batch) {
    const body = JSON.stringify({
      api_key: env.posthogKey,
      batch: batch.map((e) => ({ event: e.event, timestamp: e.at, distinct_id: getPrefs().anonId || 'anon', properties: { ...e.props, $process_person_profile: false, $lib: 'hop-http' } })),
    });
    fetch(`${env.posthogHost}/batch/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  },
} : null;

let queue: { event: string; props: Props; at: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>();

function flush() {
  timer = null;
  if (!queue.length) return;
  const b = queue; queue = [];
  posthog?.send(b);
}

export const analytics = {
  track(event: AnalyticsEvent, props: Props = {}) {
    const p: Props = { ...props, platform: Platform.OS, app_version: env.version, channel: env.channel, ...(isWeb ? { standalone: standalone() } : {}) };
    if (__DEV__) console.log('[analytics]', event, props); // eslint-disable-line no-console
    if (!posthog || optedOut()) return;
    queue.push({ event, props: p, at: new Date().toISOString() });
    if (!timer) timer = setTimeout(flush, 4000);
  },
  /** Track once per app session (e.g. "where_next_opened" for an outing) */
  once(key: string, event: AnalyticsEvent, props?: Props) { if (seen.has(key)) return; seen.add(key); analytics.track(event, props); },
  flush,
  enabled: () => !!posthog && !optedOut(),
};

if (isWeb) window.addEventListener('pagehide', flush);

/** Data events → analytics, in one place (the store emits a typed event for every change) */
export function wireStoreAnalytics(onEvent: (fn: (type: string, p: any) => void) => () => void, meId: () => string, isOrganiser: (outingId: string) => boolean) {
  return onEvent((type, p) => {
    if (type === 'outing:create') analytics.track('outing_created', { outing: p.id });
    else if (type === 'rsvp' && p.userId === meId() && p.value === 'going' && !isOrganiser(p.outingId)) analytics.track('outing_joined', { outing: p.outingId });
    else if (type === 'photos:add' && p.userId === meId()) analytics.track('photo_added', { outing: p.outingId, count: p.count, visibility: p.visibility });
    else if (type === 'photos:public' && p.venueId) analytics.track('photo_shared_public', { venue: p.venueId });
    else if (type === 'saved' && p.on) analytics.track('saved_place_added', { kind: p.venueId ? 'venue' : 'event', id: p.venueId || p.eventId, list: p.colId });
  });
}
