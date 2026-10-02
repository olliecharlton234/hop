/* The plan: numbered stops with walking time between them. Organisers can change each
   stop's time and drag stops into a new order (times stay with the slots, like V5). */
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { LevelWord } from '@/components/ui/Level';
import { openTimeSheet } from '@/components/ui/TimeSheet';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { activityService } from '@/services/activityService';
import { go } from '@/utils/nav';
import { distLabel, metres, timeShort, walkMins } from '@/utils/format';

const ROW = 64, WALK = 26;
export const StopsList = memo(function StopsList({ outingId, editable }: { outingId: string; editable: boolean }) {
  const stops = useHop(() => {
    const o = outingService.get(outingId)!;
    const list = outingService.stops(outingId);
    return list.map((s, i) => {
      const p = outingService.placeOf(s);
      const prev = i ? outingService.placeOf(list[i - 1]) : null;
      const e = outingService.eventOf(s);
      let ctx: { lv: number; text: string } | null = null;
      if (!e && s.venueId && o.status === 'planning') { const ar = activityService.areaOfVenue(venueService.byId(s.venueId)); if (ar) { const l = activityService.levelAt(ar.id, s.at); ctx = { lv: l.lv, text: `expected ${l.level.toLowerCase()}` }; } }
      return { id: s.id, n: i + 1, name: e ? e.title : p.name, sub: e ? `${p.name} · ${e.priceLabel}` : p.suburb, venueId: s.venueId, eventId: s.eventId || null, at: s.at, t: timeShort(s.at), ctx, hours: (p as any).hours || '',
        walk: prev ? `${walkMins(prev, p)} min walk · ${distLabel(metres(prev, p) * 1.3)}` : '' };
    });
  }, [outingId], deepEqual);
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const onDrop = (id: string, delta: number) => {
    const ids = stops.map((s) => s.id); const i = ids.indexOf(id); const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    setDrag(null);
    if (i === j) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    outingService.reorderStops(outingId, ids);
  };
  return (
    <View testID="stops">
      {stops.map((s, i) => (
        <View key={s.id}>
          {i > 0 ? <View style={st.walk}><Icon name="walk" size={14} color={C.text3} /><Text style={st.walkT}>{s.walk}</Text></View> : null}
          <StopRow s={s} editable={editable} outingId={outingId} dropHint={drag && drag.to === i && drag.id !== s.id} onDrag={(d) => setDrag(d === null ? null : { id: s.id, to: Math.max(0, Math.min(stops.length - 1, i + d)) })} onDrop={(d) => onDrop(s.id, d)}
            onMove={(d) => { const ids = stops.map((x) => x.id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; outingService.reorderStops(outingId, ids); }} />
        </View>
      ))}
      {editable ? (
        <Pressable testID="add-stop" style={st.add} onPress={() => go.pick(outingId)}><View style={st.addNum}><Icon name="plus" size={16} color={C.accent} /></View><Text style={st.addT}>Add a stop</Text></Pressable>
      ) : null}
    </View>
  );
});

function StopRow({ s, editable, outingId, onDrag, onDrop, onMove, dropHint }: { s: any; editable: boolean; outingId: string; onDrag: (d: number | null) => void; onDrop: (d: number) => void; onMove: (d: number) => void; dropHint: boolean | null }) {
  const y = useSharedValue(0), lifted = useSharedValue(0);
  const step = ROW + WALK;
  const pan = Gesture.Pan().activateAfterLongPress(180)
    .onStart(() => { lifted.value = withTiming(1, { duration: 120 }); })
    .onUpdate((e) => { y.value = e.translationY; runOnJS(onDrag)(Math.round(e.translationY / step)); })
    .onEnd((e) => { runOnJS(onDrop)(Math.round(e.translationY / step)); y.value = withTiming(0, { duration: 160 }); lifted.value = withTiming(0, { duration: 160 }); })
    .onFinalize(() => { y.value = withTiming(0); lifted.value = withTiming(0); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }], zIndex: lifted.value > 0 ? 10 : 0, shadowOpacity: lifted.value * 0.5 }));
  const time = () => {
    const o = outingService.get(outingId)!;
    openTimeSheet({ title: `Time at ${s.name}`, at: s.at, onSave: (t) => { let at = t; if (at < o.startsAt - 3 * 36e5) at += 864e5; outingService.setStopTime(s.id, at); } });
  };
  return (
    <Animated.View style={[st.stop, dropHint && { borderColor: C.accent }, style]} testID={`stop-${s.n}`}
      accessibilityActions={editable ? [{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }] : undefined}
      onAccessibilityAction={(e) => onMove(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View style={st.num}><Text style={st.numT}>{s.n}</Text></View>
      <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => (s.eventId ? go.event(s.eventId) : s.venueId ? go.venue(s.venueId) : null)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{s.eventId ? <View style={st.evdot} /> : null}<Text numberOfLines={1} style={st.t}>{s.name}</Text></View>
        <Text numberOfLines={1} style={st.s}>{s.sub} · {s.ctx ? <><LevelWord lv={s.ctx.lv}>{s.ctx.text}</LevelWord> then</> : s.hours}</Text>
      </Pressable>
      {editable ? (
        <>
          <Pressable testID={`stop-time-${s.n}`} onPress={time} style={st.time}><Text style={st.timeT}>{s.t}</Text></Pressable>
          <GestureDetector gesture={pan}><View style={st.handle} accessibilityLabel={`Reorder ${s.name}. Long-press and drag.`}><Icon name="grip" size={18} color={C.text3} /></View></GestureDetector>
        </>
      ) : <Text style={st.timeT}>{s.t}</Text>}
    </Animated.View>
  );
}
const st = StyleSheet.create({
  walk: { flexDirection: 'row', alignItems: 'center', gap: 6, height: WALK, paddingLeft: 40 },
  walkT: { fontFamily: F.body, fontSize: 12, color: C.text3 },
  stop: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  num: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.displayBlack, fontSize: 15, color: C.accentInk },
  evdot: { width: 9, height: 9, backgroundColor: C.event, transform: [{ rotate: '45deg' }], borderRadius: 2 },
  t: { fontFamily: F.bodyBold, fontSize: 15, color: C.text, flexShrink: 1 },
  s: { fontFamily: F.body, fontSize: 12.5, color: C.text2, marginTop: 2 },
  time: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.lineStrong },
  timeT: { fontFamily: F.mono, fontSize: 12.5, color: C.accent },
  handle: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginTop: 8, paddingHorizontal: 10 },
  addNum: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  addT: { fontFamily: F.bodySemi, fontSize: 15, color: C.accent },
});
