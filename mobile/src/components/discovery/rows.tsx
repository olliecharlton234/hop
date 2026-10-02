/* List rows shared by Tonight, search, What's on, venue and area sheets */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Row } from '@/components/ui/Layout';
import { Photo } from '@/components/ui/Photo';
import { AvatarStack } from '@/components/ui/Avatar';
import { LevelBox, LevelWord } from '@/components/ui/Level';
import { Icon, OutingIcon } from '@/components/ui/Icon';
import { useHop, deepEqual } from '@/store/hopStore';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { friendService } from '@/services/friendService';
import { outingService } from '@/services/outingService';
import { activityService } from '@/services/activityService';
import { locationService } from '@/services/locationService';
import { distLabel, hm, metres, startsIn, when } from '@/utils/format';
import { EVENT_CATS } from '@/data/eventCategories';
import type { TimeWindow } from '@/types/models';

/** Venue: photo · name · "Busy, rising · 2 friends · Trivia · On now · 300 m" · faces or price */
export const VenueRow = memo(function VenueRow({ id, onPress, first }: { id: string; onPress: (id: string) => void; first?: boolean }) {
  const d = useHop(() => {
    const v = venueService.byId(id);
    const act = venueService.activity(id);
    const ev = eventService.tonightAt(id)[0];
    const evBit = ev ? `${ev.title.length > 20 ? EVENT_CATS[ev.cat].label : ev.title} · ${startsIn(ev.startsAt, ev.endsAt)}` : '';
    const bits = [act.friends.length ? `${act.friends.length} ${act.friends.length === 1 ? 'friend' : 'friends'}` : '', evBit, distLabel(metres(locationService.current(), v))].filter(Boolean).join(' · ');
    return { name: v.name, img: v.img, price: v.price, lv: act.lv, label: `${act.label}${act.trend === 'rising' && act.lv >= 2 ? ', rising' : ''}`, bits, friends: act.friends.map((f) => f.user.id) };
  }, [id], deepEqual);
  return (
    <Row first={first} testID={`venue-row-${id}`} onPress={() => onPress(id)}
      lead={<Photo p={{ id, u: d.img }} w={120} radius={9} style={st.thumb} />}
      title={d.name}
      sub={<Text numberOfLines={1} style={st.s}><LevelWord lv={d.lv}>{d.label}</LevelWord>{d.bits ? ` · ${d.bits}` : ''}</Text>}
      trail={d.friends.length ? <AvatarStack users={d.friends.map((u) => friendService.user(u))} max={3} size={22} /> : <Text style={st.mono}>{d.price}</Text>} />
  );
});

/** Event: time (or NOW) · title · "Starts in 25m · The Vanguard · Newtown · $25" · faces or interest */
export const EventRow = memo(function EventRow({ id, onPress, noPlace, first }: { id: string; onPress: (id: string) => void; noPlace?: boolean; first?: boolean }) {
  const d = useHop(() => {
    const e = eventService.byId(id)!;
    const p = eventService.placeOf(e);
    const fr = e.friendIds.filter((x) => x !== friendService.meId());
    const si = startsIn(e.startsAt, e.endsAt);
    return { title: e.title, on: eventService.isLive(e), t: hm(e.startsAt), soon: si.startsWith('Starts') ? si : '', where: noPlace ? e.genre : `${p?.name} · ${p?.suburb}`, price: e.priceLabel, deal: e.deal, fr, interested: e.interested };
  }, [id, noPlace], deepEqual);
  return (
    <Row first={first} testID={`event-row-${id}`} onPress={() => onPress(id)}
      lead={<Text style={[st.et, d.on && { color: C.live }]}>{d.on ? 'NOW' : d.t}</Text>}
      title={d.title}
      sub={<Text numberOfLines={1} style={st.s}>{d.soon ? <Text style={{ color: C.accent, fontFamily: F.bodySemi }}>{d.soon} · </Text> : null}{d.where} · {d.price}</Text>}
      sub2={d.deal ? <Text numberOfLines={1} style={[st.s, { color: C.accent }]}>{d.deal}</Text> : undefined}
      trail={d.fr.length ? <AvatarStack users={d.fr.map((u) => friendService.user(u))} max={3} size={22} /> : <Text style={st.mono}>{d.interested >= 1000 ? (d.interested / 1000).toFixed(1) + 'k' : d.interested}</Text>} />
  );
});

/** Neighbourhood: meter · name · level · note */
export const AreaRow = memo(function AreaRow({ id, w = 'now', onPress, first, withFriends = true }: { id: string; w?: TimeWindow; onPress: (id: string) => void; first?: boolean; withFriends?: boolean }) {
  const d = useHop(() => {
    const info = activityService.areaInfo(id, w);
    const pub = activityService.areaPublic(id, w);
    return { name: info.area.name, lv: info.lv, level: w === 'now' ? info.level : `Expected ${info.level.toLowerCase()}`, note: w === 'now' ? info.note : info.span ? `Busy ${info.span}` : info.note, on: pub.events.length, friends: pub.friends.map((f) => f.user.id) };
  }, [id, w], deepEqual);
  return (
    <Row first={first} testID={`area-row-${id}`} onPress={() => onPress(id)} lead={<LevelBox lv={d.lv} />}
      title={<Text numberOfLines={1} style={st.t}>{d.name} <LevelWord lv={d.lv}>{d.level}</LevelWord></Text>}
      sub={`${d.note}${d.on ? ` · ${d.on} on` : ''}`}
      trail={withFriends && d.friends.length ? <AvatarStack users={d.friends.map((u) => friendService.user(u))} max={3} size={22} /> : <Icon name="chev" size={18} color={C.text3} />} />
  );
});

/** Outing row (Outings tab, search results) */
export const OutingRow = memo(function OutingRow({ id, onPress, first }: { id: string; onPress: (id: string) => void; first?: boolean }) {
  const d = useHop(() => { const o = outingService.get(id)!; return { title: o.title, icon: o.icon, live: o.status === 'live', when: when(o.startsAt), going: outingService.going(id).length }; }, [id], deepEqual);
  return (
    <Row first={first} onPress={() => onPress(id)} lead={<View style={st.iconBox}><OutingIcon icon={d.icon} size={18} /></View>}
      title={d.title} sub={`${d.live ? 'Live now' : d.when} · ${d.going} going`} chevron />
  );
});

export const st = StyleSheet.create({
  thumb: { width: 44, height: 44 },
  s: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 1 },
  t: { fontFamily: F.bodySemi, fontSize: 15, color: C.text },
  mono: { fontFamily: F.mono, fontSize: 12.5, color: C.text3 },
  et: { width: 52, fontFamily: F.monoSemi, fontSize: 12.5, color: C.accent },
  iconBox: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
