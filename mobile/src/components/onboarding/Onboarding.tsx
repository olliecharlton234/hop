/* First open: three short screens, then straight into the map.
   1. See where the city is alive. 2. Plan nights with friends. 3. Keep the night as a memory.
   Never shown to someone who arrived through a link (they land on what was shared). */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C, F, LV } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/ui/Photo';
import { AvatarStack } from '@/components/ui/Avatar';
import { venueService } from '@/services/venueService';
import { friendService } from '@/services/friendService';
import { analytics } from '@/services/analytics';
import { setPrefs } from '@/store/prefs';

const PAGES = [
  { title: 'See where the city is alive.', text: 'The map shows how busy every neighbourhood is right now, and how it’s shaping up for later tonight.' },
  { title: 'Plan nights with friends.', text: 'Pick the stops, send one link to the group chat, and vote on where to go next.' },
  { title: 'Keep the night as a shared memory.', text: 'Everyone’s photos land in one album, laid out along the route you took.' },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const sc = useRef<ScrollView>(null);
  useEffect(() => { analytics.track('onboarding_started'); }, []);
  const finish = (skipped: boolean) => { analytics.track('onboarding_completed', { skipped, page: i + 1 }); setPrefs({ onboarded: true }); onDone(); };
  const next = () => { if (i >= PAGES.length - 1) return finish(false); sc.current?.scrollTo({ x: (i + 1) * width, animated: true }); setI(i + 1); };
  const art = Math.min(width - 48, Math.max(220, height * 0.36));

  return (
    <View style={[st.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 }]} testID="onboarding">
      <View style={st.head}>
        <View style={st.brand}><Text style={st.logo}>HOP</Text><Text style={st.tag}>EARLY ACCESS</Text></View>
        {i < PAGES.length - 1 ? <Pressable testID="onboarding-skip" accessibilityRole="button" onPress={() => finish(true)} hitSlop={12}><Text style={st.skip}>Skip</Text></Pressable> : null}
      </View>
      <ScrollView ref={sc} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} style={{ flex: 1 }}
        onScroll={(e) => { const k = Math.round(e.nativeEvent.contentOffset.x / width); if (k !== i && k >= 0 && k < PAGES.length) setI(k); }}>
        {PAGES.map((p, k) => (
          <View key={k} style={[st.page, { width }]}>
            <View style={[st.art, { height: art }]}>{k === 0 ? <CityArt w={width - 48} h={art} /> : k === 1 ? <PlanArt /> : <MemoryArt h={art} />}</View>
            <Text style={st.h1}>{p.title}</Text>
            <Text style={st.text}>{p.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={st.foot}>
        <View style={st.dots}>{PAGES.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn]} />)}</View>
        <Button testID="onboarding-next" variant="primary" block title={i === PAGES.length - 1 ? 'Open the map' : 'Next'} onPress={next} />
        {i === PAGES.length - 1 ? <Text style={st.note}>Early access: city-wide activity, other people’s crowd reports and public venue photos are demo data for now.</Text> : <View style={{ height: 34 }} />}
      </View>
    </View>
  );
}

/** A dark map with neighbourhood heat, quiet blue to packed red */
function CityArt({ w, h }: { w: number; h: number }) {
  const blobs: [number, number, number, number][] = [[0.28, 0.32, 0.30, 4], [0.66, 0.26, 0.22, 3], [0.52, 0.62, 0.26, 2], [0.18, 0.72, 0.18, 1], [0.84, 0.66, 0.2, 0], [0.42, 0.18, 0.14, 2]];
  return (
    <View style={{ width: w, height: h, borderRadius: 18, overflow: 'hidden', backgroundColor: C.mapBg, borderWidth: 1, borderColor: C.line }}>
      <Svg width={w} height={h}>
        <Defs>
          {LV.map((c, k) => (
            <RadialGradient key={k} id={`g${k}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={0.85} />
              <Stop offset="0.55" stopColor={c} stopOpacity={0.35} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
          <LinearGradient id="ramp" x1="0" y1="0" x2="1" y2="0">{LV.map((c, k) => <Stop key={k} offset={k / 4} stopColor={c} />)}</LinearGradient>
        </Defs>
        {[0.15, 0.38, 0.6, 0.83].map((y, k) => <Path key={`h${k}`} d={`M0 ${y * h} Q ${w / 2} ${y * h + (k % 2 ? 14 : -10)} ${w} ${y * h + 6}`} stroke="#1c2027" strokeWidth={k === 1 ? 5 : 2.5} fill="none" />)}
        {[0.12, 0.35, 0.58, 0.8].map((x, k) => <Path key={`v${k}`} d={`M${x * w} 0 L ${x * w + (k % 2 ? 18 : -12)} ${h}`} stroke="#1c2027" strokeWidth={k === 2 ? 5 : 2.5} />)}
        {blobs.map(([x, y, r, lv], k) => <Circle key={k} cx={x * w} cy={y * h} r={r * Math.min(w, h)} fill={`url(#g${lv})`} />)}
        <Rect x={16} y={h - 30} width={w - 32} height={6} rx={3} fill="url(#ramp)" />
      </Svg>
      <View style={[st.rampL, { bottom: 38 }]}><Text style={st.rampT}>Quiet</Text><Text style={st.rampT}>Packed</Text></View>
    </View>
  );
}

/** Three stops, one route, the group */
function PlanArt() {
  const stops: [string, string][] = [['clock', '7:30'], ['cliffdive', '9:30'], ['club77', '11:30']];
  const users = ['u_jack', 'u_sarah', 'u_tom', 'u_mia', 'u_liam'].map((u) => friendService.user(u));
  return (
    <View style={st.plan}>
      {stops.map(([id, at], k) => {
        const v = venueService.byId(id);
        return (
          <View key={id}>
            {k ? <View style={st.leg} /> : null}
            <View style={st.stop}>
              <View style={st.num}><Text style={st.numT}>{k + 1}</Text></View>
              <Photo p={{ id, u: v?.img }} w={120} radius={8} style={{ width: 44, height: 44 }} />
              <View style={{ flex: 1 }}><Text style={st.stopT} numberOfLines={1}>{v?.name}</Text><Text style={st.stopS}>{at} PM</Text></View>
            </View>
          </View>
        );
      })}
      <View style={st.going}><AvatarStack users={users} max={5} size={30} border={C.surface} /><Text style={st.goingT}>17 going</Text></View>
    </View>
  );
}

/** The album, laid along the route */
function MemoryArt({ h }: { h: number }) {
  const ids = ['clock', 'tilly', 'cliffdive', 'club77'];
  const tile = Math.round((h - 52) / 2);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: tile * 2 + 6, gap: 6 }}>
        {ids.map((id) => <Photo key={id} p={{ id, u: venueService.byId(id)?.img }} w={300} radius={10} style={{ width: tile, height: tile }} />)}
      </View>
      <Text style={st.recap} numberOfLines={1}>The Clock → Tilly’s → Cliff Dive → Club 77</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.ink, zIndex: 50 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 36 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontFamily: F.displayBlack, fontSize: 22, color: C.accent, letterSpacing: 0.5 },
  tag: { fontFamily: F.monoSemi, fontSize: 10.5, letterSpacing: 1.2, color: C.text3, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  skip: { fontFamily: F.bodySemi, fontSize: 15, color: C.text2 },
  page: { paddingHorizontal: 24, paddingTop: 22 },
  art: { justifyContent: 'center', marginBottom: 28 },
  h1: { fontFamily: F.display, fontSize: 32, lineHeight: 35, color: C.text },
  text: { fontFamily: F.body, fontSize: 16.5, lineHeight: 23, color: C.text2, marginTop: 12 },
  foot: { paddingHorizontal: 24, gap: 14 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.lineStrong },
  dotOn: { width: 18, backgroundColor: C.accent },
  note: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.text3, textAlign: 'center', minHeight: 34 },
  rampL: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  rampT: { fontFamily: F.monoSemi, fontSize: 10.5, color: C.text2, letterSpacing: 0.6 },
  plan: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leg: { width: 2, height: 18, marginLeft: 12, marginVertical: 3, backgroundColor: C.accent, opacity: 0.6 },
  num: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.displayBlack, fontSize: 13, color: C.accentInk },
  stopT: { fontFamily: F.bodyBold, fontSize: 15.5, color: C.text },
  stopS: { fontFamily: F.mono, fontSize: 12.5, color: C.accent, marginTop: 2 },
  going: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  goingT: { fontFamily: F.bodySemi, fontSize: 14, color: C.text },
  recap: { fontFamily: F.bodySemi, fontSize: 14, color: C.accent, marginTop: 12 },
});
