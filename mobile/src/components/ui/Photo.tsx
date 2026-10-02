import { memo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { hsl, hue } from '@/theme';
import { photoSrc } from '@/utils/format';
import type { ImageRef } from '@/types/models';

/** Photo tile with a tinted fallback. Requests only the size it shows. */
export const Photo = memo(({ p, w = 300, h = w, style, radius = 0 }: { p: { id?: string; src?: string; thumb?: string; u?: ImageRef | null } | null | undefined; w?: number; h?: number; style?: StyleProp<ViewStyle>; radius?: number }) => {
  const id = p?.id || 'x';
  const uri = p ? photoSrc({ src: p.src, thumb: p.thumb, u: p.u || undefined }, w, h) : '';
  return (
    <View style={[{ backgroundColor: hsl(hue(id), 30, 16), overflow: 'hidden', borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: hsl(hue(id), 70, 45, 0.18) }]} />
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={id + w} transition={150} /> : null}
    </View>
  );
});
