/* Bottom navigation: Map · Outings · [ + / CAMERA ] · Memories · Profile.
   During your live outing the centre action becomes the camera. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, NAV_H } from '@/theme';
import { Icon } from './Icon';
import { useHop } from '@/store/hopStore';
import { outingService } from '@/services/outingService';

const TABS: [string, string, string][] = [['index', 'Map', 'map'], ['outings', 'Outings', 'list'], ['memories', 'Memories', 'memories'], ['profile', 'Profile', 'user']];

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export function HopTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const live = useHop(() => outingService.myLive()?.id ?? null);
  const current = state.routes[state.index]?.name;
  const tab = ([name, label, icon]: [string, string, string]) => {
    const on = current === name;
    return (
      <Pressable key={name} testID={`tab-${name}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
        onPress={() => { const r = state.routes.find((x) => x.name === name); if (r) navigation.navigate(r.name as never); }} style={st.tab}>
        <Icon name={icon} size={22} color={on ? C.accent : C.text3} />
        <Text style={[st.lbl, on && { color: C.text }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[st.bar, { paddingBottom: insets.bottom, height: NAV_H + insets.bottom }]}>
      {tab(TABS[0])}{tab(TABS[1])}
      <View style={st.tab}>
        {live ? (
          <Pressable testID="nav-camera" accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => router.push({ pathname: '/camera', params: { id: live } })} style={[st.create, { backgroundColor: C.text }]}>
            <Icon name="camera" size={24} color={C.ink} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Pressable testID="nav-create" accessibilityRole="button" accessibilityLabel="New outing" onPress={() => router.push({ pathname: '/outings/create', params: { fresh: '1' } })} style={st.create}>
            <Icon name="plus" size={24} color={C.accentInk} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      {tab(TABS[2])}{tab(TABS[3])}
    </View>
  );
}
const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.ink, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, height: NAV_H, alignItems: 'center', justifyContent: 'center', gap: 3 },
  lbl: { fontFamily: F.bodySemi, fontSize: 10.5, color: C.text3 },
  create: { width: 52, height: 40, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
