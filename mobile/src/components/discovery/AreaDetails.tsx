/* Neighbourhood sheet — why it's busy: level, peak expected, reasons, friends around,
   popular now, starting soon, recent public photos. Anonymous and aggregated. */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F, LV } from '@/theme';
import { LevelMeter } from '@/components/ui/Level';
import { AvatarStack } from '@/components/ui/Avatar';
import { Empty, Section } from '@/components/ui/Layout';
import { EventRow, VenueRow } from './rows';
import { PhotoStrip } from './TonightPanel';
import { useHop, deepEqual } from '@/store/hopStore';
import { useUi } from '@/store/uiStore';
import { activityService } from '@/services/activityService';
import { venueService } from '@/services/venueService';
import { friendService } from '@/services/friendService';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { ago, plural } from '@/utils/format';

export const AreaDetails = memo(function AreaDetails({ id }: { id: string }) {
  const w = useUi((u) => u.heatWindow);
  const d = useHop(() => {
    const info = activityService.areaInfo(id, w);
    const nowInfo = activityService.areaInfo(id, 'now');
    const pub = activityService.areaPublic(id, w);
    const pubNow = w === 'now' ? pub : activityService.areaPublic(id, 'now');
    const evs = (pub.events.length ? pub.events : activityService.areaPublic(id, 'now').events).filter((e) => e.endsAt > now());
    const popular = pub.venues.filter((x) => x.act.busy >= 0.43).slice(0, 5).map((x) => x.v.id);
    const photos = pub.venues.flatMap((x) => venueService.publicPhotos(x.v.id)).sort((p, q) => q.takenAt - p.takenAt);
    const isNow = w === 'now';
    const fr = pubNow.friends.map((f) => f.user.id);
    return {
      name: info.area.name, isNow, lv: info.lv, head: isNow ? `${info.level} now` : `Expected ${info.level.toLowerCase()}`, rising: isNow && nowInfo.trend === 'rising',
      peak: info.span ? `Peak expected ${info.peakLevel.toLowerCase()} · ${info.span}` : info.peak,
      why: info.lv >= 2 ? activityService.why(id, w) : [],
      facts: [fr.length ? `${fr.length} ${fr.length === 1 ? 'friend' : 'friends'} around` : '', evs.length ? `${evs.length} ${evs.length === 1 ? 'event' : 'events'}${w === 'now' || w === 'later' ? ' tonight' : ''}` : '', popular.length ? `${popular.length} popular ${popular.length === 1 ? 'venue' : 'venues'}` : ''].filter(Boolean),
      popular, soon: evs.slice().sort((x, y) => x.startsAt - y.startsAt).slice(0, 4).map((e) => e.id), fr,
      photos: photos.slice(0, 10).map((p) => ({ id: p.id, venueId: p.venueId })), nPhotos: photos.length, photosAgo: photos[0] ? ago(photos[0].takenAt) : '',
      rest: pub.venues.filter((x) => !popular.includes(x.v.id)).slice(0, 8).map((x) => x.v.id),
    };
  }, [id, w], deepEqual);
  return (
    <View testID={`area-${id}`}>
      <Text style={st.label}>{d.isNow ? 'AREA' : 'AREA · FORECAST'}</Text>
      <Text style={st.h1}>{d.name}</Text>
      <View style={st.line}><LevelMeter lv={d.lv} /><Text testID="area-level" style={[st.lvl, { color: LV[d.lv] }]}>{d.head}</Text>{d.rising ? <Text style={st.meta}>Activity rising</Text> : null}</View>
      <Text style={st.peak}>{d.peak}</Text>
      {d.why.length ? <Text style={st.why}>Busy because of {d.why.join(', ')}.</Text> : null}
      {d.facts.length ? <View style={st.facts}>{d.facts.map((f) => <Text key={f} style={st.fact}>{f}</Text>)}</View> : null}
      {d.popular.length ? <Section title="Popular now">{d.popular.map((v, i) => <VenueRow key={v} id={v} first={i === 0} onPress={go.venue} />)}</Section> : null}
      {d.soon.length ? <Section title="Starting soon">{d.soon.map((e, i) => <EventRow key={e} id={e} first={i === 0} onPress={go.event} />)}</Section> : null}
      {d.fr.length ? (
        <Section title="Friends around here">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><AvatarStack users={d.fr.map((u) => friendService.user(u))} max={6} size={28} />
            <Text style={st.meta}><Text style={{ color: C.text, fontFamily: F.bodyBold }}>{d.fr.slice(0, 2).map((u) => friendService.user(u)?.first).join(', ')}</Text>{d.fr.length > 2 ? ` + ${d.fr.length - 2}` : ''}</Text></View>
        </Section>
      ) : null}
      {d.photos.length ? (
        <Section title={`Recent · ${plural(d.nPhotos, 'public photo')}`} right={<Text style={st.meta}>{d.photosAgo}</Text>}>
          <PhotoStrip items={d.photos.map((p) => ({ id: p.id, venueId: p.venueId }))} venue={d.photos[0].venueId} />
        </Section>
      ) : null}
      <Section title="All places here">{d.rest.length ? d.rest.map((v, i) => <VenueRow key={v} id={v} first={i === 0} onPress={go.venue} />) : <Empty>No places listed here yet.</Empty>}</Section>
      <Text style={st.src}>Area activity is anonymous and aggregated. It never shows private outings, who is where, or anyone’s route.</Text>
    </View>
  );
});
const st = StyleSheet.create({
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3, paddingTop: 4 },
  h1: { fontFamily: F.display, fontSize: 30, color: C.text, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  lvl: { fontFamily: F.bodyBold, fontSize: 14.5 },
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2 },
  peak: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 6 },
  why: { fontFamily: F.body, fontSize: 13.5, color: C.text, marginTop: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  fact: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, fontFamily: F.bodySemi, fontSize: 12.5, color: C.text2, overflow: 'hidden' },
  src: { fontFamily: F.body, fontSize: 12, color: C.text3, marginTop: 20, lineHeight: 17 },
});
