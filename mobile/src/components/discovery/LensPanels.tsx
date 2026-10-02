/* FRIENDS and PLACES map modes (sheet content), and EVENTS = What's on */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Empty, Section } from '@/components/ui/Layout';
import { EventRow, VenueRow } from './rows';
import { FriendsSection, PlansSection, RecentFromFriends } from './TonightPanel';
import { useHop, deepEqual } from '@/store/hopStore';
import { useUi } from '@/store/uiStore';
import { friendService } from '@/services/friendService';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { locationService } from '@/services/locationService';
import { go } from '@/utils/nav';
import { longDate, metres } from '@/utils/format';

const Head = ({ title, sub }: { title: string; sub: string }) => (
  <View style={st.head}><Text style={st.label}><Text style={{ color: C.accent }}>{title.toUpperCase()}</Text> · {sub.toUpperCase()}</Text></View>
);

export const FriendsLens = memo(function FriendsLens() {
  const sub = useUi((u) => u.lensSub.friends);
  const d = useHop(() => ({ n: friendService.out().length, outings: outingService.tonight().map((o) => o.id) }), [], deepEqual);
  return (
    <View testID="lens-friends">
      <Head title="Friends" sub={`${d.n} out now`} />
      {sub === 'outings' ? (d.outings.length ? <PlansSection ids={d.outings} title="Outings tonight" /> : <Empty>No outings you can see tonight yet.</Empty>)
        : sub === 'recent' ? <RecentFromFriends title="Photos" maxAge={6 * 36e5} />
        : d.n ? <FriendsSection title="Where they are" limit={12} /> : <Empty>None of your friends are sharing where they are right now.</Empty>}
      <Text style={st.src}>Only friends who share where they are, or who are on an outing you can see. Sharing is always opt-in.</Text>
    </View>
  );
});

export const PlacesLens = memo(function PlacesLens() {
  const sub = useUi((u) => u.lensSub.places);
  const d = useHop(() => {
    const me = locationService.current();
    const list = venueService.all().filter((v) => v.cat !== 'spot' && (sub === 'all' || v.cat === sub || (sub === 'bar' && v.cat === 'gig') || (sub === 'late' && venueService.isLate(v))))
      .map((v) => ({ v, a: venueService.activity(v.id), dd: metres(me, v) })).sort((x, y) => (y.a.busy - y.dd / 4000) - (x.a.busy - x.dd / 4000));
    return { hot: list.filter((x) => x.a.hot).length, top: list.slice(0, 6).map((x) => x.v.id), more: list.slice(6, 20).sort((x, y) => x.dd - y.dd).map((x) => x.v.id) };
  }, [sub], deepEqual);
  return (
    <View testID="lens-places">
      <Head title="Places" sub={`${d.hot} busy now`} />
      <Section title="Popular now" style={{ paddingTop: 8 }}>{d.top.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={go.venue} />)}</Section>
      {d.more.length ? <Section title="More nearby">{d.more.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={go.venue} />)}</Section> : null}
    </View>
  );
});

export function whatsOnList(when: 'tonight' | 'tomorrow' | 'weekend', group: string | null) { return eventService.filter({ when, group }); }
export const WhatsOnPanel = memo(function WhatsOnPanel() {
  const when = useUi((u) => u.evWhen);
  const group = useUi((u) => u.evGroup);
  const q = useUi((u) => u.query).trim().toLowerCase();
  const d = useHop(() => {
    let l = q ? eventService.filter({ when: 'any', group }) : eventService.filter({ when, group });
    if (q) l = l.filter((e) => (e.title + ' ' + e.genre + ' ' + (eventService.placeOf(e)?.name || '') + ' ' + (eventService.placeOf(e)?.suburb || '')).toLowerCase().includes(q));
    const days: [number, string[]][] = [];
    l.forEach((e) => { const k = eventService.dayKey(e.startsAt); const g = days.find((x) => x[0] === k); if (g) g[1].push(e.id); else days.push([k, [e.id]]); });
    return { n: l.length, ids: l.map((e) => e.id), days };
  }, [when, group, q], deepEqual);
  const head = q ? `Events matching “${q}”` : ({ tonight: 'What’s on tonight', tomorrow: 'What’s on tomorrow', weekend: 'This weekend' } as const)[when];
  return (
    <View testID="whatson">
      <View style={[st.head, { justifyContent: 'space-between' }]}><Text style={st.h2}>{head}</Text><Text style={st.mono}>{d.n} {d.n === 1 ? 'event' : 'events'}</Text></View>
      {!d.n ? <Empty>Nothing {group ? group + ' ' : ''}on {when === 'weekend' ? 'this weekend' : when}. Try another filter.</Empty>
        : when === 'weekend' && !q ? d.days.map(([k, ids]) => <Section key={k} title={longDate(k)}>{ids.map((id, i) => <EventRow key={id} id={id} first={i === 0} onPress={go.event} />)}</Section>)
        : <View style={{ marginTop: 6 }}>{d.ids.map((id, i) => <EventRow key={id} id={id} first={i === 0} onPress={go.event} />)}</View>}
      <Text style={st.src}>Listings come from venues and What’s On Sydney. Venues can post their own soon.</Text>
    </View>
  );
});

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', height: 30 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3 },
  h2: { fontFamily: F.display, fontSize: 21, color: C.text },
  mono: { fontFamily: F.mono, fontSize: 12.5, color: C.text3 },
  src: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 20, lineHeight: 17 },
});
