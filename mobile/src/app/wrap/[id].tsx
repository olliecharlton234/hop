/* "That's a wrap." after the night ends — then it lives in Memories. */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { Button } from '@/components/ui/Button';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { photoService } from '@/services/photoService';
import { go } from '@/utils/nav';
import { longDate } from '@/utils/format';

export default function Wrap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const d = useHop(() => {
    const o = outingService.get(id); if (!o) return null; const ps = photoService.album(id);
    const pick = ps.length > 6 ? Array.from({ length: 6 }, (_, k) => ps[Math.floor((k * ps.length) / 6)]) : ps;
    return { title: o.title, date: longDate(o.startsAt), pick: pick.map((p) => p.id), n: ps.length, people: outingService.going(id).length, stops: outingService.stops(id).length, recap: outingService.stops(id).map((s) => outingService.stopName(s)).join(' → ') };
  }, [id], deepEqual);
  if (!d) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.ink }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} testID="wrap">
      <View style={[st.head, { paddingTop: insets.top + 6 }]}><Pressable accessibilityLabel="Close" onPress={() => router.back()} style={{ padding: 10 }}><Icon name="close" /></Pressable><View><Text style={st.t}>{d.title}</Text><Text style={st.s}>{d.date}</Text></View></View>
      {d.pick.length ? <View style={st.mosaic}>{d.pick.map((pid) => <Photo key={pid} p={photoService.get(pid)} w={500} style={{ width: '33.1%', aspectRatio: 1 }} />)}</View> : null}
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={st.big}>That’s a wrap.</Text>
        {d.recap ? <Text style={st.recap}>{d.recap}</Text> : null}
        <View style={st.stats}>{[[d.n, 'photos'], [d.people, 'people'], [d.stops, 'stops']].map(([n, l], i) => <View key={i} style={[st.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}><Text style={st.statN}>{n}</Text><Text style={st.s}>{l}</Text></View>)}</View>
        <Text style={st.s}>Saved to Memories. Everyone who came can open it, and add the photos still sitting on their phones.</Text>
        <Button testID="open-memory" variant="primary" block title="Open the memory" onPress={() => router.replace({ pathname: '/outings/[id]', params: { id } })} />
        <Button block icon="repeat" title="Plan the next one" onPress={() => { router.back(); go.create(); }} />
      </View>
    </ScrollView>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingBottom: 8 },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  s: { fontFamily: F.body, fontSize: 13.5, color: C.text2, lineHeight: 19 },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  big: { fontFamily: F.display, fontSize: 40, color: C.text },
  recap: { fontFamily: F.bodySemi, fontSize: 15, color: C.accent, lineHeight: 21 },
  stats: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 10 },
  stat: { flex: 1, padding: 12 },
  statN: { fontFamily: F.display, fontSize: 24, color: C.text },
});
