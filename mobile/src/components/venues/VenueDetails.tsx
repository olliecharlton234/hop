/* Live venue card: "PACKED · Activity rising", what's on, who's there, crowd reports,
   tonight's public photos. Actions: Add to outing · Save · Share · Report. */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Photo } from '@/components/ui/Photo';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Icon, OutingIcon, VenueGlyph } from '@/components/ui/Icon';
import { LevelMeter } from '@/components/ui/Level';
import { Button, BtnRow, LinkButton } from '@/components/ui/Button';
import { Row, Section } from '@/components/ui/Layout';
import { EventRow } from '@/components/discovery/rows';
import { PhotoStrip } from '@/components/discovery/TonightPanel';
import { openReport, openSaveTo, openShare } from '@/components/sheets/modals';
import { useHop, deepEqual } from '@/store/hopStore';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { outingService } from '@/services/outingService';
import { activityService } from '@/services/activityService';
import { reportService } from '@/services/reportService';
import { savedService } from '@/services/savedService';
import { friendService } from '@/services/friendService';
import { locationService } from '@/services/locationService';
import { photoService } from '@/services/photoService';
import { toast } from '@/services/notificationService';
import { LV } from '@/theme';
import { VENUE_CAT_LABEL } from '@/data/eventCategories';
import { go } from '@/utils/nav';
import { ago, hm, plural, timeShort, walkMins } from '@/utils/format';
import { useLocation } from '@/hooks/useLocation';

const peakWords = (id: string) => { const [, pk] = venueService.pop(id); const h = Math.round(pk) % 24; return `peaks around ${h % 12 || 12}${h >= 12 && h < 24 ? 'pm' : 'am'}`; };

export const VenueDetails = memo(function VenueDetails({ id, picking, onPicked, onClose }: { id: string; picking?: string | null; onPicked?: () => void; onClose?: () => void }) {
  useLocation();
  const d = useHop(() => {
    const v = venueService.byId(id);
    const act = venueService.activity(id);
    const evs = eventService.atVenue(id).slice(0, 3);
    const live = act.liveHere.map((o) => ({ id: o.id, host: o.organiserId, title: o.title.replace(/^.*?'s /, ''), icon: o.icon, n: outingService.going(o.id).length, photos: photoService.album(o.id).length }));
    const fr = act.friends.filter((f) => !act.liveHere.some((o) => o.id === f.outingId));
    const pub = venueService.publicPhotos(id);
    const tonight = [...act.tonightPhotos.slice().reverse().map((p) => ({ id: p.id, outingId: p.outingId, userId: p.userId, at: p.takenAt })), ...pub.map((p) => ({ id: p.id, outingId: undefined, userId: null, at: p.takenAt }))];
    const mem = venueService.memoryPhotos(id).map((p) => ({ id: p.id, outingId: p.outingId, userId: null }));
    const area = activityService.areaOfVenue(v);
    const areaNow = area ? activityService.areaInfo(area.id, 'now') : null;
    const onNow = evs.find((e) => eventService.isLive(e));
    const rep = reportService.summary(id);
    const ks = Object.keys(rep) as (keyof typeof rep)[];
    const been = new Set<string>();
    // friends who've been here with you
    outingService.mine().memories.forEach((o) => { if (outingService.stops(o.id).some((s) => s.venueId === id)) outingService.going(o.id).forEach((a) => a.userId !== friendService.meId() && been.add(a.userId)); });
    return {
      name: v.name, cat: v.cat, suburb: v.suburb, price: v.price, img: v.img, address: v.address, blurb: v.blurb, hours: v.hours.replace('Open till', 'till'),
      lv: act.lv, status: `${act.label.toUpperCase()}${act.trend === 'rising' ? ' · Activity rising' : act.trend === 'easing' ? ' · Easing off' : ''}`,
      onNow: onNow?.title || '', area: area ? { id: area.id, name: area.name, level: areaNow!.level.toLowerCase() } : null,
      live, fr: fr.map((f) => f.user.id), frSince: fr.length ? hm(Math.min(...fr.map((f) => f.since))) : '',
      rep: ks.length ? { rows: (['crowd', 'queue', 'entry', 'vibe'] as const).filter((k) => rep[k]).map((k) => [k === 'vibe' ? 'Music' : reportService.KINDS[k].label, rep[k]!.label]), n: Math.max(...ks.map((k) => rep[k]!.n)), last: Math.max(...ks.map((k) => rep[k]!.last)) } : null,
      tonight, tonightAgo: tonight.length ? ago(Math.max(...tonight.map((x) => x.at))) : '', mem,
      evs: evs.map((e) => e.id), been: [...been],
      saved: savedService.isSaved({ venueId: id }),
      mine: outingService.mine().upcoming.filter((o) => o.organiserId === friendService.meId() && o.status === 'planning').map((o) => ({ id: o.id, title: o.title, has: outingService.stops(o.id).some((s) => s.venueId === id) })),
    };
  }, [id], deepEqual);
  const can = reportService.canReport(id);
  const walk = walkMins(locationService.current(), venueService.byId(id));

  return (
    <View testID={`venue-${id}`}>
      <View style={st.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.catRow}><VenueGlyph cat={d.cat} size={13} color={C.text2} /><Text style={st.cat}>{VENUE_CAT_LABEL[d.cat]} · {d.suburb}{d.price ? ` · ${d.price}` : ''}</Text></View>
          <Text style={st.h1} numberOfLines={2}>{d.name}</Text>
          <View style={st.busy}><LevelMeter lv={d.lv} /><Text testID="venue-status" style={[st.status, { color: LV[d.lv] }]}>{d.status}</Text></View>
          <Text style={st.sub}>{d.onNow ? <Text style={{ color: C.event, fontFamily: F.bodySemi }}>{d.onNow} · On now · </Text> : null}{peakWords(id)} · {d.hours} · {walk} min walk</Text>
          {d.area ? <LinkButton title={`${d.area.name} · ${d.area.level} now`} color={C.text2} onPress={() => go.area(d.area!.id)} style={{ marginTop: 4 }} /> : null}
        </View>
        <Photo p={{ id, u: d.img }} w={200} radius={10} style={{ width: 72, height: 72 }} />
      </View>

      {d.live.map((o) => (
        <Row key={o.id} onPress={() => go.outing(o.id)} lead={<View><Avatar user={friendService.user(o.host)} size={34} ring={C.live} /><View style={st.oe}><OutingIcon icon={o.icon} size={11} /></View></View>}
          title={`${friendService.user(o.host)?.first}’s ${o.title} is here`} sub={`${o.n} there · ${o.photos} photos`} chevron />
      ))}
      {d.fr.length ? (
        <View style={st.here}><AvatarStack users={d.fr.map((u) => friendService.user(u))} max={4} size={26} />
          <Text style={st.hereT}><Text style={{ color: C.text, fontFamily: F.bodyBold }}>{d.fr.slice(0, 2).map((u) => friendService.user(u)?.first).join(', ')}</Text>{d.fr.length > 2 ? ` + ${d.fr.length - 2}` : ''} here · since {d.frSince}</Text>
        </View>
      ) : null}

      {d.rep ? (
        <View style={st.reports} testID="venue-reports">
          <View style={st.rgrid}>{d.rep.rows.map(([k, v]) => <View key={k} style={{ flex: 1 }}><Text style={st.rk}>{k.toUpperCase()}</Text><Text style={st.rv} numberOfLines={1}>{v}</Text></View>)}</View>
          <View style={st.rfoot}><Text style={st.rf}>{plural(d.rep.n, 'report')} · Updated {ago(d.rep.last)}</Text>{can.ok ? <LinkButton title="Report" onPress={() => openReport(id)} /> : null}</View>
        </View>
      ) : (
        <View style={[st.reports, st.rfoot, { marginTop: 12 }]}><Text style={st.rf}>No crowd reports in the last 90 minutes.</Text>{can.ok ? <LinkButton title="Report" onPress={() => openReport(id)} /> : null}</View>
      )}

      {d.tonight.length ? (
        <Section title={`Recent · ${plural(d.tonight.length, 'photo')} tonight`} right={<Text style={st.rf}>{d.tonightAgo}</Text>}>
          <PhotoStrip items={d.tonight.slice(0, 12)} venue={id} />
        </Section>
      ) : d.mem.length ? (
        <Section title={`Your nights here · ${d.mem.length} photos`}><PhotoStrip items={d.mem.slice(0, 12)} /></Section>
      ) : null}
      {d.evs.length ? <Section title="On here">{d.evs.map((e, i) => <EventRow key={e} id={e} noPlace first={i === 0} onPress={go.event} />)}</Section> : null}
      {d.been.length ? <View style={[st.here, { marginTop: 8 }]}><AvatarStack users={d.been.map((u) => friendService.user(u))} max={4} size={26} /><Text style={st.hereT}>{d.been.slice(0, 2).map((u) => friendService.user(u)?.first).join(', ')}{d.been.length > 2 ? ` and ${d.been.length - 2} others` : ''} have been here with you</Text></View> : null}

      <View style={{ gap: 8, marginTop: 16 }}>
        {picking ? <PickActions venueId={id} outingId={picking} onPicked={onPicked} onClose={onClose} /> : (
          <>
            {d.mine.map((o) => o.has
              ? <Button key={o.id} icon="check" title={`Stop on ${o.title}`} block onPress={() => go.outing(o.id)} />
              : <Button key={o.id} testID={`add-to-${o.id}`} icon="plus" variant="primary" title={`Add to ${o.title}`} block onPress={() => { const s = outingService.addStop(o.id, id); if (s) toast(`Added to ${o.title} as stop ${s.order + 1}`); go.outing(o.id); }} />)}
            {!d.mine.length ? <Button testID="venue-add-outing" icon="plus" variant="primary" title="Add to an outing" block onPress={() => go.create({ venue: id })} /> : null}
            <BtnRow>
              <Button testID="venue-save" style={{ flex: 1, paddingHorizontal: 8 }} variant={d.saved ? 'saved' : 'default'} icon={d.saved ? 'check' : 'bookmark'} title={d.saved ? 'Saved' : 'Save'} onPress={() => openSaveTo({ venueId: id })} />
              <Button testID="venue-share" style={{ flex: 1, paddingHorizontal: 8 }} icon="send" title="Share" onPress={() => openShare({ venueId: id })} />
              <Button testID="venue-report" style={{ flex: 1, paddingHorizontal: 8, opacity: can.ok ? 1 : 0.45 }} icon="flag" title="Report" onPress={() => openReport(id)} />
            </BtnRow>
            {d.mine.length ? <LinkButton title="Start a new outing here" icon="plus" style={{ alignSelf: 'center', padding: 8 }} onPress={() => go.create({ venue: id })} /> : null}
          </>
        )}
      </View>
      <Text style={st.addr}>{d.address}, {d.suburb} · {d.blurb}</Text>
    </View>
  );
});

function PickActions({ venueId, outingId, onPicked, onClose }: { venueId: string; outingId: string; onPicked?: () => void; onClose?: () => void }) {
  const d = useHop(() => {
    const o = outingService.get(outingId)!; const stops = outingService.stops(outingId);
    const existing = stops.find((s) => s.venueId === venueId);
    const at = stops.length ? stops[stops.length - 1].at + 90 * 6e4 : o.startsAt;
    const ar = activityService.areaOfVenue(venueService.byId(venueId));
    const l = ar ? activityService.levelAt(ar.id, at) : null;
    return { title: o.title, existing: existing?.id || null, n: stops.length + 1, at, ctx: ar && l ? { lv: l.lv, text: `${ar.name} expected ${l.level.toLowerCase()} around ${hm(at)}` } : null };
  }, [venueId, outingId], deepEqual);
  return (
    <>
      {d.existing ? <Button icon="trash" title={`Remove from ${d.title}`} block onPress={() => { outingService.removeStop(d.existing!); toast(`Removed ${venueService.byId(venueId).name}`); onClose?.(); }} /> : (
        <>
          {d.ctx ? <View style={st.ctx}><LevelMeter lv={d.ctx.lv} /><Text style={st.rf}>{d.ctx.text}</Text></View> : null}
          <Button testID="pick-add" icon="plus" variant="primary" title={`Add as stop ${d.n} · ${timeShort(d.at)}`} block onPress={() => { const s = outingService.addStop(outingId, venueId); if (s) toast(`Added ${venueService.byId(venueId).name} · ${timeShort(s.at)}`); onPicked?.(); }} />
        </>
      )}
      <Button variant="quiet" title={`Back to ${d.title}`} block onPress={onClose} />
    </>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingTop: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cat: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.text2 },
  h1: { fontFamily: F.display, fontSize: 28, lineHeight: 31, color: C.text, marginTop: 4 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  status: { fontFamily: F.display, fontSize: 12, letterSpacing: 1.2 },
  sub: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 5, lineHeight: 17 },
  oe: { position: 'absolute', right: -5, bottom: -4, width: 18, height: 18, borderRadius: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  here: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  hereT: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.text2 },
  reports: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface2 },
  rgrid: { flexDirection: 'row', gap: 8 },
  rk: { fontFamily: F.display, fontSize: 9.5, letterSpacing: 1.4, color: C.text3 },
  rv: { fontFamily: F.bodyBold, fontSize: 13.5, color: C.text, marginTop: 3 },
  rfoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rf: { fontFamily: F.body, fontSize: 12, color: C.text3, flexShrink: 1 },
  ctx: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addr: { fontFamily: F.body, fontSize: 12.5, color: C.text3, marginTop: 14, lineHeight: 18 },
});
void Pressable; void Icon;
