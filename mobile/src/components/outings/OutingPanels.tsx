/* The three faces of an outing: PLAN (before), LIVE (on the night), MEMORY (after),
   plus the shared Photos tab. Chat lives in components/chat. */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button, BtnRow, LinkButton } from '@/components/ui/Button';
import { Icon, OutingIcon } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { Empty, LivePill, Section } from '@/components/ui/Layout';
import { StopsList } from './StopsList';
import { RsvpSeg } from './RsvpSeg';
import { WhereNextSection } from './WhereNext';
import { PhotoStrip } from '@/components/discovery/TonightPanel';
import { confirm, openAttendees, openInvite } from '@/components/sheets/modals';
import { pickFromLibrary } from '@/components/camera/compose';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { friendService } from '@/services/friendService';
import { photoService } from '@/services/photoService';
import { chatService } from '@/services/chatService';
import { toast } from '@/services/notificationService';
import { sim, chatPreview } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { ago, longDate, plural, timeShort, walkMins, when } from '@/utils/format';
import { router } from 'expo-router';

// ---------------------------------------------------------------- activity lines
function actText(a: any) {
  const me = friendService.meId();
  const who = a.userId === me ? 'You' : friendService.user(a.userId)?.first || 'Someone';
  const v = a.venueId ? (outingService.placeOf({ venueId: a.venueId } as any)?.name || '') : '';
  return ({ joined: `${who} ${a.userId === me ? 'are' : 'is'} going`, going: `${who} ${a.userId === me ? 'are' : 'is'} going`, maybe: `${who} might come`, declined: `${who} can’t make it`, invited: `${who} ${a.userId === me ? 'were' : 'was'} invited`,
    stop: `${who} added ${v}`, photos: `${who} added ${plural(a.count, 'photo')}`, started: `${who} started the night`, moved: `Moved on to ${v}`, ended: `${who} wrapped up the night` } as Record<string, string>)[a.type] || '';
}
function ActLine({ a }: { a: any }) {
  return (
    <View style={st.act}>
      {['moved', 'ended'].includes(a.type) ? <View style={st.ico}><Icon name={a.type === 'moved' ? 'walk' : 'flag'} size={15} color={C.text2} /></View> : <Avatar user={friendService.user(a.userId)} size={28} />}
      <Text style={st.actT}>{actText(a)}</Text><Text style={st.actAt}>{ago(a.at)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- PLAN
export const OutingPlan = memo(function OutingPlan({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const att = outingService.members(id);
    const stops = outingService.stops(id);
    return { title: o.title, icon: o.icon, cover: o.cover, when: when(o.startsAt), area: stops[0] ? outingService.placeOf(stops[0]).suburb : 'No stops yet', vis: o.visibility, org: outingService.isOrganiser(o), host: o.organiserId,
      going: att.filter((a) => a.rsvp === 'going').map((a) => a.userId), maybe: att.filter((a) => a.rsvp === 'maybe').length, waiting: att.filter((a) => a.rsvp === 'invited').length, nStops: stops.length, activity: o.activity.slice(0, 6) };
  }, [id], deepEqual);
  return (
    <View testID="outing-plan">
      <View style={st.ohead}>
        <View style={st.emo}>{d.cover ? <Photo p={{ id, src: d.cover }} w={140} style={StyleSheet.absoluteFill} /> : <OutingIcon icon={d.icon} size={26} />}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.h1} numberOfLines={2}>{d.title}</Text>
          <Text style={st.when}>{d.when}</Text>
          <Text style={st.sub}>{d.area} · {d.vis === 'public' ? 'Public' : 'Private'} · {d.org ? 'You’re hosting' : `Hosted by ${friendService.user(d.host)?.first}`}</Text>
        </View>
      </View>
      {!d.org ? <View style={{ marginTop: 14 }}><RsvpSeg id={id} /></View> : null}
      <Pressable testID="who-going" style={st.who} onPress={() => openAttendees(id)}>
        <AvatarStack users={d.going.map((u) => friendService.user(u))} max={6} size={30} />
        <View style={{ flex: 1 }}><Text style={st.b}>{d.going.length} {d.going.length === 1 ? 'person is' : 'people are'} going</Text><Text style={st.meta}>{[d.maybe && `${d.maybe} maybe`, d.waiting && `${d.waiting} haven’t replied`].filter(Boolean).join(' · ') || 'Everyone’s replied'}</Text></View>
        <Icon name="chev" size={18} color={C.text3} />
      </Pressable>
      <Section title="The plan" right={d.nStops ? <Text style={st.mono}>{plural(d.nStops, 'stop')}</Text> : undefined}>
        {d.nStops ? <StopsList outingId={id} editable={d.org} /> : (
          <>
            <Empty>No stops yet.</Empty>
            {d.org ? <Button testID="add-first-stop" icon="plus" title="Add a stop" onPress={() => go.pick(id)} /> : null}
          </>
        )}
      </Section>
      <Section title="Album"><Text style={st.meta}>Photos anyone takes on the night land here, sorted by stop. Starts when the night does.</Text></Section>
      {d.activity.length ? <Section title="Updates">{d.activity.map((a) => <ActLine key={a.id} a={a} />)}</Section> : null}
      {d.org ? (
        <View style={{ flexDirection: 'row', gap: 18, paddingTop: 18 }}>
          <LinkButton title="Edit details" icon="edit" onPress={() => router.push({ pathname: '/outings/create', params: { edit: id } })} />
          <LinkButton title="Delete" icon="trash" color={C.text3} onPress={() => confirm({ title: `Delete ${d.title}?`, text: 'Everyone you invited will lose the plan. This can’t be undone.', ok: 'Delete', cancel: 'Keep it', danger: true, onOk: () => { outingService.remove(id); router.back(); toast('Outing deleted'); } })} />
        </View>
      ) : null}
      <BtnRow style={{ marginTop: 18 }}>
        {d.org ? (
          <>
            <Button testID="invite" style={{ flex: 1 }} icon="share" title="Invite" onPress={() => openInvite(id)} />
            <Button testID="start-night" style={{ flex: 1 }} variant="primary" title="Start the night" disabled={!d.nStops} onPress={() => confirm({ title: `Start ${d.title}?`, text: 'Everyone going gets a heads-up and the shared album opens. The map switches to tonight’s route.', ok: 'Start the night', cancel: 'Not yet', onOk: () => outingService.start(id) })} />
          </>
        ) : <Button style={{ flex: 1 }} icon="share" title="Share outing" onPress={() => openInvite(id)} />}
      </BtnRow>
    </View>
  );
});

// ---------------------------------------------------------------- LIVE
export const LivePanel = memo(function LivePanel({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const stops = outingService.stops(id);
    const cur = stops[o.live!.current], nx = stops[o.live!.current + 1];
    const cp = outingService.placeOf(cur), np = nx ? outingService.placeOf(nx) : null;
    const photos = photoService.album(id);
    return { org: outingService.isOrganiser(o), goingMe: outingService.myMembership(id)?.rsvp === 'going', cur: outingService.stopName(cur), curAt: timeShort(cur.at), nx: nx ? outingService.stopName(nx) : null, nxAt: nx ? timeShort(nx.at) : '', walk: np ? walkMins(cp, np) : 0, n: o.live!.current + 1, total: stops.length,
      photos: photos.slice(-14).reverse().map((p) => ({ id: p.id, outingId: id, userId: p.userId })), nPhotos: photos.length, going: outingService.going(id).map((a) => a.userId),
      chat: chatService.canChat(o) ? chatService.messages(id).slice(-4).map((m) => ({ id: m.id, userId: m.userId, text: chatPreview(m), at: ago(m.at) })) : null };
  }, [id], deepEqual);
  return (
    <View testID="live-panel">
      <View style={st.now}>
        <View style={{ flex: 1 }}><Text style={[st.label, { color: C.live }]}>NOW</Text><Text style={st.nowV} numberOfLines={2}>{d.cur}</Text><Text style={st.meta}>since {d.curAt}</Text></View>
        <View style={{ flex: 1 }}>{d.nx ? <><Text style={st.label}>NEXT STOP</Text><Text style={st.nowV} numberOfLines={2}>{d.nx}</Text><Text style={st.meta}>{d.nxAt} · {d.walk} min walk</Text></> : <><Text style={st.label}>LAST STOP</Text><Text style={st.nowV}>Home time</Text><Text style={st.meta}>{d.n} of {d.total} stops</Text></>}</View>
      </View>
      {!d.goingMe ? (
        <BtnRow style={{ marginTop: 12 }}><Button testID="join-live" style={{ flex: 1 }} variant="primary" title={`Join them at ${d.cur}`} onPress={() => { outingService.rsvp(id, 'going'); toast('You’re in.'); }} /><Button style={{ flex: 1 }} title="Not tonight" onPress={() => router.back()} /></BtnRow>
      ) : (
        <BtnRow style={{ marginTop: 12 }}>
          <Button testID="live-roll" style={{ flex: 1 }} icon="image" title="Camera roll" onPress={() => pickFromLibrary(id)} />
          {d.org ? (d.nx ? <Button testID="advance" style={{ flex: 1 }} variant="primary" icon="walk" title={`Go to ${d.nx.split(' ')[0].replace(/'s$/, '’s')}`} onPress={() => { outingService.advance(id); toast(`Moving on to ${d.nx}`); }} />
            : <Button testID="end-night" style={{ flex: 1 }} variant="live" title="End the night" onPress={() => endNight(id)} />) : null}
        </BtnRow>
      )}
      <Section title={`Album · ${plural(d.nPhotos, 'photo')}`} right={d.nPhotos ? <LinkButton title="See all" onPress={() => go.album(id)} /> : undefined}>
        {d.nPhotos ? <PhotoStrip items={d.photos} /> : <Text style={st.meta}>Nothing yet. Photos from everyone on the outing show up here as they’re taken.</Text>}
      </Section>
      {d.goingMe ? <WhereNextSection outingId={id} /> : null}
      <Pressable style={[st.who, { marginTop: 10 }]} onPress={() => openAttendees(id)}><AvatarStack users={d.going.map((u) => friendService.user(u))} max={7} size={30} /><Text style={[st.b, { flex: 1 }]}>{d.going.length} out tonight</Text><Icon name="chev" size={18} color={C.text3} /></Pressable>
      {d.chat ? (
        <Section title="Latest in the chat" right={<LinkButton title="Open chat" onPress={() => go.chat(id)} />}>
          {d.chat.map((m) => (
            <Pressable key={m.id} style={st.act} onPress={() => go.chat(id)}>
              {m.userId ? <Avatar user={friendService.user(m.userId)} size={28} /> : <View style={st.ico}><Icon name="check" size={14} color={C.text2} /></View>}
              <Text numberOfLines={1} style={st.actT}>{m.text}</Text><Text style={st.actAt}>{m.at}</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
      {d.org && d.nx ? <Button style={{ marginTop: 18 }} icon="flag" title="End the night early" block onPress={() => endNight(id)} /> : null}
      {d.goingMe ? (
        <View style={st.demo}>
          <Text style={st.label}>PROTOTYPE · SIMULATE THE GROUP</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button sm title="A friend posts" onPress={() => sim.friendPost(id)} />
            <Button testID="photo-rush" sm title="Photo rush" onPress={() => { sim.burst(id); toast('Five friends start posting…'); }} />
          </View>
        </View>
      ) : null}
    </View>
  );
});
export function endNight(id: string) {
  const o = outingService.get(id)!;
  confirm({ title: `Wrap up ${o.title}?`, text: 'It moves to Memories with the route, the people and every photo. Anyone can still add the ones on their camera roll.', ok: 'End the night', cancel: 'Keep going', danger: true,
    onOk: () => { outingService.end(id); router.push({ pathname: '/wrap/[id]', params: { id } }); } });
}

// ---------------------------------------------------------------- MEMORY
export const MemoryPanel = memo(function MemoryPanel({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const stops = outingService.stops(id);
    const people = outingService.going(id).map((a) => a.userId); const others = people.filter((u) => u !== friendService.meId());
    const photos = photoService.album(id);
    return { title: o.title, ago: ago(Math.min(o.startsAt, o.endedAt || o.startsAt)), date: longDate(o.startsAt), with: `${others.slice(0, 2).map((u) => friendService.user(u)?.first).join(', ')}${others.length > 2 ? ` and ${others.length - 2} others` : ''}`,
      recap: stops.length > 1 ? stops.map((s) => outingService.stopName(s)).join(' → ') : '', nPhotos: photos.length, people, nStops: stops.length, msgs: chatService.messages(id).filter((m) => m.kind !== 'system').length,
      stops: stops.map((s, i) => { const ps = photoService.album(id, s.id); const spread = ps.length <= 10 ? ps : Array.from({ length: 10 }, (_, k) => ps[Math.floor(((k + 0.5) * ps.length) / 10)]); return { id: s.id, n: i + 1, name: outingService.stopName(s), sub: `${outingService.placeOf(s).suburb} · ${timeShort(s.at)}`, count: ps.length, photos: spread.map((p) => ({ id: p.id, outingId: id })) }; }) };
  }, [id], deepEqual);
  return (
    <View testID="memory-panel">
      <Text style={st.label}>{d.ago.toUpperCase()}</Text>
      <Text style={[st.h1, { marginTop: 6 }]}>{d.title}</Text>
      <Text style={[st.meta, { marginTop: 6 }]}>{d.date} · with {d.with}</Text>
      {d.recap ? <Text testID="memory-recap" style={st.recap}>{d.recap}</Text> : null}
      <View style={st.stats}>
        {[[d.nPhotos, 'photos'], [d.people.length, 'people'], [d.nStops, d.nStops === 1 ? 'stop' : 'stops'], ...(d.msgs ? [[d.msgs, 'messages']] : [])].map(([n, l], i) => <View key={i} style={[st.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}><Text style={st.statN}>{n}</Text><Text style={st.statL}>{l}</Text></View>)}
      </View>
      <Pressable style={st.who} onPress={() => openAttendees(id)}><AvatarStack users={d.people.map((u) => friendService.user(u))} max={8} size={30} /><View style={{ flex: 1 }} /><Icon name="chev" size={18} color={C.text3} /></Pressable>
      <Section title="The night" right={d.nPhotos ? <LinkButton title={`All ${d.nPhotos} photos`} onPress={() => go.album(id)} /> : undefined}>
        {d.stops.map((s) => (
          <View key={s.id} style={{ marginBottom: 14 }}>
            <View style={st.sp}><View style={st.num}><Text style={st.numT}>{s.n}</Text></View><View style={{ flex: 1 }}><Text style={st.b}>{s.name}</Text><Text style={st.meta}>{s.sub}</Text></View><Text style={st.mono}>{s.count}</Text></View>
            {s.photos.length ? <PhotoStrip items={s.photos} /> : null}
          </View>
        ))}
      </Section>
      <BtnRow style={{ marginTop: 8 }}>
        <Button style={{ flex: 1 }} icon="image" title="Add photos" onPress={() => pickFromLibrary(id)} />
        <Button testID="do-again" style={{ flex: 1 }} variant="primary" icon="repeat" title="Do it again" onPress={() => planAgain(id)} />
      </BtnRow>
    </View>
  );
});
function planAgain(id: string) {
  const src = outingService.get(id)!;
  const sat = new Date(now()); sat.setHours(new Date(src.startsAt).getHours(), new Date(src.startsAt).getMinutes(), 0, 0);
  while (sat.getDay() !== new Date(src.startsAt).getDay() || sat.getTime() < now()) sat.setDate(sat.getDate() + 1);
  const o = outingService.duplicate(id, sat.getTime());
  outingService.update(o.id, { title: src.title.includes('again') ? src.title : `${src.title} again` });
  router.replace({ pathname: '/outings/[id]', params: { id: o.id } });
  toast('Same route, new date. Change anything you like.');
}

// ---------------------------------------------------------------- PHOTOS tab
export const PhotosTab = memo(function PhotosTab({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const ps = photoService.album(id);
    return { status: o.status, n: ps.length, people: new Set(ps.map((p) => p.userId)).size, goingMe: outingService.myMembership(id)?.rsvp === 'going',
      stops: outingService.stops(id).map((s, i) => ({ id: s.id, label: `${i + 1}. ${outingService.stopName(s)}`, ids: ps.filter((p) => p.stopId === s.id).map((p) => p.id) })).filter((s) => s.ids.length) };
  }, [id], deepEqual);
  return (
    <View testID="photos-tab">
      <View style={st.phhead}><Text style={st.meta}>{plural(d.n, 'photo')} from {plural(d.people, 'person', 'people')}</Text>{d.n ? <LinkButton title="Full screen" onPress={() => go.album(id)} /> : null}</View>
      {d.stops.length ? d.stops.map((s) => (
        <View key={s.id}>
          <Text style={[st.label, { marginTop: 14, marginBottom: 6 }]}>{s.label.toUpperCase()} · {s.ids.length}</Text>
          <View style={st.grid}>{s.ids.map((pid) => <Pressable key={pid} testID={`grid-${pid}`} onPress={() => go.photo({ outing: id, id: pid })} style={st.cell}><Photo p={photoService.get(pid)} w={260} style={StyleSheet.absoluteFill} /></Pressable>)}</View>
        </View>
      )) : <Empty>{d.status === 'planning' ? 'The album opens when the night starts. Everyone’s photos land here automatically.' : 'No photos yet.'}</Empty>}
      {d.goingMe && d.status !== 'planning' ? (
        <BtnRow style={{ marginTop: 14 }}>
          <Button style={{ flex: 1 }} icon="image" title="Add from camera roll" onPress={() => pickFromLibrary(id)} />
          {d.status === 'live' ? <Button style={{ flex: 1 }} variant="primary" icon="camera" title="Take a photo" onPress={() => go.camera(id)} /> : null}
        </BtnRow>
      ) : null}
    </View>
  );
});

const st = StyleSheet.create({
  ohead: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingTop: 4 },
  emo: { width: 56, height: 56, borderRadius: 13, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  h1: { fontFamily: F.display, fontSize: 28, lineHeight: 31, color: C.text },
  when: { fontFamily: F.mono, fontSize: 13, color: C.accent, marginTop: 4 },
  sub: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 3 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  b: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2, lineHeight: 19 },
  mono: { fontFamily: F.mono, fontSize: 12.5, color: C.text3 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  ico: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  actT: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.text },
  actAt: { fontFamily: F.mono, fontSize: 11, color: C.text3 },
  now: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2 },
  nowV: { fontFamily: F.display, fontSize: 19, color: C.text, marginTop: 4 },
  demo: { marginTop: 24, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, gap: 8 },
  recap: { fontFamily: F.bodySemi, fontSize: 14, color: C.accent, marginTop: 8, lineHeight: 20 },
  stats: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 10, marginTop: 16 },
  stat: { flex: 1, padding: 10 },
  statN: { fontFamily: F.display, fontSize: 21, color: C.text },
  statL: { fontFamily: F.body, fontSize: 12, color: C.text2 },
  sp: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  num: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.displayBlack, fontSize: 13, color: C.accentInk },
  phhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: '32.6%', aspectRatio: 1, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
});
void ScrollView; void LivePill;
