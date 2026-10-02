/* HOP's bottom sheet, native gestures throughout (Reanimated + Gesture Handler).
   - snaps between heights (e.g. peek / explore / full)
   - drag the handle or header anywhere; below full height the whole sheet drags
   - at full height the content scrolls, and pulling down from the top collapses it
   - the map behind keeps its own gestures: the sheet only claims touches on itself */
import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, NativeSyntheticEvent, NativeScrollEvent, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { C } from '@/theme';

export type HopSheetRef = { snapTo: (i: number) => void; scrollToEnd: (animated?: boolean) => void; scrollTo: (y: number) => void; index: () => number };
type Props = {
  snaps: number[]; // heights in px, ascending
  index?: number; // initial / controlled snap
  onChange?: (i: number) => void;
  height?: SharedValue<number>; // shared current height (floating map controls follow it)
  header?: ReactNode; // draggable region under the grab bar
  footer?: ReactNode; // fixed at the bottom (chat composer)
  children?: ReactNode;
  scroll?: boolean; // false: children manage their own layout
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  onScroll?: (y: number, contentH: number, viewH: number) => void;
  /** false: only the handle/header resizes the sheet and the content always scrolls (chat) */
  bodyDrag?: boolean;
  /** keep the content scrolled to the end as it grows (chat), until the user scrolls up */
  stickToEnd?: boolean;
};
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

export const HopSheet = forwardRef<HopSheetRef, Props>(function HopSheet({ snaps, index = 0, onChange, height, header, footer, children, scroll = true, contentStyle, testID, onScroll, bodyDrag = true, stickToEnd = false }, ref) {
  const own = useSharedValue(snaps[index] ?? snaps[0]);
  const h = height ?? own;
  const max = snaps[snaps.length - 1], min = snaps[0];
  const start = useSharedValue(0), anchor = useSharedValue(0), scrollY = useSharedValue(0), snapsSv = useSharedValue(snaps);
  const [atMax, setAtMax] = useState((snaps[index] ?? 0) >= max - 1);
  const idxRef = useRef(index);
  const scrollRef = useRef<ScrollView>(null);

  const report = useCallback((i: number) => { idxRef.current = i; setAtMax(i === snapsSv.value.length - 1); onChange?.(i); }, [onChange, snapsSv]);
  const snapTo = useCallback((i: number) => {
    const s = snapsSv.value;
    const k = Math.max(0, Math.min(s.length - 1, i));
    h.value = withSpring(s[k], SPRING);
    report(k);
  }, [h, report, snapsSv]);

  // new snap points (another panel) → move to the requested index
  const sig = snaps.join(',');
  useEffect(() => { snapsSv.value = snaps; snapTo(index); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sig, index]);

  useImperativeHandle(ref, () => ({
    snapTo,
    index: () => idxRef.current,
    scrollToEnd: (animated = true) => scrollRef.current?.scrollToEnd({ animated }),
    scrollTo: (y: number) => scrollRef.current?.scrollTo({ y, animated: true }),
  }), [snapTo]);

  const settle = (vy: number) => {
    'worklet';
    const s = snapsSv.value;
    const projected = h.value - vy * 0.12;
    let best = 0;
    for (let k = 1; k < s.length; k++) if (Math.abs(s[k] - projected) < Math.abs(s[best] - projected)) best = k;
    h.value = withSpring(s[best], { ...SPRING, velocity: -vy });
    runOnJS(report)(best);
  };

  const headerPan = useMemo(() => Gesture.Pan()
    .onStart(() => { start.value = h.value; })
    .onUpdate((e) => { const s = snapsSv.value; h.value = Math.max(s[0] * 0.7, Math.min(s[s.length - 1], start.value - e.translationY)); })
    .onEnd((e) => settle(e.velocityY)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const native = useMemo(() => Gesture.Native(), []);
  const bodyPan = useMemo(() => Gesture.Pan()
    .enabled(bodyDrag)
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .simultaneousWithExternalGesture(native)
    .onStart(() => { start.value = h.value; anchor.value = 0; })
    .onUpdate((e) => {
      const s = snapsSv.value; const top = s[s.length - 1];
      if (start.value >= top - 1) {
        // fully open: the list scrolls; only a pull-down from the very top moves the sheet
        if (scrollY.value > 1 || (e.translationY - anchor.value < 0 && h.value >= top - 1)) { anchor.value = e.translationY; start.value = h.value; return; }
      }
      h.value = Math.max(s[0] * 0.7, Math.min(top, start.value - (e.translationY - anchor.value)));
    })
    .onEnd((e) => { const s = snapsSv.value; if (h.value < s[s.length - 1] - 1 || start.value < s[s.length - 1] - 1) settle(e.velocityY); }), [native, bodyDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ height: max, transform: [{ translateY: max - h.value }] }));
  const stuck = useRef(true);
  const onScrollEv = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
    const n = e.nativeEvent; stuck.current = n.contentSize.height - n.contentOffset.y - n.layoutMeasurement.height < 140;
    onScroll?.(e.nativeEvent.contentOffset.y, e.nativeEvent.contentSize.height, e.nativeEvent.layoutMeasurement.height);
  };
  // footer stays visible: pad the content by the visible gap at the bottom
  const padStyle = useAnimatedStyle(() => ({ height: Math.max(0, max - h.value) }));
  const footerStyle = useAnimatedStyle(() => ({ bottom: max - h.value }));

  return (
    <Animated.View style={[st.sheet, style]} testID={testID}>
      <GestureDetector gesture={headerPan}>
        <View collapsable={false}>
          <View style={st.grab}><View style={st.bar} /></View>
          {header}
        </View>
      </GestureDetector>
      <GestureDetector gesture={bodyPan}>
        <View style={{ flex: 1 }} collapsable={false}>
          {scroll ? (
            <GestureDetector gesture={native}>
              <ScrollView ref={scrollRef} scrollEnabled={atMax || !bodyDrag} onScroll={onScrollEv} onContentSizeChange={() => { if (stickToEnd && stuck.current) scrollRef.current?.scrollToEnd({ animated: false }); }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled"
                contentContainerStyle={[{ paddingHorizontal: 16, paddingBottom: 24 }, contentStyle]} showsVerticalScrollIndicator={false}>
                {children}
                <Animated.View style={padStyle} />
              </ScrollView>
            </GestureDetector>
          ) : <View style={{ flex: 1 }}>{children}</View>}
        </View>
      </GestureDetector>
      {footer ? <Animated.View style={[{ position: 'absolute', left: 0, right: 0 }, footerStyle]}>{footer}</Animated.View> : null}
    </Animated.View>
  );
});


const st = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderColor: C.lineStrong, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: -10 }, elevation: 16, overflow: 'hidden' },
  grab: { height: 20, alignItems: 'center', justifyContent: 'center' },
  bar: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.lineStrong },
});
