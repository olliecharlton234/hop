import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { C, F } from '@/theme';

type V = 'h1' | 'h2' | 'h3' | 'label' | 'meta' | 'body' | 'bodyBold' | 'mono' | 'small';
/** HOP type scale: Archivo for display, Instrument Sans for body, IBM Plex Mono for times */
export function T({ v = 'body', style, ...p }: TextProps & { v?: V }) {
  return <RNText allowFontScaling maxFontSizeMultiplier={1.4} {...p} style={[s[v], style]} />;
}
export const s = StyleSheet.create({
  h1: { fontFamily: F.display, fontSize: 30, lineHeight: 32, color: C.text, letterSpacing: -0.3 },
  h2: { fontFamily: F.display, fontSize: 21, lineHeight: 24, color: C.text },
  h3: { fontFamily: F.bodyBold, fontSize: 16, lineHeight: 19, color: C.text },
  label: { fontFamily: F.bodySemi, fontSize: 11, lineHeight: 13, letterSpacing: 1, textTransform: 'uppercase', color: C.text3 },
  meta: { fontFamily: F.body, fontSize: 13.5, lineHeight: 18, color: C.text2 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 20, color: C.text },
  bodyBold: { fontFamily: F.bodySemi, fontSize: 15, lineHeight: 20, color: C.text },
  mono: { fontFamily: F.mono, fontSize: 12.5, color: C.text2 },
  small: { fontFamily: F.bodySemi, fontSize: 12, color: C.text2 },
});
