/* The outing album, full screen: everyone's photos grouped by stop. Everyone / Mine. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { Seg } from '@/components/ui/Seg';
import { Button } from '@/components/ui/Button';
import { pickFromLibrary } from '@/components/camera/compose';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { photoService } from '@/services/photoService';
import { friendService } from '@/services/friendService';
import { setAlbumOpen } from '@/data/demo/simulator';
import { go } from '@/utils/nav';
import { plural } from '@/utils/format';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  useEffect(() => { setAlbumOpen(id); return () => setAlbumOpen(null); }, [id]);
  const d = useHop(() => {
    const o = outingService.get(id); if (!o) return null;
    const all = photoService.album(id); const me = friendService.meId();
    const list = tab === 'mine' ? all.filter((p) => p.userId === me) : all;
    return { title: o.title, status: o.status, n: all.length, people: new Set(all.map((p) => p.userId)).size, goingMe: outingService.myMembership(id)?.rsvp === 'going',
      stops: outingService.stops(id).map((s, i) => ({ id: s.id, label: `${i + 1}. ${outingService.stopName(s)}`, ids: list.filter((p) => p.stopId === s.id).map((p) => ({ id: p.id, priv: p.visibility === 'private', pub: !!p.publicAt })) })).filter((s) => s.ids.length) };
  }, [id, tab], deepEqual);
  if (!d) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.ink }} testID="album">
      <View style={[st.head, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={st.icon}><Icon name="back" /></Pressable>
        <View style={{ flex: 1 }}><Text style={st.t}>{d.title}</Text><Text style={st.s}>{plural(d.n, 'photo')} from {plural(d.people, 'person', 'people')}</Text></View>
      </View>
      <Seg style={{ marginHorizontal: 16, marginBottom: 8 }} value={tab} onChange={setTab} options={[['all', 'Everyone'], ['mine', 'Mine']]} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}>
        {d.stops.map((s) => (
          <View key={s.id}>
            <Text style={st.label}>{s.label.toUpperCase()} · {s.ids.length}</Text>
            <View style={st.grid}>
              {s.ids.map((p) => (
                <Pressable key={p.id} onPress={() => go.photo({ outing: id, id: p.id })} style={st.cell}>
                  <Photo p={photoService.get(p.id)} w={300} style={StyleSheet.absoluteFill} />
                  {p.priv ? <View style={st.badge}><Icon name="lock" size={12} color="#fff" /></View> : p.pub ? <View style={st.badge}><Icon name="globe" size={12} color="#fff" /></View> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {!d.stops.length ? <Text style={[st.s, { paddingVertical: 30 }]}>{tab === 'mine' ? 'You haven’t added any photos yet.' : 'No photos yet.'}</Text> : null}
      </ScrollView>
      {d.goingMe && d.status !== 'planning' ? (
        <View style={[st.cta, { paddingBottom: insets.bottom + 12 }]}>
          <Button style={{ flex: 1 }} icon="image" title="Add from camera roll" onPress={() => pickFromLibrary(id)} />
          {d.status === 'live' ? <Button style={{ flex: 1 }} variant="primary" icon="camera" title="Take a photo" onPress={() => go.camera(id)} /> : null}
        </View>
      ) : null}
    </View>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 10 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  t: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  s: { fontFamily: F.body, fontSize: 13, color: C.text2 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3, marginTop: 16, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: '32.6%', aspectRatio: 1, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
  badge: { position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, padding: 12, backgroundColor: 'rgba(13,14,17,0.95)', borderTopWidth: 1, borderTopColor: C.line },
});
