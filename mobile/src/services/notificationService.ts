/* In-app notifications (banners + toasts). V6 keeps them in-app; V7 adds Expo Notifications
   for push, with the same batching and the same All / Mentions / Mute rules. */
import type { HopNotification } from '@/types/models';
import { uid } from '@/utils/format';
import { now } from '@/utils/clock';

export type Banner = HopNotification & { lead?: { kind: 'avatar'; userId: string } | { kind: 'photos'; photoIds: string[] } | { kind: 'live' } | { kind: 'icon'; name: string }; action?: { type: 'openChat' | 'openAlbum' | 'openOuting'; outingId: string } };
type Toast = { id: string; text: string };
let banners: Banner[] = [];
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const notificationService = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  banners: () => banners,
  toasts: () => toasts,
  banner(b: Omit<Banner, 'id' | 'at'>, timeout = 4200) {
    const item = { ...b, id: uid('n'), at: now() } as Banner;
    banners = [...banners.slice(-1), item];
    emit();
    setTimeout(() => notificationService.dismiss(item.id), timeout);
  },
  dismiss(id: string) { banners = banners.filter((b) => b.id !== id); emit(); },
  toast(text: string) {
    const t = { id: uid('t'), text };
    toasts = [t];
    emit();
    setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, 2600);
  },
};
export const toast = (t: string) => notificationService.toast(t);
