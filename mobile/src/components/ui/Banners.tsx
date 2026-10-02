/* In-app notification banners (top) and toasts (bottom) */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { C, F } from '@/theme';
import { notificationService, type Banner } from '@/services/notificationService';
import { friendService } from '@/services/friendService';
import { photoService } from '@/services/photoService';
import { Avatar } from './Avatar';
import { Photo } from './Photo';
import { Icon } from './Icon';
import { LivePill } from './Layout';

function useNotifs() {
  const [, set] = useState(0);
  useEffect(() => notificationService.subscribe(() => set((n) => n + 1)), []);
  return { banners: notificationService.banners(), toasts: notificationService.toasts() };
}
function act(b: Banner) {
  notificationService.dismiss(b.id);
  if (!b.action) return;
  const id = b.action.outingId;
  if (b.action.type === 'openChat') router.push({ pathname: '/outings/[id]', params: { id, tab: 'chat' } });
  else if (b.action.type === 'openAlbum') router.push({ pathname: '/album/[id]', params: { id } });
  else router.push({ pathname: '/outings/[id]', params: { id } });
}
export function BannerHost() {
  const { banners, toasts } = useNotifs();
  const insets = useSafeAreaInsets();
  return (
    <>
      <View pointerEvents="box-none" style={[st.top, { top: insets.top + 8 }]}>
        {banners.map((b) => (
          <Animated.View key={b.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
            <Pressable testID="banner" onPress={() => act(b)} style={st.banner} accessibilityRole="button">
              <Lead b={b} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={st.bt}>{b.title}</Text>
                {b.text ? <Text numberOfLines={2} style={st.bs}>{b.text}</Text> : null}
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      <View pointerEvents="none" style={[st.toastWrap, { bottom: insets.bottom + 92 }]}>
        {toasts.map((t) => (
          <Animated.View key={t.id} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={st.toast} testID="toast">
            <Text style={st.tt}>{t.text}</Text>
          </Animated.View>
        ))}
      </View>
    </>
  );
}
function Lead({ b }: { b: Banner }) {
  const l = b.lead;
  if (!l) return <Icon name="bell" color={C.text2} />;
  if (l.kind === 'avatar') return <Avatar user={friendService.user(l.userId)} size={36} />;
  if (l.kind === 'live') return <LivePill />;
  if (l.kind === 'icon') return <Icon name={l.name} color={C.text2} />;
  return (
    <View style={{ flexDirection: 'row' }}>
      {l.photoIds.slice(-3).map((id, i) => { const p = photoService.get(id); return p ? <Photo key={id} p={p} w={80} h={100} radius={5} style={{ width: 28, height: 36, marginLeft: i ? -10 : 0, borderWidth: 1.5, borderColor: C.ink }} /> : null; })}
    </View>
  );
}
const st = StyleSheet.create({
  top: { position: 'absolute', left: 10, right: 10, zIndex: 1000, gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(30,33,39,0.98)', borderWidth: 1, borderColor: C.lineStrong, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  bt: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  bs: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 1 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1001 },
  toast: { backgroundColor: C.text, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, maxWidth: 380 },
  tt: { color: C.ink, fontFamily: F.bodySemi, fontSize: 14, textAlign: 'center' },
});
