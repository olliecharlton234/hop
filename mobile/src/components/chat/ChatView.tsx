/* Outing chat: one small group chat per outing, for coordinating that night only (no DMs).
   Text, @mentions, replies, reactions, place cards ("I'm keen" / add as stop), live
   location for 30 minutes, "where next?" votes, photos pointed at from the album, and quiet
   system lines. Photos stay in the album; chat lines only point at them. */
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { C, F } from '@/theme';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Icon, ReactionIcon, REACTION_KEYS } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { LivePill } from '@/components/ui/Layout';
import { modal, SheetBody } from '@/components/ui/ModalSheet';
import { Button } from '@/components/ui/Button';
import { Row } from '@/components/ui/Layout';
import { openChatPrefs } from '@/components/sheets/modals';
import { voteWhereNext } from '@/components/outings/WhereNext';
import { useHop, deepEqual } from '@/store/hopStore';
import { chatService } from '@/services/chatService';
import { friendService } from '@/services/friendService';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { photoService } from '@/services/photoService';
import { locationService } from '@/services/locationService';
import { toast } from '@/services/notificationService';
import { sim, chatPreview, sysText, setChatOpen } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { dayDate, distLabel, hm, longDate, metres, plural } from '@/utils/format';
import { useLocation } from '@/hooks/useLocation';

const SYS_ICON: Record<string, string> = { joined: 'check', stop: 'pin', moved: 'walk', next: 'walk', started: 'flag', ended: 'flag', photos: 'image', poll: 'users' };
const nameOf = (id?: string | null) => (id === friendService.meId() ? 'You' : friendService.user(id)?.first || 'Someone');

type UiState = { replyTo: string | null; selected: string | null; attach: boolean };
let ui: UiState = { replyTo: null, selected: null, attach: false };
const subs = new Set<() => void>();
const setChatUi = (p: Partial<UiState>) => { ui = { ...ui, ...p }; subs.forEach((s) => s()); };
function useChatUi() { const [, f] = useState(0); useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []); return ui; }

/** The message list (goes inside the outing sheet) */
export const ChatView = memo(function ChatView({ outingId, onNew }: { outingId: string; onNew?: () => void }) {
  const cu = useChatUi();
  useLocation();
  const d = useHop(() => {
    const o = outingService.get(outingId)!;
    if (!chatService.canChat(o)) return { gate: true as const, pub: o.visibility === 'public', title: o.title };
    const msgs = chatService.messages(outingId);
    return { gate: false as const, phase: chatService.phase(o), pref: chatService.pref(outingId), closes: chatService.closesAt(o), lr: chatService.lastRead(outingId), ids: msgs.map((m) => m.id), n: msgs.length, unread: chatService.unread(outingId) };
  }, [outingId], deepEqual);
  useEffect(() => { setChatOpen(outingId); return () => setChatOpen(null); }, [outingId]);
  useEffect(() => { if (!d.gate) { onNew?.(); if (d.unread) { const t = setTimeout(() => chatService.markRead(outingId), 900); return () => clearTimeout(t); } } }, [d.gate ? 0 : d.n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.gate) {
    return (
      <View style={{ paddingVertical: 24, gap: 12 }}>
        <Text style={st.meta}>The chat is for people on the outing.</Text>
        {d.pub ? <Button variant="primary" title={`Join ${d.title}`} onPress={() => outingService.rsvp(outingId, 'going')} /> : null}
      </View>
    );
  }
  const phaseLine = { before: 'Planning chat · closes 48 hours after the night', during: 'Coordinating tonight', after: `Open till ${dayDate(d.closes)} ${hm(d.closes)}, then saved with the memory`, closed: `Closed ${dayDate(d.closes)} · kept with the memory` }[d.phase];
  const msgs = d.ids.map((id) => chatService.message(id)!).filter(Boolean);
  let lastDay = ''; let unreadMarked = false;
  return (
    <View testID="chat">
      <View style={st.chathead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>{d.phase === 'during' ? <LivePill /> : null}<Text style={st.small} numberOfLines={1}>{phaseLine}</Text></View>
        <Pressable testID="chat-prefs" onPress={() => openChatPrefs(outingId)} style={st.bell}><Icon name={d.pref === 'mute' ? 'bellOff' : 'bell'} size={16} color={C.text2} /><Text style={st.small}>{({ all: 'All', mentions: 'Mentions', mute: 'Muted' } as any)[d.pref]}</Text></Pressable>
      </View>
      {msgs.map((m, i) => {
        const out: React.ReactNode[] = [];
        const day = new Date(m.at).toDateString();
        if (day !== lastDay) { const dd = Math.round((new Date(new Date(now()).toDateString()).getTime() - new Date(day).getTime()) / 864e5); out.push(<Text key={'d' + m.id} style={st.day}>{dd === 0 ? 'Today' : dd === 1 ? 'Yesterday' : longDate(m.at)}</Text>); lastDay = day; }
        if (!unreadMarked && d.lr && m.at > d.lr && m.userId && m.userId !== friendService.meId()) { out.push(<View key={'n' + m.id} style={st.newline}><Text style={st.newT}>NEW</Text></View>); unreadMarked = true; }
        if (m.kind === 'system') { out.push(<SysLine key={m.id} id={m.id} outingId={outingId} />); return out; }
        const prev = msgs[i - 1], next = msgs[i + 1];
        const first = !prev || prev.kind === 'system' || prev.userId !== m.userId || m.at - prev.at > 5 * 6e4 || new Date(prev.at).toDateString() !== day;
        const last = !next || next.userId !== m.userId || next.kind === 'system' || next.at - m.at > 5 * 6e4 || new Date(next.at).toDateString() !== day;
        out.push(<Msg key={m.id} id={m.id} outingId={outingId} first={first} last={last} selected={cu.selected === m.id} closed={d.phase === 'closed'} />);
        return out;
      })}
      {!msgs.length ? <Text style={[st.meta, { paddingVertical: 24 }]}>{d.phase === 'before' ? 'Start with the basics: where, when, who’s keen.' : 'Nothing yet.'}</Text> : null}
    </View>
  );
});

const SysLine = memo(function SysLine({ id, outingId }: { id: string; outingId: string }) {
  const d = useHop(() => { const m = chatService.message(id)!; const ph = m.sys!.type === 'photos' ? (m.sys!.photoIds || []).slice(0, 4) : []; return { type: m.sys!.type, text: sysText(m), at: hm(m.at), ph, count: m.sys!.count || 0 }; }, [id], deepEqual);
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={st.sys}><Icon name={SYS_ICON[d.type] || 'check'} size={13} color={C.text3} /><Text style={st.sysT}>{d.text}</Text><Text style={st.sysAt}>{d.at}</Text></View>
      {d.ph.length ? (
        <Pressable onPress={() => go.album(outingId)} style={st.sysph}>
          {d.ph.map((pid) => <Photo key={pid} p={photoService.get(pid)} w={140} radius={6} style={{ width: 56, height: 56 }} />)}
          {d.count > d.ph.length ? <Text style={st.more}>+{d.count - d.ph.length}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
});

const Msg = memo(function Msg({ id, outingId, first, last, selected, closed }: { id: string; outingId: string; first: boolean; last: boolean; selected: boolean; closed: boolean }) {
  const d = useHop(() => {
    const m = chatService.message(id)!;
    const reply = m.replyTo ? chatService.message(m.replyTo) : undefined;
    return { m: { ...m, reactions: { ...m.reactions } }, mine: m.userId === friendService.meId(), reply: reply ? { id: reply.id, who: nameOf(reply.userId), text: chatPreview(reply).replace(/^[^:]+: /, '').slice(0, 70) } : null };
  }, [id], deepEqual);
  const { m, mine } = d;
  const u = friendService.user(m.userId);
  const rx = Object.entries(m.reactions || {}).filter(([, l]) => l.length);
  let body: React.ReactNode;
  if (m.kind === 'place') body = <><>{m.text ? <Bubble mine={mine} text={m.text} /> : null}</><PlaceCard id={id} outingId={outingId} /></>;
  else if (m.kind === 'location') body = <LocCard id={id} />;
  else if (m.kind === 'poll') body = <PollCard id={id} outingId={outingId} />;
  else if (m.kind === 'photo') body = (
    <Pressable onPress={() => m.photoIds?.[0] && go.photo({ outing: outingId, id: m.photoIds[0] })} style={st.photomsg}>
      {(m.photoIds || []).slice(0, 4).map((pid) => <Photo key={pid} p={photoService.get(pid)} w={300} style={{ width: (m.photoIds!.length > 1 ? 110 : 220), height: (m.photoIds!.length > 1 ? 110 : 220) }} />)}
    </Pressable>
  );
  else body = <Bubble mine={mine} text={m.text || ''} />;
  return (
    <View style={[st.m, mine ? st.me : st.them, { marginTop: first ? 8 : 2 }]} testID={`msg-${id}`}>
      {!mine ? <View style={{ width: 28, alignSelf: 'flex-end' }}>{last ? <Avatar user={u} size={28} /> : null}</View> : null}
      <View style={[st.mb, mine && { alignItems: 'flex-end' }]}>
        {first && !mine ? <Text style={st.mname}>{u?.first}</Text> : null}
        {d.reply ? <Text numberOfLines={1} style={st.quote}><Text style={{ fontFamily: F.bodyBold, color: C.text }}>{d.reply.who}</Text> {d.reply.text}</Text> : null}
        <Pressable onPress={() => setChatUi({ selected: selected ? null : id })} accessibilityHint="Tap to react or reply">{body}</Pressable>
        {rx.length ? (
          <View style={st.rx}>{rx.map(([k, l]) => (
            <Pressable key={k} onPress={() => chatService.react(id, k)} style={[st.rxB, l.includes(friendService.meId()) && { borderColor: C.accent }]}><ReactionIcon k={k} size={14} color={C.text} />{l.length > 1 ? <Text style={st.rxN}>{l.length}</Text> : null}</Pressable>
          ))}</View>
        ) : null}
        {selected && !closed ? (
          <View style={st.msgbar} testID="msgbar">
            {REACTION_KEYS.map((k) => <Pressable key={k} testID={`react-${k}`} accessibilityLabel={`React ${k}`} onPress={() => { chatService.react(id, k); setChatUi({ selected: null }); }} style={st.rxPick}><ReactionIcon k={k} size={20} color={C.text} /></Pressable>)}
            <Pressable testID="reply" onPress={() => setChatUi({ replyTo: id, selected: null })} style={st.rp}><Icon name="back" size={14} color={C.text} /><Text style={st.rpT}>Reply</Text></Pressable>
          </View>
        ) : null}
        {last ? <Text style={st.mt}>{hm(m.at)}</Text> : null}
      </View>
    </View>
  );
});
function Bubble({ mine, text }: { mine: boolean; text: string }) {
  const me = friendService.me().first.toLowerCase();
  const parts = text.split(/(@\w+)/g);
  return (
    <View style={[st.bubble, mine ? st.bubbleMe : st.bubbleThem]}>
      <Text style={[st.bt, mine && { color: C.accentInk }]}>
        {parts.map((p, i) => (p.startsWith('@') ? <Text key={i} style={{ fontFamily: F.bodyBold, color: mine ? C.accentInk : p.slice(1).toLowerCase() === me ? C.accent : C.text }}>{p}</Text> : p))}
      </Text>
    </View>
  );
}
function PlaceCard({ id, outingId }: { id: string; outingId: string }) {
  const d = useHop(() => {
    const m = chatService.message(id)!; const o = outingService.get(outingId)!;
    if (m.place?.eventId) { const e = eventService.byId(m.place.eventId); const p = e && eventService.placeOf(e); return e ? { ev: true as const, id: e.id, img: e.img, title: e.title, sub: `${p?.name} · ${dayDate(e.startsAt)} ${hm(e.startsAt)} · ${e.priceLabel}`, canAdd: outingService.isOrganiser(o) && o.status !== 'ended' } : null; }
    const v = venueService.byId(m.place!.venueId!); const act = venueService.activity(v.id);
    const onRoute = outingService.stops(outingId).some((s) => s.venueId === v.id);
    const keen = m.keen || [];
    return { ev: false as const, id: v.id, img: v.img, title: v.name, sub: `${v.suburb} · ${distLabel(metres(locationService.current(), v))} away${act.hot || act.friends.length ? ` · ${act.label}` : ''}`, keen, onRoute, canAdd: outingService.isOrganiser(o) && o.status !== 'ended' && !onRoute, ended: o.status === 'ended' };
  }, [id, outingId], deepEqual);
  if (!d) return null;
  return (
    <View style={st.card}>
      <View style={st.ctop}><Photo p={{ id: d.id, u: d.img || undefined }} w={140} radius={8} style={{ width: 52, height: 52 }} /><View style={{ flex: 1 }}><Text style={st.cb}>{d.title}</Text><Text style={st.cs}>{d.sub}</Text>
        {!d.ev && d.keen.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}><AvatarStack users={d.keen.map((u) => friendService.user(u))} max={4} size={18} border={C.surface2} /><Text style={st.cs}>{d.keen.length} keen</Text></View> : null}</View></View>
      <View style={st.cbtns}>
        {d.ev ? (
          <>
            <CardBtn title="View event" onPress={() => go.event(d.id)} />
            {d.canAdd ? <CardBtn title="Add as stop" pri onPress={() => { outingService.addEventStop(outingId, d.id); toast(`${d.title} added to the route`); }} /> : null}
          </>
        ) : (
          <>
            <CardBtn icon="map" title="View" onPress={() => go.venue(d.id)} />
            {d.onRoute ? <CardBtn icon="check" title="On the route" /> : d.canAdd ? <CardBtn testID="place-add" icon="plus" pri title="Add as stop" onPress={() => { outingService.addStop(outingId, d.id); toast(`${d.title} added to the route`); }} />
              : !d.ended ? <CardBtn testID="keen" pri={d.keen.includes(friendService.meId())} icon={d.keen.includes(friendService.meId()) ? 'check' : undefined} title={d.keen.includes(friendService.meId()) ? 'Keen' : 'I’m keen'} onPress={() => chatService.keen(id)} /> : null}
          </>
        )}
      </View>
    </View>
  );
}
function LocCard({ id }: { id: string }) {
  const d = useHop(() => { const m = chatService.message(id)!; return { userId: m.userId!, loc: m.loc!, live: m.loc!.until > now(), mine: m.userId === friendService.meId() }; }, [id], deepEqual);
  const u = friendService.user(d.userId)!;
  const left = Math.max(1, Math.round((d.loc.until - now()) / 6e4));
  return (
    <View style={[st.card, !d.live && { opacity: 0.6 }]}>
      <View style={st.minimap}><View style={{ borderRadius: 16, borderWidth: 3, borderColor: C.blue }}><Avatar user={u} size={26} /></View></View>
      <View style={[st.ctop, { paddingTop: 8 }]}><View style={{ flex: 1 }}><Text style={st.cb}>{d.mine ? 'You shared your location' : `${u.first} shared their location`}</Text><Text style={st.cs}>{d.loc.label} · {distLabel(metres(locationService.current(), d.loc))} away · {d.live ? `live for ${left} more min` : 'sharing ended'}</Text></View></View>
      <View style={st.cbtns}>{d.live ? <CardBtn icon="map" title="View on map" onPress={() => go.home()} /> : null}{d.mine && d.live ? <CardBtn title="Stop sharing" onPress={() => { chatService.stopSharing(id); toast('Stopped sharing your location'); }} /> : null}</View>
    </View>
  );
}
function PollCard({ id, outingId }: { id: string; outingId: string }) {
  const d = useHop(() => { const m = chatService.message(id)!; return { q: m.poll!.q, closed: m.poll!.closed, options: m.poll!.options.map((o) => ({ venueId: o.venueId, votes: [...o.votes] })), org: outingService.isOrganiser(outingService.get(outingId)) }; }, [id, outingId], deepEqual);
  const total = d.options.reduce((n, op) => n + op.votes.length, 0) || 1;
  const lead = d.options.slice().sort((a, b) => b.votes.length - a.votes.length)[0];
  return (
    <View style={[st.card, { padding: 12, gap: 6 }]} testID="poll">
      <Text style={st.cb}>{d.q}</Text>
      {d.options.map((op, k) => {
        const mineV = op.votes.includes(friendService.meId());
        return (
          <Pressable key={op.venueId} testID={`vote-${k}`} disabled={d.closed} onPress={() => chatService.vote(id, k)} style={[st.opt, mineV && { borderColor: C.accent }]}>
            <View style={[st.optBar, { width: `${Math.round((op.votes.length / total) * 100)}%` }]} />
            <Text style={st.optT} numberOfLines={1}>{venueService.byId(op.venueId)?.name}</Text>
            <AvatarStack users={op.votes.map((u) => friendService.user(u))} max={3} size={16} border={C.surface2} />
            <Text style={st.optN}>{op.votes.length}</Text>
          </Pressable>
        );
      })}
      {!d.closed && d.org && lead?.votes.length ? <CardBtn testID="close-poll" pri title={`Go with ${venueService.byId(lead.venueId)?.name}`} onPress={() => { const win = chatService.closePoll(id); outingService.addStop(outingId, win.venueId); toast(`${venueService.byId(win.venueId).name} is on the route`); }} /> : null}
      {d.closed ? <Text style={st.cs}>Voting closed</Text> : null}
    </View>
  );
}
function CardBtn({ title, onPress, pri, icon, testID }: { title: string; onPress?: () => void; pri?: boolean; icon?: string; testID?: string }) {
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={[st.cbtn, pri && { backgroundColor: C.accentSoft, borderColor: C.accent }]}>
      {icon ? <Icon name={icon} size={15} color={pri ? C.accent : C.text} /> : null}<Text style={[st.cbtnT, pri && { color: C.accent }]}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- composer (sheet footer)
export const Composer = memo(function Composer({ outingId, onSent }: { outingId: string; onSent?: () => void }) {
  const cu = useChatUi();
  const [text, setText] = useState('');
  const d = useHop(() => { const o = outingService.get(outingId)!; return { can: chatService.canChat(o), phase: chatService.phase(o), closes: chatService.closesAt(o) }; }, [outingId], deepEqual);
  const reply = cu.replyTo ? chatService.message(cu.replyTo) : undefined;
  if (!d.can) return null;
  if (d.phase === 'closed') return <View style={st.composer}><Text style={[st.meta, { padding: 8 }]}>This chat closed {dayDate(d.closes)}. Plan the next one to start a new chat.</Text></View>;
  const hint = { before: 'Where, when, who’s keen…', during: 'Where are you? Heading where?', after: 'Last night was…' }[d.phase as 'before' | 'during' | 'after'];
  const send = () => {
    const t = text.trim(); if (!t) return;
    chatService.post(outingId, { text: t, replyTo: cu.replyTo });
    setText(''); setChatUi({ replyTo: null, attach: false });
    sim.chatReply(outingId, t);
    onSent?.();
  };
  const close = () => setChatUi({ attach: false });
  return (
    <View style={st.composer}>
      {reply ? <View style={st.replying}><Text numberOfLines={1} style={[st.small, { flex: 1 }]}>Replying to <Text style={{ fontFamily: F.bodyBold, color: C.text }}>{nameOf(reply.userId)}</Text> {chatPreview(reply).replace(/^[^:]+: /, '').slice(0, 50)}</Text><Pressable onPress={() => setChatUi({ replyTo: null })} hitSlop={8}><Icon name="close" size={16} color={C.text2} /></Pressable></View> : null}
      {cu.attach ? (
        <View style={st.tray}>
          {d.phase === 'during' ? <TrayBtn icon="camera" label="Take a photo" onPress={() => { close(); go.camera(outingId); }} /> : null}
          <TrayBtn icon="image" label="Photo from album" onPress={() => { close(); openAlbumPick(outingId); }} />
          <TrayBtn testID="tray-place" icon="pin" label="Share a place" onPress={() => { close(); openPlacePicker(outingId); }} />
          <TrayBtn testID="tray-location" icon="locate" label="Share my location" onPress={() => { close(); shareLocation(outingId); }} />
          {d.phase !== 'after' ? <TrayBtn testID="tray-poll" icon="users" label="Vote: where next?" onPress={() => { close(); voteWhereNext(outingId); }} /> : null}
        </View>
      ) : null}
      <View style={st.crow}>
        <Pressable testID="chat-attach" accessibilityLabel="Share a photo, place or location" onPress={() => setChatUi({ attach: !cu.attach })} style={[st.cplus, cu.attach && { backgroundColor: C.surface3 }]}><Icon name="plus" size={20} color={C.text} /></Pressable>
        <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder={hint} placeholderTextColor={C.text3} style={st.input} maxLength={300} returnKeyType="send" onSubmitEditing={send} blurOnSubmit={false} />
        <Pressable testID="chat-send" accessibilityLabel="Send" onPress={send} style={st.csend}><Icon name="send" size={18} color={C.accentInk} /></Pressable>
      </View>
    </View>
  );
});
function TrayBtn({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID?: string }) {
  return <Pressable testID={testID} onPress={onPress} style={st.trayB}><Icon name={icon} size={20} color={C.text} /><Text style={st.trayT}>{label}</Text></Pressable>;
}

function openAlbumPick(outingId: string) { modal.open(<AlbumPick outingId={outingId} />); }
function AlbumPick({ outingId }: { outingId: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const ids = useHop(() => photoService.album(outingId).slice().reverse().slice(0, 60).map((p) => p.id), [outingId], deepEqual);
  return (
    <SheetBody title="From the album" footer={ids.length ? <Button variant="primary" block disabled={!sel.length} title={sel.length ? `Send ${plural(sel.length, 'photo')}` : 'Pick photos to point people to'} onPress={() => { modal.close(); chatService.post(outingId, { kind: 'photo', photoIds: sel }); }} /> : undefined}>
      {ids.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
          {ids.map((pid) => { const on = sel.includes(pid); return (
            <Pressable key={pid} onPress={() => setSel((s) => (on ? s.filter((x) => x !== pid) : [...s, pid]))} style={{ width: '32.6%', aspectRatio: 1 }}>
              <Photo p={photoService.get(pid)} w={200} style={{ flex: 1, opacity: on ? 0.6 : 1 }} />
              <View style={[st.pickTick, on && { backgroundColor: C.accent, borderColor: C.accent }]}>{on ? <Icon name="check" size={14} color={C.accentInk} /> : null}</View>
            </Pressable>
          ); })}
        </View>
      ) : <Text style={st.meta}>No photos in the album yet. Take one and it lands here for everyone.</Text>}
    </SheetBody>
  );
}
function openPlacePicker(outingId: string) { modal.open(<PlacePicker outingId={outingId} />); }
function PlacePicker({ outingId }: { outingId: string }) {
  const d = useHop(() => {
    const o = outingService.get(outingId)!; const st0 = outingService.stops(outingId);
    const from = (o.live ? outingService.placeOf(st0[o.live.current]) : st0[0] && outingService.placeOf(st0[0])) || { ...locationService.current(), name: 'you' };
    return { from: from.name, list: venueService.all().filter((v) => v.cat !== 'spot').map((v) => ({ id: v.id, d: metres(from, v) })).sort((a, b) => a.d - b.d).slice(0, 10).map((x) => { const a = venueService.activity(x.id); return { id: x.id, sub: `${distLabel(x.d)} · ${a.label}${a.friends.length ? ` · ${a.friends.length} friends` : ''}` }; }) };
  }, [outingId], deepEqual);
  return (
    <SheetBody title="Share a place" testID="place-picker">
      <Text style={[st.meta, { marginBottom: 8 }]}>Close to {d.from}. Or tap any venue on the map and choose Share.</Text>
      {d.list.map((x, i) => (
        <Row key={x.id} testID={`share-place-${x.id}`} first={i === 0} onPress={() => { modal.close(); chatService.post(outingId, { kind: 'place', place: { venueId: x.id } }); sim.chatKeen(outingId); }}
          lead={<Photo p={{ id: x.id, u: venueService.byId(x.id).img }} w={120} radius={9} style={{ width: 44, height: 44 }} />} title={venueService.byId(x.id).name} sub={x.sub} trail={<Icon name="send" size={16} color={C.text2} />} />
      ))}
    </SheetBody>
  );
}
async function shareLocation(outingId: string) {
  // one fix, only when you tap this; visible to this outing for 30 minutes
  if (locationService.status().mode !== 'device' && locationService.status().permission !== 'denied') await locationService.locate();
  const p = locationService.current();
  const near = venueService.all().map((v) => ({ v, d: metres(p, v) })).sort((a, b) => a.d - b.d)[0];
  const label = near && near.d < 250 ? `Near ${near.v.name}` : near ? `${near.v.address.replace(/^[\d/-]+\s*/, '')}, ${near.v.suburb}` : 'Current location';
  chatService.post(outingId, { kind: 'location', loc: { lat: p.lat, lng: p.lng, label, until: now() + 30 * 6e4 } });
  toast('Sharing your location with this outing for 30 minutes');
}

const st = StyleSheet.create({
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2, lineHeight: 19 },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.text2 },
  chathead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  bell: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.line },
  day: { alignSelf: 'center', fontFamily: F.bodySemi, fontSize: 11.5, color: C.text3, marginTop: 14, marginBottom: 2 },
  newline: { borderTopWidth: 1, borderTopColor: C.accent, marginVertical: 10, alignItems: 'center' },
  newT: { marginTop: -8, backgroundColor: C.surface, paddingHorizontal: 6, fontFamily: F.monoSemi, fontSize: 10, color: C.accent },
  sys: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', maxWidth: '92%' },
  sysT: { fontFamily: F.body, fontSize: 12.5, color: C.text2, flexShrink: 1 },
  sysAt: { fontFamily: F.mono, fontSize: 10.5, color: C.text3 },
  sysph: { flexDirection: 'row', gap: 3, alignSelf: 'center', marginTop: 6, alignItems: 'center' },
  more: { fontFamily: F.bodyBold, fontSize: 12, color: C.text2, marginLeft: 4 },
  m: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  me: { justifyContent: 'flex-end' },
  them: { justifyContent: 'flex-start' },
  mb: { maxWidth: '80%', gap: 3 },
  mname: { fontFamily: F.bodySemi, fontSize: 11.5, color: C.text3, marginLeft: 4 },
  quote: { fontFamily: F.body, fontSize: 12, color: C.text2, paddingHorizontal: 10, paddingVertical: 5, borderLeftWidth: 2, borderLeftColor: C.lineStrong, backgroundColor: C.surface2, borderRadius: 6, maxWidth: 260 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe: { backgroundColor: C.accent, borderBottomRightRadius: 5 },
  bubbleThem: { backgroundColor: C.surface3, borderBottomLeftRadius: 5 },
  bt: { fontFamily: F.body, fontSize: 15, lineHeight: 20, color: C.text },
  rx: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  rxB: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong },
  rxN: { fontFamily: F.bodySemi, fontSize: 11.5, color: C.text2 },
  msgbar: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4, borderRadius: 14, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineStrong },
  rxPick: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  rp: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 32, borderLeftWidth: 1, borderLeftColor: C.line },
  rpT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text },
  mt: { fontFamily: F.mono, fontSize: 10.5, color: C.text3, marginHorizontal: 4 },
  photomsg: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderRadius: 12, overflow: 'hidden', maxWidth: 224 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface2, overflow: 'hidden', width: 270 },
  ctop: { flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' },
  cb: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  cs: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 2 },
  cbtns: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 10, flexWrap: 'wrap' },
  cbtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: C.lineStrong },
  cbtnT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text },
  minimap: { height: 70, backgroundColor: '#14161a', alignItems: 'center', justifyContent: 'center' },
  opt: { height: 38, borderRadius: 9, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, overflow: 'hidden' },
  optBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,173,31,0.16)' },
  optT: { flex: 1, fontFamily: F.bodySemi, fontSize: 14, color: C.text },
  optN: { fontFamily: F.monoSemi, fontSize: 12.5, color: C.text },
  composer: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 8 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trayB: { width: '31.8%', alignItems: 'center', gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  trayT: { fontFamily: F.bodySemi, fontSize: 11.5, color: C.text2, textAlign: 'center' },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cplus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.ink, paddingHorizontal: 14, color: C.text, fontFamily: F.body, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any,
  csend: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  pickTick: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
