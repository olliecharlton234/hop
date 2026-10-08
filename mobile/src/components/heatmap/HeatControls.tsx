/* Activity layer controls: the toggle (right), the key "ACTIVITY Quiet [ramp] Packed" and
   the time windows Now / Later tonight / Tomorrow / This weekend. Forecasts say so. */
import { analytics } from '@/services/analytics';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { C, F, LV } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { setUi, useUi } from '@/store/uiStore';
import { activityService } from '@/services/activityService';

export const ActivityToggle = memo(function ActivityToggle() {
  const on = useUi((u) => u.heatOn);
  return (
    <Pressable testID="activity-toggle" accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="Activity layer" onPress={() => { if (!on) analytics.track('heatmap_enabled'); setUi({ heatOn: !on }); }} style={[st.toggle, on && { borderColor: 'rgba(255,173,31,0.55)' }]}>
      <Icon name="waves" size={20} color={on ? C.accent : C.text2} />
      <Text style={[st.toggleT, on && { color: C.accent }]}>Activity</Text>
    </Pressable>
  );
});

export const HeatBar = memo(function HeatBar() {
  const on = useUi((u) => u.heatOn);
  const w = useUi((u) => u.heatWindow);
  const legend = useUi((u) => u.legend);
  if (!on) return null;
  const fc = w !== 'now';
  return (
    <View style={{ gap: 6, alignItems: 'flex-start' }} pointerEvents="box-none">
      {legend ? (
        <View style={st.legend} testID="heat-legend">
          <Text style={st.lb}>ACTIVITY</Text>
          <Text style={st.le}>Quiet</Text>
          <Svg width={72} height={6} style={{ opacity: fc ? 0.65 : 1 }}>
            <Defs><LinearGradient id="r" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={LV[0]} /><Stop offset="0.32" stopColor={LV[1]} /><Stop offset="0.55" stopColor={LV[2]} /><Stop offset="0.76" stopColor={LV[3]} /><Stop offset="1" stopColor={LV[4]} />
            </LinearGradient></Defs>
            <Rect x={0} y={0} width={72} height={6} rx={3} fill="url(#r)" />
          </Svg>
          <Text style={st.le}>Packed</Text>
          {fc ? <Text style={st.fc}>Forecast</Text> : null}
          <Pressable testID="legend-hide" accessibilityLabel="Hide key" hitSlop={8} onPress={() => setUi({ legend: false })} style={{ paddingHorizontal: 4 }}><Icon name="close" size={12} color={C.text3} /></Pressable>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.seg} contentContainerStyle={{ padding: 2, gap: 2 }} accessibilityRole="radiogroup">
        {activityService.WINDOWS.map(([k, l]) => (
          <Pressable key={k} testID={`heat-${k}`} accessibilityRole="radio" accessibilityState={{ selected: w === k }} onPress={() => setUi({ heatWindow: k })} style={[st.segB, w === k && { backgroundColor: C.accentSoft }]}>
            <Text style={[st.segT, w === k && { color: C.accent }]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const st = StyleSheet.create({
  toggle: { height: 46, paddingHorizontal: 8, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 1, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  toggleT: { fontFamily: F.bodyBold, fontSize: 10, color: C.text2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 10, paddingRight: 4, paddingVertical: 5, backgroundColor: 'rgba(13,14,17,0.92)', borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  lb: { fontFamily: F.display, fontSize: 10, letterSpacing: 1.4, color: C.text },
  le: { fontFamily: F.body, fontSize: 11, color: C.text2 },
  fc: { fontFamily: F.bodySemi, fontSize: 11, color: C.text2, backgroundColor: C.surface2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, overflow: 'hidden' },
  seg: { flexGrow: 0, maxWidth: '100%', backgroundColor: 'rgba(13,14,17,0.92)', borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10 },
  segB: { height: 30, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center' },
  segT: { fontFamily: F.bodySemi, fontSize: 12.5, color: C.text2 },
});
