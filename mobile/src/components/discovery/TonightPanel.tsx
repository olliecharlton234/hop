/* Tonight — the home sheet.
   PEEK (~20%): three one-line rows readable in two seconds
   EXPLORE (half) / FULL: Your plans, Friends tonight, What's happening, Popular tonight,
   Busy areas, Recent from friends, Saved — ordered by time of day (morning → late). */
import { memo, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Icon, OutingIcon } from '@/components/ui/Icon';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Photo } from '@/components/ui/Photo';
import { LevelMeter } from '@/components/ui/Level';
import { Empty, LivePill, Row, Section } from '@/components/ui/Layout';
import { LinkButton } from '@/components/ui/Button';
import { AreaRow, EventRow, VenueRow } from './rows';
import { useHop, deepEqual } from '@/store/hopStore';
import { useUi } from '@/store/uiStore';
import { outingService } from '@/services/outingService';
import { friendService } from '@/services/friendService';
import { eventService } from '@/services/eventService';
import { activityService } from '@/services/activityService';
import { venueService } from '@/services/venueService';
import { chatService } from '@/services/chatService';
import { photoService } from '@/services/photoService';
import { savedService } from '@/services/savedService';
import { locationService } from '@/services/locationService';
import { chatPreview } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { ago, DAYS_LONG, metres, plural, since, startsIn, time, until, when } from '@/utils/format';
import { openFriendsOut, openSavedLists } from '@/components/sheets/modals';
import { WhereNextSection } from '@/components/outings/WhereNext';

export type Phase = 'morning' | 'afternoon' | 'evening' | 'late';
export function phaseOf(previewHour: number | null): Phase {
  const h = previewHour ?? new Date(now()).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 23) return 'evening';
  return 'late';
}
const PHASE_LABEL: Record<Phase, string> = { morning: 'This morning', afternoon: 'This afternoon', evening: 'Tonight', late: 'Late' };

// ---------------------------------------------------------------- peek rows
function Pk({ lead, main, sub, onPress, extra, testID }: { lead: ReactNode; main: ReactNode; sub?: ReactNode; onPress: () => void; extra?: ReactNode; testID?: string }) {
  return (
    <View style={st.pk}>
      <Pressable testID={testID} onPress={onPress} style={st.pkmain} accessibilityRole="button">
        {lead}
        <Text numberOfLines={1} style={st.pkt}><Text style={st.pkb}>{main}</Text>{sub ? <Text style={st.pke}> {sub}</Text> : null}</Text>
        {extra ? null : <Icon name="chev" size={16} color={C.text3} />}
      </Pressable>
      {extra}
    </View>
  );
}
const IconLead = ({ children }: { children: ReactNode }) => <View style={st.pklead}>{children}</View>;

export const TonightPanel = memo(function TonightPanel() {
  const previewHour = useUi((u) => u.previewHour);
  const ph = phaseOf(previewHour);
  const d = useHop(() => {
    const t = now();
    const { live, upcoming, invites, memories } = outingService.mine();
    const mine = live[0];
    const myPlans = upcoming.filter((o) => outingService.myMembership(o.id)?.rsvp === 'going');
    const others = outingService.tonight().filter((o) => outingService.myMembership(o.id)?.rsvp !== 'going');
    const out = friendService.out();
    const evTonight = eventService.filter({ when: 'tonight' });
    const me = locationService.current();
    const soonNear = evTonight.filter((e) => e.endsAt > t && e.startsAt - t < 120 * 6e4 && metres(me, eventService.placeOf(e)!) < 2500).sort((x, y) => x.startsAt - y.startsAt);
    const hottest = activityService.areas().map((a) => activityService.areaInfo(a.id, 'now')).sort((a, b) => b.heat - a.heat)[0];
    const nearMe = out.filter((f) => { const p = f.venueId ? venueService.byId(f.venueId) : eventService.placeOf(eventService.byId(f.eventId)); return p && metres(me, p) < 1500; }).map((f) => f.user.id);
    const quietNearby = !nearMe.length && !evTonight.some((e) => metres(me, eventService.placeOf(e)!) < 1500);
    const next = myPlans.find((o) => !mine || o.id !== mine.id);
    const groups: Record<string, string[]> = {};
    out.forEach((f) => { const k = f.venueId || f.eventId || ''; (groups[k] ||= []).push(f.user.first); });
    const topGroup = Object.entries(groups).sort((x, y) => y[1].length - x[1].length)[0];
    const invite = invites[0] || others.find((x) => outingService.myMembership(x.id)?.rsvp === 'invited');
    const starting = soonNear.filter((e) => e.startsAt > t);
    let later = null as null | { name: string; level: string };
    if (ph === 'afternoon') { const l = activityService.areas().map((a) => activityService.areaInfo(a.id, 'later')).sort((a, b) => b.heat - a.heat)[0]; if (l) later = { name: l.area.name, level: l.level }; }
    return {
      clock: `${DAYS_LONG[new Date(t).getDay()].slice(0, 3)} ${time(t)}`,
      evCount: evTonight.length,
      live: mine ? { id: mine.id, title: mine.title, icon: mine.icon, at: outingService.stopName(outingService.stops(mine.id)[mine.live!.current]), since: since(mine.live!.arrivedAt) } : null,
      plan: next ? { id: next.id, title: next.title, icon: next.icon, when: when(next.startsAt).replace(', ', ' · '), going: outingService.going(next.id).length, unread: chatService.unread(next.id) } : null,
      friends: out.length ? { n: out.length, ids: out.slice(0, 3).map((f) => f.user.id), top: topGroup ? `${topGroup[1][0]}${topGroup[1].length > 1 ? ` + ${topGroup[1].length - 1}` : ''} at ${venueService.byId(topGroup[0])?.name || eventService.byId(topGroup[0])?.title || ''}` : '' } : null,
      soon: soonNear.length ? (starting.length ? { main: `${starting.length} ${starting.length === 1 ? 'thing' : 'things'} starting nearby`, sub: startsIn(starting[0].startsAt).replace('Starts in', 'first in') } : { main: `${soonNear.length} ${soonNear.length === 1 ? 'thing' : 'things'} on nearby`, sub: soonNear[0].title }) : null,
      invite: invite ? { id: invite.id, host: invite.organiserId, title: invite.title, when: when(invite.startsAt) } : null,
      memory: memories[0] ? { id: memories[0].id, title: memories[0].title, icon: memories[0].icon, sub: `${plural(photoService.album(memories[0].id).length, 'photo')} · ${ago(memories[0].startsAt)}` } : null,
      busy: hottest && hottest.lv >= 2 ? { id: hottest.area.id, lv: hottest.lv, main: `${hottest.area.name} ${hottest.level.toLowerCase()} now`, sub: hottest.note, rising: hottest.trend === 'rising' } : null,
      later, quietNearby,
      planIds: (mine ? [mine, ...myPlans.filter((o) => o.id !== mine.id)] : myPlans).map((o) => o.id),
      inviteIds: invites.map((o) => o.id),
      nearMe,
    };
  }, [ph], deepEqual);

  const rows: Record<string, ReactNode> = {
    live: d.live && <Pk key="live" testID="peek-live" onPress={() => go.outing(d.live!.id)} lead={<IconLead><OutingIcon icon={d.live.icon} size={15} /></IconLead>} main={d.live.title} sub={`At ${d.live.at} · ${d.live.since}`}
      extra={<Pressable testID="peek-camera" accessibilityLabel="Take a photo" onPress={() => go.camera(d.live!.id)} style={st.pkcam}><Icon name="camera" size={18} color={C.ink} /></Pressable>} />,
    plan: d.plan && <Pk key="plan" testID="peek-plan" onPress={() => (d.plan!.unread ? go.chat(d.plan!.id) : go.outing(d.plan!.id))} lead={<IconLead><OutingIcon icon={d.plan.icon} size={15} /></IconLead>} main={d.plan.title}
      sub={<>{d.plan.when} · {d.plan.going} going{d.plan.unread ? <Text style={{ color: C.accent, fontFamily: F.bodySemi }}> · {d.plan.unread} new</Text> : null}</>} />,
    friends: d.friends && <Pk key="friends" testID="peek-friends" onPress={openFriendsOut} lead={<AvatarStack users={d.friends.ids.map((id) => friendService.user(id))} max={3} size={22} />} main={`${d.friends.n} friends are out`} sub={d.friends.top} />,
    soon: d.soon && <Pk key="soon" testID="peek-soon" onPress={() => go.whatson('tonight')} lead={<IconLead><Icon name="ticket" size={15} color={C.accent} /></IconLead>} main={d.soon.main} sub={d.soon.sub} />,
    invite: d.invite && <Pk key="invite" onPress={() => go.outing(d.invite!.id)} lead={<Avatar user={friendService.user(d.invite.host)} size={24} />} main={`${friendService.user(d.invite.host)?.first} invited you`} sub={`${d.invite.title} · ${d.invite.when}`} />,
    memory: d.memory && <Pk key="memory" onPress={() => go.outing(d.memory!.id)} lead={<IconLead><OutingIcon icon={d.memory.icon} size={15} /></IconLead>} main={d.memory.title} sub={d.memory.sub} />,
    busy: d.busy && <Pk key="busy" onPress={() => go.area(d.busy!.id)} lead={<IconLead><LevelMeter lv={d.busy.lv} scale={0.85} /></IconLead>} main={d.busy.main} sub={d.busy.sub} />,
  };
  const order = { morning: ['live', 'memory', 'plan', 'invite', 'soon'], afternoon: ['live', 'plan', 'invite', 'soon', 'friends'], evening: ['live', 'plan', 'friends', 'soon', 'invite', 'busy'], late: ['live', 'friends', 'busy', 'soon', 'plan'] }[ph];
  let peek = order.map((k) => rows[k]).filter(Boolean).slice(0, 3);
  if (!peek.length) peek = [<Pk key="create" onPress={() => go.create()} lead={<IconLead><Icon name="plus" size={15} color={C.accent} /></IconLead>} main="Plan something" sub="pick a few places, send the link" />];

  const glance = [d.busy ? `${d.busy.main}${d.busy.rising ? ', activity rising' : ''}` : '', d.later ? `${d.later.name} expected ${d.later.level.toLowerCase()} tonight` : ''].filter(Boolean);
  const plans = <PlansSection key="plans" ids={d.planIds} />;
  const sections: Record<Phase, ReactNode[]> = {
    morning: [plans, <RecentFromFriends key="rf" title="New photos" maxAge={36 * 36e5} />, <StartingSection key="st" title="This weekend" w="weekend" />, <SavedSection key="sv" />],
    afternoon: [<PlansSection key="plans" ids={[...d.planIds, ...d.inviteIds]} />, <BusySection key="busy" w="later" title="Expected busy tonight" />, <StartingSection key="st" title="What’s happening later" />, <FriendsSection key="fr" />, <PopularSection key="pop" title="Popular tonight" />, <SavedSection key="sv" />],
    evening: [d.quietNearby ? <Empty key="q">Nothing much near you yet. Here’s what’s happening across Sydney.</Empty> : null, plans, <FriendsSection key="fr" />, <StartingSection key="st" title="What’s happening" />, <PopularSection key="pop" title="Popular tonight" />, <BusySection key="busy" w="now" title="Busy areas" />, <RecentFromFriends key="rf" />, <SavedSection key="sv" />],
    late: [d.live ? <WhereNextSection key="wn" outingId={d.live.id} /> : null, <FriendsSection key="fr" only={d.nearMe.length ? d.nearMe : undefined} />, <BusySection key="busy" w="now" title="Still busy" />, <PopularSection key="pop" title="Still going" />, <RecentFromFriends key="rf" />, <StartingSection key="st" title="Still on" />, plans],
  };
  return (
    <View testID="tonight-panel">
      <View style={st.head}>
        <Text style={st.label}><Text style={{ color: C.accent }}>{PHASE_LABEL[ph].toUpperCase()}</Text> · {d.clock.toUpperCase()}{previewHour != null ? ' · PREVIEW' : ''}</Text>
        <LinkButton testID="tonight-whatson" title={`${d.evCount} on`} icon={undefined} color={C.event} onPress={() => go.whatson('tonight')} />
      </View>
      <View>{peek}</View>
      {glance.length ? <Text style={st.glance}>{glance.join(' · ')}</Text> : null}
      {sections[ph]}
      <Text style={st.src}>Busy levels combine venue patterns, public events, crowd reports and anonymous activity. Crowd reports, public photos and the wider city population are demo data in this prototype.</Text>
    </View>
  );
});
export const PEEK_HEIGHT = 20 + 34 + 3 * 38 + 8;

// ---------------------------------------------------------------- sections
export function PlansSection({ ids, title = 'Your plans' }: { ids: string[]; title?: string }) {
  if (!ids.length) return null;
  return <Section title={title}>{ids.map((id, i) => <PlanRow key={id} id={id} first={i === 0} />)}</Section>;
}
const PlanRow = memo(function PlanRow({ id, first }: { id: string; first?: boolean }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const un = chatService.unread(id); const lm = un ? chatService.lastMessage(id) : null;
    const going = outingService.going(id).map((a) => a.userId);
    return { title: o.title, icon: o.icon, live: o.status === 'live', when: when(o.startsAt), un, lm: lm ? chatPreview(lm) : '', lmAt: lm ? since(lm.at) : '', going, stops: outingService.stops(id).length };
  }, [id], deepEqual);
  return (
    <Row first={first} onPress={() => (d.un ? go.chat(id) : go.outing(id))}
      lead={<View style={st.lead}><OutingIcon icon={d.icon} size={20} />{d.un ? <View style={st.ub}><Text style={st.ubT}>{d.un}</Text></View> : null}</View>}
      title={<Text numberOfLines={1} style={st.rt}>{d.title} <Text style={st.when}>{d.live ? 'LIVE' : d.when}</Text></Text>}
      sub={d.lm ? <Text numberOfLines={1} style={st.rs}><Text style={{ color: C.text }}>{d.lm}</Text> · {d.lmAt}</Text>
        : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}><AvatarStack users={d.going.map((u) => friendService.user(u))} max={4} size={18} /><Text style={st.rs}>{d.going.length} going · {plural(d.stops, 'stop')}</Text></View>}
      chevron />
  );
});
export function FriendsSection({ only, title = 'Friends tonight', limit = 6 }: { only?: string[]; title?: string; limit?: number }) {
  const groups = useHop(() => {
    const out = friendService.out().filter((f) => !only || only.includes(f.user.id));
    const places: Record<string, typeof out> = {};
    out.forEach((f) => { const k = f.venueId || 'e:' + f.eventId; (places[k] ||= []).push(f); });
    return { total: out.length, rows: Object.entries(places).sort((a, b) => b[1].length - a[1].length).slice(0, limit).map(([k, fs]) => {
      const v = venueService.byId(k), e = k.startsWith('e:') ? eventService.byId(k.slice(2)) : undefined;
      const o = fs[0].outingId ? outingService.get(fs[0].outingId) : undefined;
      const names = fs.map((f) => f.user.first);
      return { k, ids: fs.map((f) => f.user.id), names: `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` + ${names.length - 2}` : ''}`, sub: `${v ? v.name : e?.title}${o ? ` · ${o.title}` : ''} · ${since(Math.min(...fs.map((f) => f.since)))}`, venue: !!v };
    }) };
  }, [only?.join(','), limit], deepEqual);
  if (!groups.rows.length) return null;
  return (
    <Section title={title} right={<LinkButton title={`All ${groups.total}`} onPress={openFriendsOut} />}>
      {groups.rows.map((r, i) => (
        <Row key={r.k} first={i === 0} onPress={() => (r.venue ? go.venue(r.k) : go.event(r.k.slice(2)))} lead={<AvatarStack users={r.ids.map((u) => friendService.user(u))} max={3} size={30} />} title={r.names} sub={r.sub} chevron />
      ))}
    </Section>
  );
}
export function StartingSection({ title = 'Starting soon', w = 'tonight' }: { title?: string; w?: 'tonight' | 'weekend' }) {
  const d = useHop(() => { const t = now(); const l = eventService.filter({ when: w }).filter((e) => e.endsAt > t).sort((a, b) => Math.max(a.startsAt, t) - Math.max(b.startsAt, t)); return { n: l.length, ids: l.slice(0, 5).map((e) => e.id) }; }, [w], deepEqual);
  if (!d.n) return null;
  return <Section title={title} right={<LinkButton title={`See all ${d.n}`} onPress={() => go.whatson(w)} />}>{d.ids.map((id, i) => <EventRow key={id} id={id} first={i === 0} onPress={go.event} />)}</Section>;
}
export function BusySection({ w = 'now', title = 'Busy tonight' }: { w?: 'now' | 'later'; title?: string }) {
  const ids = useHop(() => activityService.areas().map((a) => activityService.areaInfo(a.id, w)).filter((x) => x.lv >= 2).sort((x, y) => y.heat - x.heat).slice(0, 5).map((x) => x.area.id), [w], deepEqual);
  if (!ids.length) return null;
  return <Section title={title}>{ids.map((id, i) => <AreaRow key={id} id={id} w={w} first={i === 0} onPress={go.area} />)}</Section>;
}
export function PopularSection({ title = 'Popular near you' }: { title?: string }) {
  const ids = useHop(() => venueService.all().filter((v) => v.cat !== 'spot').map((v) => ({ v, a: venueService.activity(v.id), d: metres(locationService.current(), v) })).filter((x) => x.a.hot && x.d < 2500).sort((a, b) => b.a.busy - a.a.busy).slice(0, 5).map((x) => x.v.id), [], deepEqual);
  if (!ids.length) return null;
  return <Section title={title}>{ids.map((id, i) => <VenueRow key={id} id={id} first={i === 0} onPress={go.venue} />)}</Section>;
}
export function RecentFromFriends({ title = 'Recent from friends', maxAge = 3 * 36e5 }: { title?: string; maxAge?: number }) {
  const d = useHop(() => {
    const t = now();
    const ps = outingService.tonight().concat(outingService.mine().memories.slice(0, 2)).flatMap((o) => photoService.album(o.id)).filter((p) => p.visibility === 'outing' && t - p.takenAt < maxAge && t >= p.takenAt).sort((a, b) => b.takenAt - a.takenAt);
    const by: Record<string, typeof ps> = {}; ps.forEach((p) => (by[p.outingId] ||= []).push(p));
    return { ids: ps.slice(0, 12).map((p) => [p.id, p.outingId, p.userId]), lines: Object.entries(by).slice(0, 2).map(([oid, l]) => `${outingService.get(oid)?.title} · ${plural(l.length, 'photo')} · last ${since(l[0].takenAt)} ago`) };
  }, [maxAge], deepEqual);
  if (!d.ids.length) return null;
  return (
    <Section title={title}>
      <PhotoStrip items={d.ids.map(([id, oid, uid]) => ({ id, outingId: oid, userId: uid }))} />
      <Text style={[st.rs, { marginTop: 8 }]}>{d.lines.join('\n')}</Text>
    </Section>
  );
}
export function SavedSection() {
  const cols = useHop(() => savedService.collections().filter((c) => c.items.length).map((c) => ({ id: c.id, name: c.name, n: c.items.length })), [], deepEqual);
  if (!cols.length) return null;
  return (
    <Section title="Saved" right={<LinkButton title="All lists" onPress={() => openSavedLists()} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {cols.map((c) => (
          <Pressable key={c.id} onPress={() => openSavedLists(c.id)} style={st.colchip}>
            <Text style={st.colB}>{c.name}</Text><Text style={st.colS}>{plural(c.n, 'place')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Section>
  );
}
/** Horizontal photo strip (outing photos with the photographer's face) */
export function PhotoStrip({ items, venue }: { items: { id: string; outingId?: string; userId?: string | null; venueId?: string }[]; venue?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {items.map((it) => {
        const vid = it.venueId || venue || '';
        const p = it.outingId ? photoService.get(it.id) : venueService.publicPhotos(vid).find((x) => x.id === it.id);
        return (
          <Pressable key={it.id} testID={`strip-${it.id}`} onPress={() => go.photo(it.outingId ? { outing: it.outingId, id: it.id } : { venue: vid, id: it.id })}>
            <Photo p={p} w={200} h={250} radius={9} style={{ width: 92, height: 116 }} />
            {it.userId ? <View style={{ position: 'absolute', left: 5, bottom: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#000' }}><Avatar user={friendService.user(it.userId)} size={20} /></View> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4, height: 30 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3 },
  pk: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, borderBottomWidth: 1, borderBottomColor: C.line },
  pkmain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, height: 38 },
  pklead: { width: 26, height: 26, borderRadius: 7, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  pkt: { flex: 1, minWidth: 0, fontSize: 14, color: C.text },
  pkb: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  pke: { fontFamily: F.body, fontSize: 13, color: C.text2 },
  pkcam: { width: 36, height: 30, borderRadius: 8, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  glance: { marginTop: 10, fontFamily: F.bodySemi, fontSize: 13, color: C.text },
  src: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 20, lineHeight: 17 },
  lead: { width: 44, height: 44, borderRadius: 11, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  ub: { position: 'absolute', right: -5, top: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ubT: { fontFamily: F.bodyBold, fontSize: 10.5, color: C.accentInk },
  rt: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  when: { fontFamily: F.mono, fontSize: 11.5, color: C.accent },
  rs: { fontFamily: F.body, fontSize: 12.5, color: C.text2 },
  colchip: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.surface2, minWidth: 112 },
  colB: { fontFamily: F.bodyBold, fontSize: 13.5, color: C.text },
  colS: { fontFamily: F.body, fontSize: 12, color: C.text2, marginTop: 2 },
});
void LivePill; void until;
