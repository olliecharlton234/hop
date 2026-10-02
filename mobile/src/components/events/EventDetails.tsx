/* Event sheet: when, where, price, who's interested, who's there now.
   Add to outing (primary) · View · Save · Share · Plan a night around this. */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Photo } from '@/components/ui/Photo';
import { AvatarStack, Avatar } from '@/components/ui/Avatar';
import { EventGlyph, Icon, OutingIcon } from '@/components/ui/Icon';
import { Button, BtnRow } from '@/components/ui/Button';
import { Row, Section } from '@/components/ui/Layout';
import { modal, SheetBody } from '@/components/ui/ModalSheet';
import { openSaveTo, openShare } from '@/components/sheets/modals';
import { useHop, deepEqual } from '@/store/hopStore';
import { eventService } from '@/services/eventService';
import { friendService } from '@/services/friendService';
import { outingService } from '@/services/outingService';
import { savedService } from '@/services/savedService';
import { venueService } from '@/services/venueService';
import { toast } from '@/services/notificationService';
import { sameNight } from '@/services/planService';
import { EVENT_CATS } from '@/data/eventCategories';
import { go } from '@/utils/nav';
import { dayDate, eventWhen, hm, plural, startsIn, timeShort } from '@/utils/format';
import { now } from '@/utils/clock';

export const EventDetails = memo(function EventDetails({ id, onScrollToDetail }: { id: string; onScrollToDetail?: () => void }) {
  const d = useHop(() => {
    const e = eventService.byId(id)!;
    const p = eventService.placeOf(e)!;
    const fr = e.friendIds.filter((x) => x !== friendService.meId());
    const here = friendService.atEvent(id).concat(e.venueId && eventService.isLive(e) ? friendService.at(e.venueId) : []).map((f) => f.user.id);
    const si = startsIn(e.startsAt, e.endsAt);
    return { e, place: p.name, suburb: p.suburb, live: eventService.isLive(e), when: eventWhen(e.startsAt), soon: !eventService.isLive(e) && e.startsAt > now() && e.startsAt - now() < 150 * 6e4 ? si : '', fr, here,
      mine: e.friendIds.includes(friendService.meId()), saved: savedService.isSaved({ eventId: id }), catLabel: EVENT_CATS[e.cat].label };
  }, [id], deepEqual);
  const e = d.e;
  return (
    <View testID={`event-${id}`}>
      <Text style={st.when}>{d.live ? <Text style={{ color: C.live }}>ON NOW </Text> : null}{d.when}{d.soon ? <Text style={{ color: C.accent }}> · {d.soon}</Text> : null}</Text>
      <Text style={st.h1}>{e.title}</Text>
      <View style={st.facts}>
        <Pressable style={st.fact} onPress={() => (e.venueId ? go.venue(e.venueId) : null)}><Icon name="pin" size={16} color={C.text2} /><Text style={st.factT}>{d.place}, {d.suburb}</Text></Pressable>
        <View style={st.fact}><EventGlyph cat={e.cat} size={16} color={C.text2} /><Text style={st.factT}>{d.catLabel}{e.genre && e.genre !== d.catLabel ? ` · ${e.genre}` : ''}</Text></View>
        <View style={st.fact}><Icon name="ticket" size={16} color={C.text2} /><Text style={st.factT}>{e.priceLabel}{e.deal ? <Text style={{ color: C.accent }}> · {e.deal}</Text> : null}</Text></View>
        <View style={st.fact}><Icon name="users" size={16} color={C.text2} /><Text style={st.factT}>{e.interested.toLocaleString('en-AU')} interested{d.fr.length ? ` · ${d.fr.slice(0, 2).map((u) => friendService.user(u)?.first).join(', ')}${d.fr.length > 2 ? ` +${d.fr.length - 2}` : ''}` : ''}</Text>{d.fr.length ? <AvatarStack users={d.fr.map((u) => friendService.user(u))} max={4} size={22} /> : null}</View>
        {d.here.length ? <View style={st.fact}><AvatarStack users={d.here.map((u) => friendService.user(u))} max={4} size={22} /><Text style={st.factT}>{friendService.user(d.here[0])?.first}{d.here.length > 1 ? ` and ${d.here.length - 1} more are` : ' is'} there now</Text></View> : null}
      </View>
      <Button testID="event-add" icon="plus" variant="primary" title="Add to outing" block onPress={() => openEventToOuting(id)} />
      <BtnRow style={{ marginTop: 8 }}>
        <Button testID="event-view" title="View" style={{ flex: 1 }} onPress={() => onScrollToDetail?.()} />
        <Button testID="event-save" style={{ flex: 1 }} variant={d.saved ? 'saved' : 'default'} icon={d.saved ? 'check' : 'bookmark'} title={d.saved ? 'Saved' : 'Save'} onPress={() => openSaveTo({ eventId: id })} />
        <Button testID="event-share" style={{ flex: 1 }} icon="share" title="Share" onPress={() => openShare({ eventId: id })} />
      </BtnRow>
      <Pressable testID="event-plan-around" style={st.addstop} onPress={() => go.create({ event: id })}><View style={st.num}><Icon name="plus" size={16} color={C.accent} /></View><Text style={st.addT}>Plan a night around this</Text></Pressable>
      {(
        <View testID="event-detail" style={{ marginTop: 12 }}>
          {e.img ? <Photo p={{ id: e.id, u: e.img }} w={900} h={400} radius={10} style={{ height: 150 }} /> : null}
          {e.blurb ? <Text style={st.blurb}>{e.blurb}</Text> : null}
          <Row first lead={<Icon name="clock" size={18} color={C.text2} />} title={`${dayDate(e.startsAt)}, ${timeShort(e.startsAt)} – ${timeShort(e.endsAt)}`} sub={e.recurs === 'weekly' ? `Every ${new Date(e.startsAt).toLocaleDateString('en-AU', { weekday: 'long' })}` : 'One night only'} />
          <Row lead={<Icon name={e.publisher.type === 'venue' ? 'check' : 'link'} size={18} color={C.text2} />} title={e.publisher.name} sub={e.publisher.type === 'venue' ? (e.publisher.verified ? 'Posted by the venue · verified' : 'Posted by the venue') : e.publisher.type === 'community' ? 'Community listing' : 'From an events listing'} />
          <Button style={{ marginTop: 14 }} block variant={d.mine ? 'primary' : 'default'} icon={d.mine ? 'check' : undefined} title={d.mine ? 'You’re interested' : 'I’m interested'} onPress={() => { const on = eventService.toggleInterest(id); toast(on ? 'Saved. We’ll show you who else is keen.' : 'Removed'); }} />
        </View>
      )}
    </View>
  );
});

export function openEventToOuting(id: string) { modal.open(<EventToOuting id={id} />); }
function EventToOuting({ id }: { id: string }) {
  const d = useHop(() => {
    const e = eventService.byId(id)!;
    const mine = outingService.mine().upcoming.filter((o) => o.status === 'planning' && outingService.myMembership(o.id)?.rsvp === 'going').sort((a, b) => a.startsAt - b.startsAt);
    return { title: e.title, cat: e.cat, sub: `${dayDate(e.startsAt)} · ${hm(e.startsAt)} · ${eventService.placeOf(e)?.name}`, at: e.startsAt,
      rows: mine.map((o) => { const ok = sameNight(o.startsAt, e.startsAt); const has = outingService.stops(o.id).some((s) => s.eventId === id); return { id: o.id, title: o.title, icon: o.icon, ok: ok && !has, sub: has ? 'Already on the plan' : ok ? `Adds as a stop at ${timeShort(e.startsAt)} · ${plural(outingService.stops(o.id).length, 'stop')} so far` : `Different night · ${dayDate(o.startsAt)}` }; }) };
  }, [id], deepEqual);
  return (
    <SheetBody title="Add to an outing" testID="event-to-outing">
      <View style={st.card}><View style={st.colic}><EventGlyph cat={d.cat} size={20} /></View><View style={{ flex: 1 }}><Text style={st.b}>{d.title}</Text><Text style={st.factT}>{d.sub}</Text></View></View>
      {d.rows.map((r, i) => (
        <Row key={r.id} testID={`event-to-${r.id}`} first={i === 0} style={!r.ok && { opacity: 0.45 }} onPress={r.ok ? () => { modal.close(); const s = outingService.addEventStop(r.id, id); if (s) toast(`${d.title} is stop ${s.order + 1} of ${r.title}`); go.outing(r.id); } : undefined}
          lead={<View style={st.colic}><OutingIcon icon={r.icon} size={18} /></View>} title={r.title} sub={r.sub} trail={r.ok ? <Icon name="plus" size={18} color={C.accent} /> : null} />
      ))}
      <Row onPress={() => { modal.close(); go.create({ event: id }); }} lead={<View style={st.colic}><Icon name="plus" size={18} color={C.accent} /></View>} title="New outing around this" sub={`Dinner and drinks around ${timeShort(d.at)}, then invite people`} />
    </SheetBody>
  );
}

const st = StyleSheet.create({
  when: { fontFamily: F.monoSemi, fontSize: 11.5, letterSpacing: 0.6, color: C.event, paddingTop: 4 },
  h1: { fontFamily: F.display, fontSize: 28, lineHeight: 31, color: C.text, marginTop: 6 },
  facts: { marginTop: 12, marginBottom: 14, gap: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factT: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.text2 },
  addstop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 4 },
  num: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  addT: { fontFamily: F.bodySemi, fontSize: 15, color: C.accent },
  blurb: { fontFamily: F.body, fontSize: 15, lineHeight: 21, color: C.text, marginTop: 12, marginBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, marginBottom: 8 },
  colic: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  b: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
});
void Avatar; void venueService; void Section;
