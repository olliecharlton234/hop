import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from './Icon';

/** Segmented control (RSVP, visibility, album tabs) */
export function Seg<K extends string>({ options, value, onChange, style, colors }: { options: [K, string, string?][]; value: K | null; onChange: (k: K) => void; style?: StyleProp<ViewStyle>; colors?: Partial<Record<K, [string, string]>> }) {
  return (
    <View style={[st.seg, style]} accessibilityRole="radiogroup">
      {options.map(([k, label, icon]) => {
        const on = value === k;
        const [bg, fg] = (on && colors?.[k]) || [C.surface3, C.text];
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(k)} style={[st.b, on && { backgroundColor: bg }]}>
            {icon ? <Icon name={icon} size={15} color={on ? fg : C.text2} /> : null}
            <Text style={[st.t, on && { color: fg }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const st = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10, padding: 3, gap: 3 },
  b: { flex: 1, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  t: { fontFamily: F.bodySemi, fontSize: 14, color: C.text2 },
});
