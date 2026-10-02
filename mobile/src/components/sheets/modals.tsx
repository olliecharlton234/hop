/* Modal bottom sheets: friends out, saved lists, save to a list, crowd report, share/send,
   who's coming, notification settings, confirm. Each reads live data from the store. */
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { modal, SheetBody } from '@/components/ui/ModalSheet';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button, BtnRow, IconButton } from '@/components/ui/Button';
import { Icon, OutingIcon } from '@/components/ui/Icon';
import { Empty, Row, Section } from '@/components/ui/Layout';
import { Photo } from '@/components/ui/Photo';
import { EventRow, VenueRow } from '@/components/discovery/rows';
import { useHop, deepEqual } from '@/store/hopStore';
import { friendService } from '@/services/friendService';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { outingService } from '@/services/outingService';
import { savedService } from '@/services/savedService';
import { reportService } from '@/services/reportService';
import { chatService } from '@/services/chatService';
import { shareService } from '@/services/shareService';
import { toast } from '@/services/notificationService';
import { sim } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { getUi } from '@/store/uiStore';
import { hm, plural, when, since } from '@/utils/format';
import type { ChatPref, ReportKind, SavedRef } from '@/types/models';

// ---------------------------------------------------------------- friends out
export function openFriendsOut() { modal.open(<FriendsOut />); }
function FriendsOut() {
  const d = useHop(() => {
    const out = friendService.out();
    const g: Record<string, typeof out> = {};
    out.forEach((f) => { const k = f.venueId || f.eventId || ''; (g[k] ||= []).push(f); });
    return { n: out.length, rows: Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, fs]) => {
      const v = venueService.byId(k); const e = !v ? eventService.byId(k) : undefined; const o = fs[0].outingId ? outingService.get(fs[0].outingId) : undefined;
      return { k, venue: !!v, ids: fs.map((f) => f.user.id), title: v ? v.name : e?.title || '', sub: `${fs.map((f) => f.user.first).join(', ')}${o ? ` · ${o.title}` : ''} · since ${hm(Math.min(...fs.map((f) => f.since)))}` };
    }) };
  }, [], deepEqual);
  return (
    <SheetBody title={`${d.n} friends are out`} testID="friends-out">
      {d.rows.map((r, i) => <Row key={r.k} first={i === 0} onPress={() => { modal.close(); r.venue ? go.venue(r.k) : go.event(r.k); }} lead={<AvatarStack users={r.ids.map((u) => friendService.user(u))} max={3} size={30} />} title={r.title} sub={r.sub} chevron />)}
      <Text style={st.meta}>Only friends who share where they are, or who are on an outing you can see.</Text>
    </SheetBody>
  );
}

// ---------------------------------------------------------------- saved lists (also used to add stops)
export function openSavedLists(colId?: string) { modal.open(<SavedLists initial={colId} />); }
function SavedLists({ initial }: { initial?: string }) {
  const [cid, setCid] = useState<string | undefined>(initial);
  const cols = useHop(() => savedService.collections().map((c) => ({ id: c.id, name: c.name, items: c.items })), [], deepEqual);
  const picking = getUi().picking;
  const c = cid ? cols.find((x) => x.id === cid) : undefined;
  if (!c) {
    return (
      <SheetBody title="Saved" testID="saved-lists">
        {cols.map((x, i) => (
          <Row key={x.id} testID={`saved-col-${x.id}`} first={i === 0} onPress={() => setCid(x.id)} lead={<View style={st.colic}><Icon name="bookmark" size={16} color={C.text2} /></View>}
            title={x.name} sub={x.items.slice(0, 3).map((it) => (it.venueId ? venueService.byId(it.venueId)?.name : eventService.byId(it.eventId)?.title)).filter(Boolean).join(', ') || 'Empty'}
            trail={<Text style={st.mono}>{x.items.length}</Text>} chevron />
        ))}
      </SheetBody>
    );
  }
  return (
    <SheetBody title={c.name} left={<IconButton name="back" bare label="Back" onPress={() => setCid(undefined)} />} testID="saved-list">
      {picking ? <Text style={[st.meta, { marginTop: 0, marginBottom: 8 }]}>Tap one to add it to {outingService.get(picking)?.title}.</Text> : null}
      {c.items.length ? c.items.map((it, i) => it.venueId
        ? <VenueRow key={'v' + it.venueId} id={it.venueId} first={i === 0} onPress={(id) => { modal.close(); go.venue(id); }} />
        : <EventRow key={'e' + it.eventId} id={it.eventId!} first={i === 0} onPress={(id) => { modal.close(); go.event(id); }} />)
        : <Empty>Nothing saved here yet. Tap Save on any place or event.</Empty>}
    </SheetBody>
  );
}

// ---------------------------------------------------------------- save to a list
export function openSaveTo(ref: SavedRef) { modal.open(<SaveTo r={ref} />); }
function SaveTo({ r }: { r: SavedRef }) {
  const cols = useHop(() => savedService.collections().map((c) => ({ id: c.id, name: c.name, n: c.items.length, on: c.items.some((i) => (r.venueId ? i.venueId === r.venueId : i.eventId === r.eventId)) })), [r.venueId, r.eventId], deepEqual);
  const name = r.venueId ? venueService.byId(r.venueId)?.name : eventService.byId(r.eventId)?.title;
  return (
    <SheetBody title={`Save ${name}`} testID="save-to" footer={<Button testID="save-done" title="Done" variant="primary" block onPress={() => modal.close()} />}>
      {cols.map((c, i) => (
        <Row key={c.id} testID={`save-col-${c.id}`} first={i === 0} onPress={() => savedService.set(r, c.id, !c.on)}
          lead={<View style={[st.colic, c.on && { borderColor: C.accent }]}><Icon name={c.on ? 'check' : 'bookmark'} size={16} color={c.on ? C.accent : C.text2} /></View>}
          title={c.name} sub={plural(c.n, 'place')} />
      ))}
    </SheetBody>
  );
}

// ---------------------------------------------------------------- crowd report
export function openReport(venueId: string) {
  const ok = reportService.canReport(venueId);
  if (!ok.ok) { toast(ok.why); return; }
  modal.open(<Report venueId={venueId} />);
}
function Report({ venueId }: { venueId: string }) {
  const [picks, setPicks] = useState<Partial<Record<ReportKind, string>>>({});
  const v = venueService.byId(venueId);
  const kinds = Object.entries(reportService.KINDS) as [ReportKind, { label: string; opts: [string, string][] }][];
  return (
    <SheetBody title={`How’s ${v.name}?`} testID="report-sheet"
      footer={<Button testID="report-send" title="Send report" variant="primary" block disabled={!Object.keys(picks).length} onPress={() => { reportService.add(venueId, picks); modal.close(); toast('Thanks. Your report is in.'); }} />}>
      <Text style={[st.meta, { marginTop: 0, marginBottom: 10 }]}>Anonymous. Helps everyone nearby. Pick what you can see.</Text>
      {kinds.map(([k, def]) => (
        <View key={k} style={{ marginBottom: 12 }}>
          <Text style={st.label}>{def.label}</Text>
          <View style={st.chips}>
            {def.opts.map(([val, l]) => {
              const on = picks[k] === val;
              return (
                <Pressable key={val} testID={`report-${k}-${val}`} onPress={() => setPicks((p) => { const n = { ...p }; if (on) delete n[k]; else n[k] = val; return n; })} style={[st.rchip, on && st.rchipOn]}>
                  <Text style={[st.rchipT, on && { color: C.text }]}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </SheetBody>
  );
}

// ---------------------------------------------------------------- share a place/event: send to an outing chat, or the OS share sheet
export function openShare(ref: { venueId?: string; eventId?: string }) { modal.open(<Share r={ref} />); }
function Share({ r }: { r: { venueId?: string; eventId?: string } }) {
  const list = useHop(() => outingService.mine().live.concat(outingService.mine().upcoming).filter((o) => chatService.canChat(o) && ['before', 'during'].includes(chatService.phase(o))).map((o) => ({ id: o.id, title: o.title, icon: o.icon, sub: `${o.status === 'live' ? 'Live now' : when(o.startsAt)} · ${outingService.going(o.id).length} going` })), [], deepEqual);
  const what = r.venueId ? venueService.byId(r.venueId).name : eventService.byId(r.eventId)!.title;
  const send = (oid: string) => {
    modal.close();
    chatService.post(oid, { kind: 'place', place: r.venueId ? { venueId: r.venueId } : { eventId: r.eventId } });
    if (r.venueId) sim.chatKeen(oid);
    toast(`Sent to ${outingService.get(oid)?.title}`);
  };
  const native = async () => {
    const e = r.eventId ? eventService.byId(r.eventId) : null;
    const v = r.venueId ? venueService.byId(r.venueId) : null;
    const url = e ? `https://hop.app/e/${e.id.replace('ev_', '')}` : `https://hop.app/v/${v!.id}`;
    const msg = e ? `${e.title} — ${when(e.startsAt)} at ${eventService.placeOf(e)?.name}. Keen?` : `${v!.name}, ${v!.suburb}. Keen?`;
    modal.close();
    const res = await shareService.share({ title: what, message: msg, url });
    if (res === 'copied') toast('Link copied');
  };
  return (
    <SheetBody title="Share" testID="share-sheet" footer={<Button testID="share-native" title="Share to another app" icon="share" block onPress={native} />}>
      <Text style={[st.meta, { marginTop: 0, marginBottom: 8 }]}>Send {what} to an outing chat, or share it anywhere else.</Text>
      {list.length ? list.map((o, i) => <Row key={o.id} testID={`share-to-${o.id}`} first={i === 0} onPress={() => send(o.id)} lead={<View style={st.colic}><OutingIcon icon={o.icon} size={18} /></View>} title={o.title} sub={o.sub} trail={<Icon name="send" size={16} color={C.text2} />} />)
        : <Text style={st.meta}>You’re not on any upcoming outings.</Text>}
    </SheetBody>
  );
}

// ---------------------------------------------------------------- who's coming
export function openAttendees(outingId: string) { modal.open(<Attendees id={outingId} />); }
function Attendees({ id }: { id: string }) {
  const d = useHop(() => outingService.members(id).map((a) => ({ id: a.userId, rsvp: a.rsvp, org: a.role === 'organiser' })), [id], deepEqual);
  const org = outingService.isOrganiser(outingService.get(id));
  const groups: [string, string][] = [['going', 'Going'], ['maybe', 'Maybe'], ['invited', 'Haven’t replied'], ['declined', 'Can’t go']];
  return (
    <SheetBody title="Who’s coming" footer={org ? <Button title="Invite more people" icon="plus" variant="primary" block onPress={() => { modal.close(); setTimeout(() => openInvite(id), 250); }} /> : undefined}>
      {groups.map(([k, l]) => {
        const list = d.filter((a) => a.rsvp === k);
        if (!list.length) return null;
        return (
          <Section key={k} title={`${l} · ${list.length}`} style={{ paddingTop: 8 }}>
            {list.map((a, i) => { const u = friendService.user(a.id)!; return <Row key={a.id} first={i === 0} lead={<Avatar user={u} size={36} />} title={`${u.name}${a.id === friendService.meId() ? ' (you)' : ''}`} sub={a.org ? 'Organiser' : u.suburb} />; })}
          </Section>
        );
      })}
    </SheetBody>
  );
}

// ---------------------------------------------------------------- invite: OS share sheet + pick friends
export function openInvite(outingId: string) { modal.open(<Invite id={outingId} />); }
function Invite({ id }: { id: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const d = useHop(() => {
    const o = outingService.get(id)!;
    const already = Object.fromEntries(outingService.members(id).map((a) => [a.userId, a.rsvp]));
    return { title: o.title, icon: o.icon, when: when(o.startsAt), going: outingService.going(id).length, code: o.inviteCode, already,
      friends: friendService.byNights().sort((x, y) => Number(!!already[x.u.id]) - Number(!!already[y.u.id])).slice(0, 16).map(({ u, n }) => ({ id: u.id, n })) };
  }, [id], deepEqual);
  const url = outingService.inviteUrl({ inviteCode: d.code });
  const shareLink = async () => {
    const stops = outingService.stops(id).map((s) => outingService.stopName(s));
    const res = await shareService.share({ title: d.title, message: `${d.title} — ${d.when}${stops.length ? ` · ${stops[0]}` : ''}. In or out?`, url });
    if (res === 'copied') toast('Link copied. Paste it in the group chat.');
  };
  return (
    <SheetBody title="Get people in" testID="invite-sheet"
      footer={<Button testID="invite-send" title={sel.length ? `Invite ${plural(sel.length, 'person', 'people')}` : 'Pick people to invite'} variant="primary" block disabled={!sel.length}
        onPress={() => { outingService.invite(id, sel); modal.close(); toast(`Invited ${sel.map((i) => friendService.user(i)?.first).slice(0, 3).join(', ')}${sel.length > 3 ? ` +${sel.length - 3}` : ''}`); }} />}>
      <View style={st.sharecard}>
        <View style={st.colic}><OutingIcon icon={d.icon} size={20} /></View>
        <View style={{ flex: 1 }}><Text style={st.b}>{d.title}</Text><Text style={st.small}>{d.when} · {d.going} going</Text><Text style={[st.small, { color: C.accent, fontFamily: F.mono }]}>hop.app/i/{d.code}</Text></View>
      </View>
      <BtnRow style={{ marginTop: 10 }}>
        <Button testID="invite-share" title="Share link" icon="share" variant="primary" style={{ flex: 1 }} onPress={shareLink} />
        <Button title="Copy" icon="link" style={{ flex: 1 }} onPress={async () => { await shareService.copy(url); toast('Link copied. Paste it in the group chat.'); }} />
      </BtnRow>
      <Text style={[st.meta, { marginTop: 8 }]}>The link opens the plan and lets them reply Going, Maybe or Can’t go. Messages, WhatsApp, Messenger and Instagram all work through your phone’s share sheet.</Text>
      <Section title="People you go out with">
        {d.friends.map(({ id: uid, n }, i) => {
          const u = friendService.user(uid)!; const a = d.already[uid]; const on = sel.includes(uid);
          return (
            <Row key={uid} testID={`invite-friend-${uid}`} first={i === 0} onPress={a ? undefined : () => setSel((s) => (on ? s.filter((x) => x !== uid) : [...s, uid]))} lead={<Avatar user={u} size={36} />} title={u.name} sub={n ? `${plural(n, 'night')} out together` : u.suburb}
              trail={a ? <Text style={st.small}>{({ going: 'Going', maybe: 'Maybe', invited: 'Invited', declined: 'Can’t go' } as any)[a]}</Text> : <View style={[st.tick, on && { backgroundColor: C.accent, borderColor: C.accent }]}>{on ? <Icon name="check" size={14} color={C.accentInk} strokeWidth={2.4} /> : null}</View>} />
          );
        })}
      </Section>
    </SheetBody>
  );
}

// ---------------------------------------------------------------- chat notifications
export function openChatPrefs(outingId: string) { modal.open(<ChatPrefs id={outingId} />); }
function ChatPrefs({ id }: { id: string }) {
  const cur = useHop(() => chatService.pref(id), [id]);
  const me = friendService.me();
  const opts: [ChatPref, string, string][] = [['all', 'All messages', 'Every message from people on the outing'], ['mentions', 'Mentions only', `Only when someone writes @${me.first}`], ['mute', 'Mute', 'Nothing until you open the chat']];
  return (
    <SheetBody title="Notifications">
      <Text style={[st.meta, { marginTop: 0, marginBottom: 12 }]}>For {outingService.get(id)?.title}. Updates like “Grace added 6 photos” never send a notification on their own.</Text>
      {opts.map(([k, l, s]) => <Choice key={k} on={cur === k} icon={k === 'mute' ? 'bellOff' : 'bell'} title={l} sub={s} onPress={() => { chatService.setPref(id, k); modal.close(); toast(l); }} />)}
    </SheetBody>
  );
}
export function Choice({ on, icon, title, sub, onPress, testID }: { on: boolean; icon: string; title: string; sub: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[st.choice, on && { borderColor: C.accent, backgroundColor: C.accentSoft }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Icon name={icon} size={20} color={on ? C.accent : C.text2} />
      <View style={{ flex: 1 }}><Text style={st.b}>{title}</Text><Text style={st.small}>{sub}</Text></View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- confirm
export function confirm({ title, text, ok, cancel = 'Cancel', danger, onOk }: { title: string; text: string; ok: string; cancel?: string; danger?: boolean; onOk: () => void }) {
  modal.open(
    <SheetBody title={title} footer={<BtnRow><Button title={cancel} style={{ flex: 1 }} onPress={() => modal.close()} /><Button testID="confirm-ok" title={ok} variant={danger ? 'live' : 'primary'} style={{ flex: 1 }} onPress={() => { modal.close(); onOk(); }} /></BtnRow>}>
      <Text style={[st.meta, { marginTop: 0 }]}>{text}</Text>
    </SheetBody>,
  );
}

export const PhotoTile = ({ p, size = 90 }: { p: any; size?: number }) => <Photo p={p} w={200} radius={8} style={{ width: size, height: size }} />;
export const Lines = ({ children }: { children: ReactNode }) => <View style={{ gap: 6 }}>{children}</View>;

const st = StyleSheet.create({
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2, marginTop: 12, lineHeight: 19 },
  mono: { fontFamily: F.mono, fontSize: 12.5, color: C.text3 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.text3, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rchip: { height: 36, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface2, justifyContent: 'center' },
  rchipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  rchipT: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.text2 },
  colic: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  sharecard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2 },
  b: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 1 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, marginBottom: 8 },
});
void since;
