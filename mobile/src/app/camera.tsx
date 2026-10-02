/* One-tap camera for the live outing. Shutter → quick preview → confirm. Every photo is
   tagged with the outing, you, the time and the current stop; then HOP offers (never
   assumes) to also share it publicly at the venue. Camera access is asked for here, first. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Seg } from '@/components/ui/Seg';
import { Photo } from '@/components/ui/Photo';
import { afterAdd, pickFromLibrary } from '@/components/camera/compose';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { photoService } from '@/services/photoService';
import { toast } from '@/services/notificationService';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { time } from '@/utils/format';
import type { Photo as PhotoT } from '@/types/models';

export default function Camera() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [vis, setVis] = useState<PhotoT['visibility']>('outing');
  const [saveRoll, setSaveRoll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<string[]>([]);
  const d = useHop(() => {
    const o = outingService.get(id); if (!o) return null;
    const st = outingService.stops(id)[o.live ? o.live.current : 0];
    return { title: o.title, at: st ? outingService.stopName(st) : '', stopId: st?.id };
  }, [id], deepEqual);
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 15000); return () => clearInterval(t); }, []);

  if (!d) return <View style={st.root} />;

  // ---- permission: explain, then ask; if refused, offer Settings or the library
  if (!perm?.granted) {
    const blocked = perm && !perm.canAskAgain;
    return (
      <View style={[st.root, { padding: 24, paddingTop: insets.top + 24, justifyContent: 'center', gap: 14 }]} testID="camera-permission">
        <Icon name="camera" size={40} color={C.accent} />
        <Text style={st.h1}>Take photos for {d.title}</Text>
        <Text style={st.meta}>HOP uses your camera only when you open it here. Each photo goes to the outing’s shared album, tagged with where the group is. Nothing is posted publicly unless you choose to.</Text>
        {blocked ? <Button variant="primary" title="Open Settings" onPress={() => Linking.openSettings()} /> : <Button testID="camera-allow" variant="primary" title="Allow camera" onPress={requestPerm} />}
        <Button title="Choose from library instead" icon="image" onPress={() => { router.back(); setTimeout(() => pickFromLibrary(id), 300); }} />
        <Button variant="quiet" title="Not now" onPress={() => router.back()} />
      </View>
    );
  }

  const snap = async () => {
    if (!cam.current || !ready) return;
    try {
      const p = await cam.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (p?.uri) setShot({ uri: p.uri, width: p.width, height: p.height });
    } catch { toast('Couldn’t take that one. Try again.'); }
  };
  const confirm = async () => {
    if (!shot) return;
    setBusy(true);
    const added = await photoService.addToOuting(id, [shot], { visibility: vis, source: 'camera', stopId: d.stopId });
    if (saveRoll) photoService.saveToCameraRoll(added[0].src || shot.uri).then((ok) => { if (!ok) toast('Couldn’t save to your camera roll'); });
    setMine((m) => [...m, added[0].id]);
    setShot(null); setBusy(false);
    afterAdd(id, added);
  };

  return (
    <View style={st.root} testID="camera">
      {shot ? (
        <View style={StyleSheet.absoluteFill} testID="camera-preview">
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <Seg value={vis} onChange={setVis} options={[['outing', 'The outing', 'users'], ['private', 'Just me', 'lock']]} />
            <Pressable onPress={() => setSaveRoll((x) => !x)} style={st.check}><View style={[st.box, saveRoll && { backgroundColor: C.accent, borderColor: C.accent }]}>{saveRoll ? <Icon name="check" size={13} color={C.accentInk} /> : null}</View><Text style={st.meta}>Also save to my camera roll</Text></Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} title="Retake" onPress={() => setShot(null)} />
              <Button testID="camera-confirm" style={{ flex: 2 }} variant="primary" disabled={busy} title={busy ? 'Adding…' : vis === 'outing' ? `Add to ${d.title}` : 'Keep it private'} onPress={confirm}>{busy ? <ActivityIndicator color={C.accentInk} /> : null}</Button>
            </View>
          </View>
        </View>
      ) : (
        <>
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} onMountError={() => toast('Camera unavailable. Use your library instead.')} animateShutter />
          <View style={[st.top, { paddingTop: insets.top + 8 }]}>
            <Pressable testID="camera-close" accessibilityLabel="Close camera" onPress={() => router.back()} style={st.icon}><Icon name="close" size={24} color="#fff" /></Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}><Text style={st.ctxB} numberOfLines={1}>{d.title}</Text><Text style={st.ctx}>{d.at ? `at ${d.at} · ` : ''}{time(now())}</Text></View>
            <Pressable accessibilityLabel="Switch camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={st.icon}><Icon name="repeat" size={22} color="#fff" /></Pressable>
          </View>
          <View style={[st.row, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable testID="camera-last" accessibilityLabel={mine.length ? 'See photos' : 'Choose from library'} onPress={() => (mine.length ? (router.back(), setTimeout(() => go.album(id), 200)) : (router.back(), setTimeout(() => pickFromLibrary(id), 300)))} style={st.last}>
              {mine.length ? <><Photo p={photoService.get(mine[mine.length - 1])} w={120} radius={10} style={StyleSheet.absoluteFill} /><Text style={st.lastN}>{mine.length}</Text></> : <Icon name="image" size={24} color="#fff" />}
            </Pressable>
            <Pressable testID="shutter" accessibilityLabel="Take photo" onPress={snap} style={st.shutter}><View style={st.shutterIn} /></Pressable>
            <View style={{ width: 52 }} />
          </View>
        </>
      )}
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  h1: { fontFamily: F.display, fontSize: 26, color: C.text },
  meta: { fontFamily: F.body, fontSize: 14, color: C.text2, lineHeight: 20 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.35)', paddingBottom: 10 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ctxB: { fontFamily: F.bodyBold, fontSize: 15, color: '#fff' },
  ctx: { fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  row: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 },
  last: { width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  lastN: { position: 'absolute', right: 3, bottom: 1, fontFamily: F.bodyBold, fontSize: 12, color: '#fff' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 12, backgroundColor: 'rgba(13,14,17,0.92)' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
});
