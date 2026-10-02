import { Tabs } from 'expo-router';
import { HopTabBar } from '@/components/ui/HopTabBar';
import { C } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <HopTabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.ink } }}>
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
      <Tabs.Screen name="outings" options={{ title: 'Outings' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
