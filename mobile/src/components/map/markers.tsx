/* Map pins, drawn as React Native views (same look on iOS, Android and web).
   Each returns the view plus its fixed size + anchor so the coordinate lands on the pin. */
import { memo, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, CAT_COLOR, F, LV } from '@/theme';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Photo } from '@/components/ui/Photo';
import { EventGlyph, Icon, OutingIcon, VenueGlyph } from '@/components/ui/Icon';
import type { User, Photo as PhotoT } from '@/types/models';

export type PinBox = { width: number; height: number; anchorX: number; anchorY: number };
const LABEL_W = 200;
const shadow = { textShadowColor: '#000', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } };

// ---------------------------------------------------------------- venue
export const venueBox = (label: boolean): PinBox => (label ? { width: 34 + LABEL_W, height: 40, anchorX: 17, anchorY: 22 } : { width: 40, height: 40, anchorX: 20, anchorY: 22 });
export const VenuePin = memo(function VenuePin({ cat, lv, hot, on, label, name, status, friend, friendMore, hasEvent, photo, dim }: {
  cat: string; lv: number; hot: boolean; on: boolean; label: boolean; name: string; status?: string; friend?: User; friendMore?: number; hasEvent?: boolean; photo?: PhotoT; dim?: boolean;
}) {
  const ring = hot ? LV[Math.max(2, lv)] : C.lineStrong;
  const size = on ? 30 : hot ? 28 : 24;
  const cx = label ? 17 : 20;
  return (
    <View style={{ flex: 1, opacity: dim ? 0.35 : 1 }}>
      <View style={[st.vcore, { left: cx - size / 2, top: 22 - size / 2, width: size, height: size, borderRadius: size / 2, borderColor: on ? C.accent : ring, borderWidth: hot || on ? 2 : 1.5, backgroundColor: on ? C.accent : C.surface }]}>
        <VenueGlyph cat={cat} size={on ? 15 : 14} color={on ? C.accentInk : CAT_COLOR[cat] || C.text2} />
      </View>
      {friend ? (
        <View style={[st.vf, { left: cx + 1, top: 0 }]}>
          <View style={{ borderRadius: 12, borderWidth: 2, borderColor: C.ink }}><Avatar user={friend} size={18} /></View>
          {friendMore ? <Text style={st.vfMore}>+{friendMore}</Text> : null}
        </View>
      ) : null}
      {hasEvent ? <View style={[st.vev, { left: cx + 6, top: 27 }]} /> : null}
      {photo ? <View style={[st.vph, { left: cx - 20, top: 26 }]}><Photo p={photo} w={60} style={StyleSheet.absoluteFill} /></View> : null}
      {label ? (
        <View style={[st.vlabel, { left: 36 }]} pointerEvents="none">
          <Text numberOfLines={1} style={[st.lb, shadow]}>{name}</Text>
          {status ? <Text numberOfLines={1} style={[st.le, shadow, hot && { color: LV[Math.max(2, lv)] }]}>{status}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- public event: diamond
export const eventBox = (label: boolean): PinBox => (label ? { width: 30 + LABEL_W, height: 34, anchorX: 15, anchorY: 17 } : { width: 30, height: 34, anchorX: 15, anchorY: 17 });
export const EventPin = memo(function EventPin({ cat, now, on, label, title, when }: { cat: string; now: boolean; on: boolean; label: boolean; title: string; when: string }) {
  const filled = now || on;
  return (
    <View style={{ flex: 1 }}>
      <View style={[st.ed, { left: 15 - 10, top: 17 - 10, backgroundColor: filled ? C.event : C.ink, transform: [{ rotate: '45deg' }, { scale: on ? 1.2 : 1 }] }]}>
        <View style={{ transform: [{ rotate: '-45deg' }] }}><EventGlyph cat={cat} size={12} color={filled ? '#04161a' : C.event} /></View>
      </View>
      {label ? (
        <View style={[st.vlabel, { left: 32 }]} pointerEvents="none">
          <Text numberOfLines={1} style={[st.lb, shadow]}>{title}</Text>
          <Text numberOfLines={1} style={[st.le, shadow, { color: C.event, fontFamily: F.monoSemi }]}>{when}</Text>
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- a friend's outing: host face
export const friendOutingBox = (label: boolean): PinBox => (label ? { width: 48 + LABEL_W, height: 48, anchorX: 24, anchorY: 24 } : { width: 48, height: 48, anchorX: 24, anchorY: 24 });
export const FriendOutingPin = memo(function FriendOutingPin({ host, icon, live, pub, label, title, sub, small }: { host: User; icon: string; live: boolean; pub: boolean; label: boolean; title: string; sub: string; small?: boolean }) {
  const ring = live ? C.live : pub ? C.text2 : C.text;
  const s = small ? 0.62 : 1;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', left: 24 - 18 * s, top: 24 - 18 * s, width: 36 * s, height: 36 * s, alignItems: 'center', justifyContent: 'center' }}>
        {live ? <View style={[StyleSheet.absoluteFill, { margin: -4 * s, borderRadius: 30, borderWidth: 2, borderColor: 'rgba(255,75,58,0.45)' }]} /> : null}
        <View style={{ borderRadius: 20, borderWidth: 2.5, borderColor: ring }}><Avatar user={host} size={30 * s} /></View>
        <View style={[st.oe, { transform: [{ scale: s }] }]}><OutingIcon icon={icon} size={12} /></View>
      </View>
      {label ? (
        <View style={[st.flabel, { left: 48 }]} pointerEvents="none">
          <Text numberOfLines={1} style={st.fb}>{title}</Text>
          <Text numberOfLines={1} style={[st.fe, live && { color: '#ff8a7d' }]}>{sub}</Text>
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- neighbourhood label
export const areaBox: PinBox = { width: 170, height: 64, anchorX: 85, anchorY: 22 };
export const AreaLabel = memo(function AreaLabel({ name, words, lv, quiet, friends, bits }: { name: string; words: string; lv: number; quiet: boolean; friends: User[]; bits: string }) {
  const colors = ['#8fd3f0', '#8fe3bb', LV[2], LV[3], '#ff7a6e'];
  return (
    <View style={[{ flex: 1, alignItems: 'center', paddingTop: 2 }, quiet && { opacity: 0.55 }]} pointerEvents="none">
      <Text numberOfLines={1} style={[st.ab, shadow, quiet && { fontSize: 11, color: C.text2 }, lv >= 3 && { color: '#fff6e6' }]}>{name.toUpperCase()}</Text>
      <Text numberOfLines={1} style={[st.ae, shadow, { color: colors[lv] || C.text2 }]}>{words}</Text>
      {bits ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          {friends.length ? <AvatarStack users={friends.slice(0, 3)} size={16} border={C.ink} /> : null}
          <Text numberOfLines={1} style={[st.ai, shadow]}>{bits}</Text>
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- friends grouped at a place: "Jack + 4"
export const chipBox: PinBox = { width: 190, height: 34, anchorX: 95, anchorY: 17 };
export const FriendChip = memo(function FriendChip({ users, lead, more, place }: { users: User[]; lead: string; more: number; place: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={st.chip}>
        <AvatarStack users={users.slice(0, 3)} size={22} border={C.ink} />
        <View style={{ maxWidth: 110 }}>
          <Text numberOfLines={1} style={st.fb}>{lead}{more ? ` + ${more}` : ''}</Text>
          <Text numberOfLines={1} style={[st.fe, { fontFamily: F.bodySemi }]}>{place}</Text>
        </View>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------- route stops
export type StopState = 'plan' | 'mini' | 'done' | 'now' | 'next' | 'later' | 'memory';
export const stopBox = (state: StopState, label: boolean): PinBox => {
  const s = state === 'memory' ? 46 : state === 'mini' ? 22 : 30;
  const pad = 14; // room for the NOW/NEXT tag and pulse
  const w = s + pad * 2 + (label ? LABEL_W : 0), h = s + pad * 2;
  return { width: w, height: h, anchorX: pad + s / 2, anchorY: pad + s / 2 };
};
export const StopPin = memo(function StopPin({ n, state, label, name, sub, isEvent, photo, photoCount }: { n: number; state: StopState; label: boolean; name: string; sub: string; isEvent?: boolean; photo?: PhotoT; photoCount?: number }) {
  const s = state === 'memory' ? 46 : state === 'mini' ? 22 : 30;
  const pad = 14;
  const bg = state === 'now' ? C.live : state === 'done' ? C.surface3 : state === 'later' ? C.ink : C.accent;
  const fg = state === 'now' ? '#fff' : state === 'done' ? C.text2 : state === 'later' ? C.accent : C.accentInk;
  const border = state === 'done' ? C.lineStrong : state === 'later' ? C.accent : C.ink;
  return (
    <View style={{ flex: 1 }}>
      {state === 'now' ? <View style={{ position: 'absolute', left: pad - 7, top: pad - 7, width: s + 14, height: s + 14, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,75,58,0.45)' }} /> : null}
      {state === 'memory' ? (
        <View style={{ position: 'absolute', left: pad, top: pad, width: s, height: s }}>
          <Photo p={photo} w={120} radius={10} style={{ width: s, height: s, borderWidth: 2, borderColor: C.accent }} />
          <View style={[st.sn, { left: -7, top: -7, width: 20, height: 20, borderRadius: 6, backgroundColor: C.accent }]}><Text style={[st.snT, { fontSize: 11, color: C.accentInk }]}>{n}</Text></View>
          {photoCount ? <View style={st.pc}><Text style={st.pcT}>{photoCount}</Text></View> : null}
        </View>
      ) : (
        <View style={[st.sn, { left: pad, top: pad, width: s, height: s, borderRadius: state === 'mini' ? 7 : 9, backgroundColor: bg, borderColor: border, opacity: state === 'mini' ? 0.92 : 1 }]}>
          {state === 'done' ? <Icon name="check" size={14} color={fg} strokeWidth={2.4} /> : <Text style={[st.snT, { color: fg, fontSize: state === 'mini' ? 12 : 15 }]}>{n}</Text>}
        </View>
      )}
      {state === 'now' || state === 'next' ? (
        <View style={[st.tag, { left: pad + s / 2 - 17, top: 0, backgroundColor: state === 'now' ? C.live : C.accent }]}><Text style={[st.tagT, { color: state === 'now' ? '#fff' : C.accentInk }]}>{state === 'now' ? 'NOW' : 'NEXT'}</Text></View>
      ) : null}
      {label ? (
        <View style={[st.slabel, { left: pad + s + 6, top: pad + s / 2 - 16 }, state === 'done' && { opacity: 0.6 }]} pointerEvents="none">
          <Text numberOfLines={1} style={st.fb}>{name}</Text>
          <Text numberOfLines={1} style={[st.fe, { color: isEvent ? C.event : C.accent }]}>{sub}</Text>
        </View>
      ) : null}
    </View>
  );
});
/** Direction chevron at the middle of a route leg */
export const Chevron = ({ angle, done }: { angle: number; done?: boolean }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${angle}deg` }] }}>
    <View style={{ width: 0, height: 0, borderLeftWidth: 7, borderTopWidth: 5, borderBottomWidth: 5, borderLeftColor: done ? '#59606c' : C.accent, borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
  </View>
);

// ---------------------------------------------------------------- an outing's first stop (home map)
export const outingBox = (label: boolean): PinBox => ({ width: 40 + (label ? LABEL_W : 0), height: 46, anchorX: 20, anchorY: 44 });
export const OutingPin = memo(function OutingPin({ icon, pub, label, title, when }: { icon: string; pub: boolean; label: boolean; title: string; when: string }) {
  const c = pub ? C.text : C.accent;
  return (
    <View style={{ flex: 1 }}>
      <View style={[st.ope, { borderColor: c }]}><OutingIcon icon={icon} size={18} color={C.accent} /></View>
      <View style={{ position: 'absolute', left: 15, top: 36, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c }} />
      {label ? (
        <View style={[st.flabel, { left: 44, top: 4 }]} pointerEvents="none">
          <Text numberOfLines={1} style={st.fb}>{title}</Text>
          <Text numberOfLines={1} style={[st.fe, { color: C.accent }]}>{when}</Text>
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- shared location (temporary, opt-in)
export const locBox = (label: boolean): PinBox => ({ width: 44 + (label ? LABEL_W : 0), height: 44, anchorX: 22, anchorY: 22 });
export const LocPin = memo(function LocPin({ user, label, sub }: { user: User; label: boolean; sub: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', left: 2, top: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(77,163,255,0.18)' }} />
      <View style={{ position: 'absolute', left: 6, top: 6, borderRadius: 20, borderWidth: 3, borderColor: C.blue }}><Avatar user={user} size={26} /></View>
      {label ? (
        <View style={[st.flabel, { left: 46, borderColor: C.blue }]} pointerEvents="none">
          <Text numberOfLines={1} style={st.fb}>{user.first}</Text>
          <Text numberOfLines={1} style={[st.fe, { fontFamily: F.bodySemi }]}>{sub}</Text>
        </View>
      ) : null}
    </View>
  );
});

export const meBox: PinBox = { width: 30, height: 30, anchorX: 15, anchorY: 15 };
export const MeDot = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(77,163,255,0.22)' }} />
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, borderWidth: 3, borderColor: '#fff' }} />
  </View>
);

export const Wrap = ({ children }: { children: ReactNode }) => <>{children}</>;

const st = StyleSheet.create({
  vcore: { position: 'absolute', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  vf: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  vfMore: { marginLeft: -4, fontFamily: F.bodyBold, fontSize: 9.5, color: C.text, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  vev: { position: 'absolute', width: 10, height: 10, backgroundColor: C.event, borderWidth: 2, borderColor: C.ink, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  vph: { position: 'absolute', width: 16, height: 16, borderRadius: 4, overflow: 'hidden', borderWidth: 1.5, borderColor: C.text },
  vlabel: { position: 'absolute', top: 22 - 15, width: LABEL_W - 4 },
  lb: { fontFamily: F.bodySemi, fontSize: 12, color: C.text },
  le: { fontFamily: F.bodySemi, fontSize: 10.5, color: C.text2, marginTop: 1 },
  ed: { position: 'absolute', width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.event, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 },
  oe: { position: 'absolute', right: -6, bottom: -5, width: 19, height: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 6 },
  flabel: { position: 'absolute', top: 24 - 17, maxWidth: LABEL_W - 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 6 },
  fb: { fontFamily: F.bodyBold, fontSize: 12, color: C.text },
  fe: { fontFamily: F.monoSemi, fontSize: 10, color: C.text2, marginTop: 1 },
  ab: { fontFamily: F.display, fontSize: 13, letterSpacing: 1.8, color: C.text },
  ae: { fontFamily: F.bodySemi, fontSize: 11.5, marginTop: 1 },
  ai: { fontFamily: F.bodySemi, fontSize: 11, color: C.text2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 9, paddingVertical: 3, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 18 },
  sn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 5, elevation: 4 },
  snT: { fontFamily: F.displayBlack, color: C.accentInk },
  tag: { position: 'absolute', width: 34, paddingVertical: 2, borderRadius: 3, alignItems: 'center' },
  tagT: { fontFamily: F.monoSemi, fontSize: 9, letterSpacing: 0.5 },
  slabel: { position: 'absolute', maxWidth: LABEL_W - 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 6 },
  pc: { position: 'absolute', right: -6, bottom: -6, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 4 },
  pcT: { fontFamily: F.monoSemi, fontSize: 10, color: C.text },
  ope: { position: 'absolute', left: 3, top: 3, width: 34, height: 34, borderRadius: 10, borderWidth: 2, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
});
