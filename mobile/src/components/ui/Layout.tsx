import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from './Icon';

/** A titled section: "FRIENDS TONIGHT ......... All 30" */
export function Section({ title, right, children, style, testID }: { title?: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[{ paddingTop: 18 }, style]} testID={testID}>
      {title ? (
        <View style={st.head}>
          <Text style={st.label}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
/** Tappable list row: lead · title/subtitle · trailing */
export function Row({ lead, title, sub, sub2, trail, onPress, chevron, style, testID, first }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; sub2?: ReactNode; trail?: ReactNode; onPress?: () => void; chevron?: boolean; style?: StyleProp<ViewStyle>; testID?: string; first?: boolean;
}) {
  const body = (
    <>
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <Text numberOfLines={1} style={st.t}>{title}</Text> : title}
        {sub != null ? (typeof sub === 'string' ? <Text numberOfLines={1} style={st.s}>{sub}</Text> : sub) : null}
        {sub2 != null ? (typeof sub2 === 'string' ? <Text numberOfLines={1} style={[st.s, { color: C.text3 }]}>{sub2}</Text> : sub2) : null}
      </View>
      {trail}
      {chevron ? <Icon name="chev" size={18} color={C.text3} /> : null}
    </>
  );
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.row, first && st.first, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }, style]}>{body}</Pressable>
  ) : (
    <View testID={testID} style={[st.row, first && st.first, style]}>{body}</View>
  );
}
export const rowText = StyleSheet.create({ t: { fontFamily: F.bodySemi, fontSize: 15, color: C.text }, s: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 1 } });
export function Empty({ children }: { children: ReactNode }) {
  return <Text style={{ paddingVertical: 20, color: C.text2, fontFamily: F.body, fontSize: 15, lineHeight: 21 }}>{children}</Text>;
}
export function LivePill({ label = 'LIVE' }: { label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,75,58,0.16)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.live }} />
      <Text style={{ color: '#ff8a7d', fontFamily: F.monoSemi, fontSize: 10, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}
export function Chip({ label, on, onPress, icon, testID }: { label: string; on?: boolean; onPress?: () => void; icon?: ReactNode; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={[st.chip, on && st.chipOn]}>
      {icon}
      <Text style={[st.chipT, on && { color: C.text }]}>{label}</Text>
    </Pressable>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.text3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: C.line },
  first: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: C.line },
  t: { fontFamily: F.bodySemi, fontSize: 15, color: C.text },
  s: { fontFamily: F.body, fontSize: 13, color: C.text2, marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 7 },
  chipOn: { backgroundColor: C.surface3 },
  chipT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text2 },
});
