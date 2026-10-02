/* Outing rows for the Outings tab and memories: icon/cover · title · when · route · people · last message */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, F } from '@/theme';
import { OutingIcon } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { LivePill } from '@/components/ui/Layout';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { chatService } from '@/services/chatService';
import { photoService } from '@/services/photoService';
import { chatPreview } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { ago, longDate, plural, when } from '@/utils/format';

/** Tiny route sketch drawn from real stop coordinates */
export const RouteMini = memo(function RouteMini({ id, w = 54, h = 40 }: { id: string; w?: number; h?: number }) {
  const pts = useHop(() => outingService.stops(id).map((s) => { const p = outingService.placeOf(s); return [p.lat, p.lng]; }), [id], deepEqual);
  if (!pts.length) return null;
  const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1]);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = (v: number) => 6 + ((v - c) / (d - c || 1)) * (w - 12), sy = (v: number) => 6 + ((b - v) / (b - a || 1)) * (h - 12);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[1]).toFixed(1)} ${sy(p[0]).toFixed(1)}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Path d={path} stroke={C.accent} strokeWidth={1.6} fill="none" strokeDasharray="1 3" strokeLinecap="round" />
      {pts.map((p, i) => <Circle key={i} cx={sx(p[1])} cy={sy(p[0])} r={2.6} fill={C.accent} />)}
    </Svg>
  );
});

export const OutingRowBig = memo(function OutingRowBig({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!;
    const st = outingService.stops(id).map((s) => outingService.stopName(s));
    const g = outingService.going(id).length, m = outingService.members(id).filter((a) => a.rsvp === 'maybe').length;
    const un = chatService.canChat(o) ? chatService.unread(id) : 0;
    const lm = chatService.canChat(o) ? chatService.lastMessage(id) : undefined;
    return { title: o.title, icon: o.icon, cover: o.cover, live: o.status === 'live', when: when(o.startsAt), route: st.length ? st.join(' → ') : 'No stops yet', people: `${g} going${m ? ` · ${m} maybe` : ''} · ${plural(st.length, 'stop')}${o.visibility === 'public' ? ' · Public' : ''}`, un, lm: lm ? chatPreview(lm) : '', lmAt: lm ? ago(lm.at) : '' };
  }, [id], deepEqual);
  return (
    <Pressable testID={`orow-${id}`} onPress={() => go.outing(id)} style={({ pressed }) => [st.row, pressed && { opacity: 0.85 }]}>
      <View style={st.emo}>{d.cover ? <Photo p={{ id, src: d.cover }} w={120} style={StyleSheet.absoluteFill} /> : <OutingIcon icon={d.icon} size={26} />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={st.t}>{d.title}</Text>
        <View style={{ flexDirection: 'row', marginTop: 2 }}>{d.live ? <LivePill label="LIVE NOW" /> : <Text style={st.when}>{d.when}</Text>}</View>
        <Text numberOfLines={1} style={st.s}>{d.route}</Text>
        <Text numberOfLines={1} style={st.s}>{d.people}</Text>
        {d.lm ? <Pressable onPress={() => go.chat(id)} style={st.lm}><Text numberOfLines={1} style={[st.lmT, d.un ? { color: C.text } : null]}>{d.lm}</Text><Text style={st.lmAt}>{d.lmAt}</Text></Pressable> : null}
      </View>
      {d.un ? <View style={st.unread}><Text style={st.unN}>{d.un}</Text><Text style={st.unL}>unread</Text></View> : <RouteMini id={id} />}
    </Pressable>
  );
});

/** A memory: photo filmstrip, title, date, route recap, stats */
export const MemoryCard = memo(function MemoryCard({ id }: { id: string }) {
  const d = useHop(() => {
    const o = outingService.get(id)!; const ps = photoService.album(id);
    const film = ps.length <= 4 ? ps : Array.from({ length: 4 }, (_, k) => ps[Math.floor(((k + 0.5) * ps.length) / 4)]);
    const stops = outingService.stops(id);
    return { title: o.title, icon: o.icon, date: longDate(o.startsAt), film: film.map((p) => p.id), recap: stops.length > 1 ? stops.map((s) => outingService.stopName(s)).join(' → ') : '', stats: [plural(ps.length, 'photo'), plural(outingService.going(id).length, 'person', 'people'), stops.length > 1 ? plural(stops.length, 'stop') : ''].filter(Boolean).join(' · ') };
  }, [id], deepEqual);
  return (
    <Pressable testID={`memory-${id}`} onPress={() => go.outing(id)} style={st.mem}>
      {d.film.length ? <View style={st.film}>{d.film.map((pid, i) => <Photo key={pid} p={photoService.get(pid)} w={i ? 200 : 400} h={200} style={{ flex: i ? 1 : 2, height: 110 }} />)}</View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}><OutingIcon icon={d.icon} size={18} /><Text style={st.mt}>{d.title}</Text></View>
      <Text style={st.s}>{d.date}</Text>
      {d.recap ? <Text numberOfLines={1} style={st.recap}>{d.recap}</Text> : null}
      <Text style={st.s}>{d.stats}</Text>
    </Pressable>
  );
});

export function MemoriesByYear({ ids }: { ids: string[] }) {
  const years: Record<string, string[]> = {};
  ids.forEach((id) => { const y = String(new Date(outingService.get(id)!.startsAt).getFullYear()); (years[y] ||= []).push(id); });
  return <>{Object.keys(years).sort((a, b) => Number(b) - Number(a)).map((y) => (
    <View key={y}><Text style={st.year}>{y}</Text>{years[y].map((id) => <MemoryCard key={id} id={id} />)}</View>
  ))}</>;
}

const st = StyleSheet.create({
  year: { fontFamily: F.displayBlack, fontSize: 40, color: C.surface3, marginTop: 18 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, alignItems: 'flex-start' },
  emo: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  when: { fontFamily: F.mono, fontSize: 12, color: C.accent },
  s: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 2 },
  lm: { flexDirection: 'row', gap: 8, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.line },
  lmT: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.text2 },
  lmAt: { fontFamily: F.mono, fontSize: 11, color: C.text3 },
  unread: { alignItems: 'center', minWidth: 46 },
  unN: { fontFamily: F.display, fontSize: 20, color: C.accent },
  unL: { fontFamily: F.bodySemi, fontSize: 10, color: C.text3 },
  mem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  film: { flexDirection: 'row', gap: 2, borderRadius: 10, overflow: 'hidden' },
  mt: { fontFamily: F.bodyBold, fontSize: 17, color: C.text },
  recap: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.accent, marginTop: 3 },
});
