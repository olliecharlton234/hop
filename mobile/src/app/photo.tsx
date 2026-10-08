/* Full-screen photo viewer: swipe through an outing album or a venue's public photos.
   Your own photos: Just me / Shared with the outing, and Share publicly at the venue (opt-in). */
import { useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Photo } from '@/components/ui/Photo';
import { Button } from '@/components/ui/Button';
import { useHop, deepEqual } from '@/store/hopStore';
import { photoService } from '@/services/photoService';
import { venueService } from '@/services/venueService';
import { outingService } from '@/services/outingService';
import { friendService } from '@/services/friendService';
import { shareService } from '@/services/shareService';
import { toast } from '@/services/notificationService';
import { ago, dayDate, photoSrc, time } from '@/utils/format';

export default function PhotoViewer() {
  const { outing, venue, id } = useLocalSearchParams<{ outing?: string; venue?: string; id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ids = useHop(() => (outing ? photoService.album(outing).map((p) => p.id) : venue ? venueService.publicPhotos(venue).map((p) => p.id) : []), [outing, venue], deepEqual);
  const start = Math.max(0, ids.indexOf(id));
  const [i, setI] = useState(start);
  const list = useRef<FlatList>(null);
  const cur = ids[i];
  const d = useHop(() => {
    if (!cur) return null;
    if (outing) {
      const p = photoService.get(cur); if (!p) return null;
      const st = outingService.stops(outing).find((s) => s.id === p.stopId);
      const v = photoService.venueOf(p);
      return { kind: 'outing' as const, p, place: st ? outingService.stopName(st) : '', when: time(p.takenAt), user: p.userId, mine: p.userId === friendService.meId(), vis: p.visibility, publicAt: p.publicAt ? venueService.byId(p.publicAt)?.name : null, venueName: v?.name || null, src: p.source };
    }
    const p = venueService.publicPhotos(venue!).find((x) => x.id === cur); if (!p) return null;
    return { kind: 'public' as const, p, place: venueService.byId(venue!).name, when: ago(p.takenAt), demo: !!p.demo };
  }, [cur, outing, venue], deepEqual);
  const data = useMemo(() => ids, [ids]);

  const share = async () => {
    if (!d) return;
    const r = await shareService.shareImage(photoSrc(d.p as any, 1600), `${d.place} · on HOP`);
    if (r === 'unsupported') toast('This browser can’t share photos. Use Save instead.');
  };
  const save = async () => { if (!d) return; const ok = await photoService.saveToCameraRoll(photoSrc(d.p as any, 2000)); toast(ok ? (Platform.OS === 'web' ? 'Downloaded' : 'Saved to your camera roll') : 'Saving works for photos taken on this phone'); };

  return (
    <View style={st.root} testID="photo-viewer">
      <FlatList ref={list} data={data} horizontal pagingEnabled initialScrollIndex={start} getItemLayout={(_, k) => ({ length: width, offset: width * k, index: k })}
        keyExtractor={(x) => x} showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => {
          const p = outing ? photoService.get(item) : venueService.publicPhotos(venue!).find((x) => x.id === item);
          return <View style={{ width, flex: 1, justifyContent: 'center' }}><Photo p={p as any} w={1400} h={1800} style={{ width, height: '78%' }} /></View>;
        }} />
      <View style={[st.head, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="photo-close" accessibilityLabel="Close" onPress={() => router.back()} style={st.icon}><Icon name="close" color="#fff" /></Pressable>
        <View style={{ flex: 1 }}><Text style={st.t}>{i + 1} of {ids.length}</Text>{d ? <Text style={st.s}>{d.place} · {d.when}</Text> : null}</View>
        <Pressable accessibilityLabel="Share" onPress={share} style={st.icon}><Icon name="share" color="#fff" /></Pressable>
        <Pressable accessibilityLabel="Save" onPress={save} style={st.icon}><Icon name="download" color="#fff" /></Pressable>
      </View>
      {d ? (
        <View style={[st.meta, { paddingBottom: insets.bottom + 14 }]}>
          {d.kind === 'outing' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar user={friendService.user(d.user)} size={34} />
                <View style={{ flex: 1 }}><Text style={st.b}>{d.mine ? 'You' : friendService.user(d.user)?.name}</Text><Text style={st.s}>{d.src === 'camera' ? 'Taken in HOP' : 'From camera roll'} · {dayDate(d.p.takenAt)}{d.publicAt ? ` · Public at ${d.publicAt}` : ''}</Text></View>
                {d.mine ? <Button sm icon={d.vis === 'private' ? 'lock' : 'users'} title={d.vis === 'private' ? 'Just me' : 'Shared'} onPress={() => { const next = d.vis === 'private' ? 'outing' : 'private'; if (next === 'private' && d.publicAt) photoService.unsharePublicly(cur); photoService.setVisibility(cur, next); toast(next === 'private' ? 'Only you can see this one' : 'Shared with the outing'); }} /> : null}
              </View>
              {d.mine && d.vis === 'outing' && d.venueName ? (
                d.publicAt ? <Button testID="unshare-public" sm icon="globe" title={`Public at ${d.publicAt} · Remove`} onPress={() => { photoService.unsharePublicly(cur); toast('Removed from the venue. Still in the album.'); }} />
                  : <Button testID="viewer-share-public" sm icon="globe" title={`Share publicly at ${d.venueName}`} onPress={() => { photoService.sharePublicly(cur); toast(`Shared publicly at ${d.venueName}. The original stays in the album.`); }} />
              ) : null}
            </>
          ) : (
            <View><Text style={st.b}>Shared publicly</Text><Text style={st.s}>Posted at {d.place} · {d.when}{d.demo ? ' · demo data' : ''}</Text></View>
          )}
        </View>
      ) : null}
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  head: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  t: { fontFamily: F.bodyBold, fontSize: 15, color: '#fff' },
  s: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 1 },
  b: { fontFamily: F.bodyBold, fontSize: 15, color: C.text },
  meta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, gap: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
});
