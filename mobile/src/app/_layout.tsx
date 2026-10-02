import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import '@/data/demo/repository';
import '@/data/demo/activityModel';
import { loadStore, tick } from '@/store/hopStore';
import { loadUi } from '@/store/uiStore';
import { startSimulator } from '@/data/demo/simulator';
import { ModalHost } from '@/components/ui/ModalSheet';
import { BannerHost } from '@/components/ui/Banners';
import { C } from '@/theme';
import { registerDetails } from '@/components/sheets/DetailModals';

registerDetails();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fonts] = useFonts({ Archivo_800ExtraBold, Archivo_900Black, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([loadStore(), loadUi()]).then(() => { setReady(true); startSimulator(); });
    // keep "4m ago", "Busy now" and the Tonight clock current
    const t = setInterval(() => { if (AppState.currentState === 'active') tick(); }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (ready && fonts) SplashScreen.hideAsync().catch(() => {}); }, [ready, fonts]);
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
