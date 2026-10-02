import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from './Icon';

type Variant = 'default' | 'primary' | 'live' | 'quiet' | 'saved';
export function Button({ title, onPress, variant = 'default', sm, block, icon, disabled, style, testID, children }: {
  title?: string; onPress?: () => void; variant?: Variant; sm?: boolean; block?: boolean; icon?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string; children?: ReactNode;
}) {
  const fg = variant === 'primary' ? C.accentInk : variant === 'live' ? '#fff' : variant === 'saved' ? C.accent : C.text;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [st.btn, sm && st.sm, block && st.block, st[variant], disabled && { opacity: 0.45 }, pressed && { transform: [{ translateY: 1 }], opacity: 0.9 }, style]}>
      {icon ? <Icon name={icon} size={sm ? 15 : 17} color={fg} strokeWidth={variant === 'primary' ? 2.2 : 1.8} /> : null}
      {title ? <Text numberOfLines={1} style={[st.txt, sm && { fontSize: 13.5 }, { color: fg }]}>{title}</Text> : null}
      {children}
    </Pressable>
  );
}
export function IconButton({ name, onPress, bare, size = 20, label, style, color = C.text, testID }: { name: string; onPress?: () => void; bare?: boolean; size?: number; label: string; style?: StyleProp<ViewStyle>; color?: string; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [st.iconbtn, bare && st.bare, pressed && { opacity: 0.7 }, style]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}
/** Floating map button (back, locate, activity) */
export function FloatButton({ children, onPress, label, style, on, testID }: { children: ReactNode; onPress?: () => void; label: string; style?: StyleProp<ViewStyle>; on?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [st.fbtn, on && { borderColor: 'rgba(255,173,31,0.55)' }, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}
export function LinkButton({ title, onPress, icon, color = C.accent, style, testID }: { title: string; onPress?: () => void; icon?: string; color?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4 }, pressed && { opacity: 0.6 }, style]}>
      {icon ? <Icon name={icon} size={15} color={color} /> : null}
      <Text style={{ color, fontFamily: F.bodySemi, fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}
export function BtnRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: 8 }, style]}>{children}</View>;
}

const st = StyleSheet.create({
  btn: { height: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  sm: { height: 34, paddingHorizontal: 12, borderRadius: 8 },
  block: { alignSelf: 'stretch' },
  default: {},
  primary: { backgroundColor: C.accent, borderColor: C.accent },
  live: { backgroundColor: C.live, borderColor: C.live },
  quiet: { backgroundColor: 'transparent' },
  saved: { borderColor: C.accent },
  txt: { fontFamily: F.bodySemi, fontSize: 15, color: C.text },
  iconbtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  bare: { backgroundColor: 'transparent', borderColor: 'transparent' },
  fbtn: { height: 44, minWidth: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
