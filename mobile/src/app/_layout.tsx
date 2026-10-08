import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHopFonts } from '@/theme/fonts';
import '@/data/demo/repository';
import '@/data/demo/activityModel';
import { loadStore, onEvent, tick } from '@/store/hopStore';
import { loadUi } from '@/store/uiStore';
import { getPrefs, loadPrefs, usePrefs } from '@/store/prefs';
import { hydrateGuests, getMeId, outing } from '@/data/demo/repository';
import { analytics, wireStoreAnalytics } from '@/services/analytics';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { hideBootScreen, registerServiceWorker } from '@/utils/pwa';
import { entryIsLink } from '@/utils/entry';
import { startSimulator } from '@/data/demo/simulator';
import { ModalHost } from '@/components/ui/ModalSheet';
import { BannerHost } from '@/components/ui/Banners';
import { C } from '@/theme';
import { registerDetails } from '@/components/sheets/DetailModals';

registerDetails();
registerServiceWorker();

/** Opening a shared link straight onto a screen still keeps the map underneath it, so Back
    leads into HOP rather than out of it. */
export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fonts = useHopFonts();
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(false);
  const onboarded = usePrefs((p) => p.onboarded);
  useEffect(() => {
    Promise.all([loadStore(), loadUi(), loadPrefs(), entryIsLink()]).then(([, , , link]) => {
      hydrateGuests();
      wireStoreAnalytics(onEvent, getMeId, (id) => outing(id)?.organiserId === getMeId());
      analytics.track('app_opened', { first: getPrefs().opens === 1, via_link: link });
      // first open shows the three intro screens, unless they arrived through a shared link
      setIntro(!getPrefs().onboarded && !link);
      setReady(true); startSimulator();
    });
    // keep "4m ago", "Busy now" and the Tonight clock current
    const t = setInterval(() => { if (AppState.currentState === 'active') tick(); }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (ready && fonts) { SplashScreen.hideAsync().catch(() => {}); hideBootScreen(); } }, [ready, fonts]);
  if (!ready || !fonts) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.ink }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ink }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="outings/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="wrap/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
        <ModalHost />
        <BannerHost />
        {intro && !onboarded ? <Onboarding onDone={() => setIntro(false)} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
