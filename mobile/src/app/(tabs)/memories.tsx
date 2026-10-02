import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { Photo } from '@/components/ui/Photo';
import { Empty } from '@/components/ui/Layout';
import { MemoriesByYear } from '@/components/outings/OutingCard';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { photoService } from '@/services/photoService';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { ago, longDate, plural } from '@/utils/format';

export default function Memories() {
  const insets = useSafeAreaInsets();
  const d = useHop(() => {
    const { memories } = outingService.mine();
    const hero = memories.find((o) => now() - (o.endedAt || o.startsAt) > 2 * 864e5);
    const ps = hero ? photoService.album(hero.id) : [];
    return { ids: memories.map((o) => o.id), hero: hero ? { id: hero.id, title: hero.title, ago: ago(hero.startsAt), date: longDate(hero.startsAt), stats: `${plural(ps.length, 'photo')} · ${plural(outingService.going(hero.id).length, 'person', 'people')} · ${plural(outingService.stops(hero.id).length, 'stop')}`, best: ps[Math.floor(ps.length * 0.6)]?.id } : null };
  }, [], deepEqual);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.surface }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 30 }} testID="memories-screen">
      <Text style={st.h1}>Memories</Text>
      {d.hero ? (
        <Pressable testID="memory-hero" onPress={() => go.outing(d.hero!.id)} style={st.hero}>
          {d.hero.best ? <Photo p={photoService.get(d.hero.best)} w={900} h={420} style={StyleSheet.absoluteFill} /> : null}
          <View style={st.shade} />
          <View style={st.cap}>
            <Text style={st.label}>{d.hero.ago.toUpperCase()}</Text>
            <Text style={st.heroT}>Remember {d.hero.title}?</Text>
            <Text style={st.meta}>{d.hero.date} · {d.hero.stats}</Text>
          </View>
        </Pressable>
      ) : null}
      {d.ids.length ? <MemoriesByYear ids={d.ids} /> : <Empty>When a night ends it lands here: the route, the people and every photo.</Empty>}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  h1: { fontFamily: F.display, fontSize: 30, color: C.text, marginBottom: 12 },
  hero: { height: 210, borderRadius: 14, overflow: 'hidden', backgroundColor: C.surface2, marginBottom: 6 },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,14,17,0.45)' },
  cap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.accent },
  heroT: { fontFamily: F.display, fontSize: 28, lineHeight: 30, color: C.text, marginTop: 4 },
  meta: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 4 },
});
