import { memo } from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import { C, F, LV } from '@/theme';

/** Five bars, coloured by level (blue quiet → red packed) */
export const LevelMeter = memo(({ lv, scale = 1 }: { lv: number; scale?: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 * scale, height: 14 * scale }} accessibilityElementsHidden>
    {[4, 6, 9, 12, 14].map((h, k) => (
      <View key={k} style={{ width: 4 * scale, height: h * scale, borderRadius: 1, backgroundColor: k <= lv ? LV[Math.max(0, Math.min(4, lv))] : C.lineStrong }} />
    ))}
  </View>
));
/** Level word in its colour ("Very busy") */
export const LevelWord = ({ lv, children, style }: { lv: number; children: string; style?: StyleProp<TextStyle> }) => (
  <Text style={[{ color: LV[Math.max(0, Math.min(4, lv))], fontFamily: F.bodySemi, fontSize: 12.5 }, style]}>{children}</Text>
);
export const LevelBox = ({ lv }: { lv: number }) => (
  <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
    <LevelMeter lv={lv} />
  </View>
);
