/* Planning helpers: the shape of a night built around one thing (dinner → event → drinks). */
import { eventService } from './eventService';
import { venueService } from './venueService';
import { EVENT_CATS } from '@/data/eventCategories';
import { metres } from '@/utils/format';
import type { HopEvent } from '@/types/models';

export type PlanItem = { venueId?: string; eventId?: string; at: number; role: string };
export function planAround(e: HopEvent): PlanItem[] {
  const p = eventService.placeOf(e)!;
  const near = (cats: string[], not?: string) => venueService.all().filter((v) => cats.includes(v.cat) && v.id !== not && v.id !== e.venueId)
    .map((v) => ({ v, d: metres(p, v) - venueService.pop(v.id)[0] * 300 })).sort((a, b) => a.d - b.d)[0]?.v;
  const h = new Date(e.startsAt).getHours();
  const late = h >= 21 || h < 5;
  const round = (t: number) => Math.round(t / 18e5) * 18e5;
  const dinner = near(['food']);
  const drinks = near(['bar', 'pub'], dinner?.id);
  const plan: PlanItem[] = [];
  if (dinner) plan.push({ venueId: dinner.id, at: round(e.startsAt - (late ? 3 : 2) * 36e5), role: 'Dinner' });
  if (late && drinks) plan.push({ venueId: drinks.id, at: round(e.startsAt - 1.5 * 36e5), role: 'Drinks' });
  plan.push({ eventId: e.id, at: e.startsAt, role: EVENT_CATS[e.cat].label });
  if (!late && drinks && new Date(e.endsAt).getHours() >= 5) plan.push({ venueId: drinks.id, at: round(e.endsAt), role: 'Drinks after' });
  return plan;
}
export const sameNight = (a: number, b: number) => new Date(a - 5 * 36e5).toDateString() === new Date(b - 5 * 36e5).toDateString();
