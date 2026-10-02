/* Search: before typing it's discovery (popular tonight, busy areas, events starting soon,
   popular with friends, saved places, recent searches). Typing searches places, events,
   public outings and areas. */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Empty, Section } from '@/components/ui/Layout';
import { LinkButton } from '@/components/ui/Button';
import { AreaRow, EventRow, OutingRow, VenueRow } from './rows';
import { openSavedLists } from '@/components/sheets/modals';
import { useHop, deepEqual } from '@/store/hopStore';
import { setUi, useUi } from '@/store/uiStore';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { outingService } from '@/services/outingService';
import { activityService } from '@/services/activityService';
import { savedService } from '@/services/savedService';
import { searchService } from '@/services/searchService';
import { locationService } from '@/services/locationService';
import { VENUE_CAT_LABEL } from '@/data/eventCategories';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { metres } from '@/utils/format';

export const SearchPanel = memo(function SearchPanel() {
  const q = useUi((u) => u.query).trim().toLowerCase();
  const remember = () => searchService.remember(q);
  const open = { venue: (id: string) => { remember(); go.venue(id); }, event: (id: string) => { remember(); go.event(id); }, area: (id: string) => { remember(); go.area(id); }, outing: (id: string) => { remember(); go.outing(id); } };
  const d = useHop(() => {
    if (!q) {
      const t = now();
      return {
        mode: 'discover' as const,
        recent: searchService.recent(),
        popular: venueService.all().filter((v) => v.cat !== 'spot').map((v) => ({ v, a: venueService.activity(v.id) })).filter((x) => x.a.hot).sort((x, y) => y.a.busy - x.a.busy).slice(0, 4).map((x) => x.v.id),
        busy: activityService.areas().map((a) => activityService.areaInfo(a.id, 'now')).filter((x) => x.lv >= 2).sort((x, y) => y.heat - x.heat).slice(0, 3).map((x) => x.area.id),
        soon: eventService.filter({ when: 'tonight' }).filter((e) => e.endsAt > t).sort((x, y) => Math.max(x.startsAt, t) - Math.max(y.startsAt, t)).slice(0, 3).map((e) => e.id),
        friends: venueService.all().map((v) => ({ v, n: venueService.activity(v.id).friends.length })).filter((x) => x.n).sort((x, y) => y.n - x.n).slice(0, 3).map((x) => x.v.id),
        saved: savedService.venueIds().slice(0, 4),
      };
    }
    const me = locationService.current();
    const places = venueService.all().filter((v) => (v.name + ' ' + v.suburb + ' ' + VENUE_CAT_LABEL[v.cat] + ' ' + v.address).toLowerCase().includes(q)).sort((a, b) => metres(me, a) - metres(me, b)).slice(0, 8).map((v) => v.id);
    const events = eventService.upcoming().filter((e) => (e.title + ' ' + e.genre + ' ' + (eventService.placeOf(e)?.name || '')).toLowerCase().includes(q)).slice(0, 5).map((e) => e.id);
    const outings = outingService.publicOutings().filter((o) => (o.title + ' ' + outingService.stops(o.id).map((s) => outingService.stopName(s)).join(' ')).toLowerCase().includes(q)).slice(0, 3).map((o) => o.id);
    const areas = activityService.areas().filter((a) => (a.name + ' ' + a.suburbs.join(' ')).toLowerCase().includes(q)).map((a) => a.id);
    return { mode: 'results' as const, places, events, outings, areas };
  }, [q], deepEqual);

  if (d.mode === 'discover') {
    return (
      <View testID="search-discovery">
        {d.recent.length ? (
          <View style={st.recents}>
            {d.recent.map((r) => (
              <Pressable key={r} onPress={() => setUi({ query: r })} style={st.recent}><Icon name="clock" size={13} color={C.text2} /><Text style={st.recentT}>{r}</Text></Pressable>
            ))}
          </View>
        ) : null}
        {d.popular.length ? <Section title="Popular tonight" style={{ paddingTop: 10 }}>{d.popular.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={open.venue} />)}</Section> : null}
        {d.busy.length ? <Section title="Busy areas">{d.busy.map((id, i) => <AreaRow key={id} id={id} first={i === 0} withFriends={false} onPress={open.area} />)}</Section> : null}
        {d.soon.length ? <Section title="Events starting soon" right={<LinkButton title="All" onPress={() => go.whatson('tonight')} />}>{d.soon.map((id, i) => <EventRow key={id} id={id} first={i === 0} onPress={open.event} />)}</Section> : null}
        {d.friends.length ? <Section title="Popular with friends">{d.friends.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={open.venue} />)}</Section> : null}
        {d.saved.length ? <Section title="Your saved places" right={<LinkButton title="Lists" onPress={() => openSavedLists()} />}>{d.saved.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={open.venue} />)}</Section> : null}
      </View>
    );
  }
  const none = !d.places.length && !d.events.length && !d.outings.length && !d.areas.length;
  return (
    <View testID="search-results">
      {none ? <Empty>Nothing matches “{q}”. Try a suburb, a venue or a kind of night, like trivia.</Empty> : null}
      {d.places.length ? <Section title="Places" style={{ paddingTop: 10 }}>{d.places.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={open.venue} />)}</Section> : null}
      {d.events.length ? <Section title="Events">{d.events.map((id, i) => <EventRow key={id} id={id} first={i === 0} onPress={open.event} />)}</Section> : null}
      {d.outings.length ? <Section title="Public outings">{d.outings.map((id, i) => <OutingRow key={id} id={id} first={i === 0} onPress={open.outing} />)}</Section> : null}
      {d.areas.length ? <Section title="Areas">{d.areas.map((id, i) => <AreaRow key={id} id={id} first={i === 0} withFriends={false} onPress={open.area} />)}</Section> : null}
    </View>
  );
});
const st = StyleSheet.create({
  recents: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 6 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  recentT: { fontFamily: F.body, fontSize: 13, color: C.text2 },
});
