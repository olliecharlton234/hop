/* WHERE NEXT? — three nearby options during a live outing, ranked from distance, how busy it
   is now and later, events, friends there, saved places, chat "keen" votes and the route.
   Shown as plain options (not labelled AI): "6 min walk · Busy · 4 friends there". */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Section } from '@/components/ui/Layout';
import { Photo } from '@/components/ui/Photo';
import { Button } from '@/components/ui/Button';
import { LevelWord } from '@/components/ui/Level';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { activityService } from '@/services/activityService';
import { reportService } from '@/services/reportService';
import { savedService } from '@/services/savedService';
import { chatService } from '@/services/chatService';
import { toast } from '@/services/notificationService';
import { sim, isChatOpen } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { metres, startsIn } from '@/utils/format';
import { locationService } from '@/services/locationService';

export function whereNext(outingId: string, n = 3) {
  const o = outingService.get(outingId); if (!o) return [];
  const st = outingService.stops(outingId);
  const cur = o.live ? st[o.live.current] : st[st.length - 1];
  const from = cur ? outingService.placeOf(cur) : locationService.current();
  const nxt = o.live ? st[o.live.current + 1] : undefined;
  const taken = new Set(st.map((x) => x.venueId));
  const saved = new Set(savedService.venueIds());
  const keen: Record<string, number> = {};
  chatService.messages(outingId).forEach((m) => { if (m.kind === 'place' && m.place?.venueId) keen[m.place.venueId] = (keen[m.place.venueId] || 0) + (m.keen?.length || 0) + 1; });
  const t = now();
  return venueService.all().filter((v) => ['bar', 'pub', 'club', 'gig'].includes(v.cat) && !taken.has(v.id)).map((v) => {
    const d = metres(from, v);
    if (d > 2000) return null;
    const a = venueService.activity(v.id);
    const ar = activityService.areaOfVenue(v);
    const later = ar ? activityService.levelAt(ar.id, t + 60 * 6e4).heat : 0.3;
    const ev = eventService.tonightAt(v.id).find((e) => e.endsAt > t && e.startsAt - t < 120 * 6e4);
    const rep = reportService.summary(v.id);
    const towardNext = nxt ? Math.max(0, 1 - metres(v, outingService.placeOf(nxt)) / 1500) * 0.1 : 0;
    const score = a.busy * 0.45 + later * 0.2 + a.friends.length * 0.12 + (ev ? 0.15 : 0) + (saved.has(v.id) ? 0.1 : 0) + (keen[v.id] || 0) * 0.08 + towardNext
      - d / 2600 - (a.lv === 0 ? 0.25 : 0) - (rep.queue?.value === 'long' ? 0.15 : 0) - (rep.crowd?.value === 'packed' ? 0.05 : 0);
    return { id: v.id, name: v.name, img: v.img, walk: Math.max(1, Math.round(d / 80)), lv: a.lv, label: a.label, friends: a.friends.length, event: ev ? `${ev.title} · ${startsIn(ev.startsAt, ev.endsAt)}` : '', queue: rep.queue ? `Queue ${rep.queue.label.toLowerCase()}` : '', saved: saved.has(v.id), score };
  }).filter(Boolean).sort((x, y) => y!.score - x!.score).slice(0, n) as { id: string; name: string; img: any; walk: number; lv: number; label: string; friends: number; event: string; queue: string; saved: boolean; score: number }[];
}

export function addNextStop(outingId: string, venueId: string) {
  const o = outingService.get(outingId)!; const st = outingService.stops(outingId);
  const cur = st[o.live ? o.live.current : st.length - 1], nx = o.live ? st[o.live.current + 1] : undefined;
  let at = now() + 45 * 6e4;
  if (nx && cur) at = Math.max(cur.at + 6e4, Math.min(at, nx.at - 6e4));
  const s = outingService.addStop(outingId, venueId, at);
  if (s) toast(`${venueService.byId(venueId).name} is the next stop`);
}
export function voteWhereNext(outingId: string) {
  const open = chatService.messages(outingId).filter((m) => m.kind === 'poll' && !m.poll!.closed).pop();
  if (open) { toast('There’s already a vote going in the chat'); if (!isChatOpen(outingId)) go.chat(outingId); return; }
  const st = outingService.stops(outingId); const o = outingService.get(outingId)!;
  const cur = st[o.live ? o.live.current : st.length - 1];
  const opts = whereNext(outingId).map((x) => ({ venueId: x.id, votes: [] as string[] }));
  const m = chatService.post(outingId, { kind: 'poll', poll: { q: `Where after ${cur ? outingService.stopName(cur) : 'this'}?`, closed: false, options: opts } });
  sim.chatVotes(outingId, m.id);
  toast('Vote sent to the chat');
  if (!isChatOpen(outingId)) go.chat(outingId);
}

export const WhereNextSection = memo(function WhereNextSection({ outingId }: { outingId: string }) {
  const list = useHop(() => whereNext(outingId), [outingId], deepEqual);
  const org = useHop(() => outingService.isOrganiser(outingService.get(outingId)), [outingId]);
  if (!list.length) return null;
  return (
    <Section title="Where next?" testID="where-next">
      {list.map((x, i) => (
        <View key={x.id} style={[st.row, i === 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
          <Pressable style={st.main} onPress={() => go.venue(x.id)} accessibilityRole="button">
            <Photo p={{ id: x.id, u: x.img }} w={120} radius={9} style={{ width: 44, height: 44 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={st.t}>{x.name}</Text>
              <Text numberOfLines={1} style={st.s}>{x.walk} min walk · <LevelWord lv={x.lv}>{x.label}</LevelWord>{x.friends ? ` · ${x.friends} ${x.friends === 1 ? 'friend' : 'friends'} there` : ''}</Text>
              {x.event || x.queue || x.saved ? <Text numberOfLines={1} style={[st.s, { color: C.text3 }]}>{[x.event, x.queue, x.saved ? 'Saved' : ''].filter(Boolean).join(' · ')}</Text> : null}
            </View>
          </Pressable>
          <View style={{ gap: 5 }}>
            {org ? <Button testID={`wn-add-${x.id}`} sm variant="primary" title="Add stop" onPress={() => addNextStop(outingId, x.id)} style={{ minWidth: 80 }} /> : null}
            <Button testID={`wn-vote-${x.id}`} sm title="Vote" onPress={() => voteWhereNext(outingId)} style={{ minWidth: 80 }} />
          </View>
        </View>
      ))}
    </Section>
  );
});
const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  t: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  s: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 2 },
});
