/* An outing, in all three phases: PLAN before the night, LIVE on it, MEMORY after.
   The route map stays on top; Plan / Chat / Photos tabs live in the sheet. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { C, F } from '@/theme';
import { HopMap } from '@/components/map/HopMap';
import type { MapCanvasRef } from '@/components/map/mapTypes';
import { HopSheet, type HopSheetRef } from '@/components/sheets/HopSheet';
import { FloatButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LivePill } from '@/components/ui/Layout';
import { LivePanel, MemoryPanel, OutingPlan, PhotosTab } from '@/components/outings/OutingPanels';
import { ChatView, Composer } from '@/components/chat/ChatView';
import { openInvite } from '@/components/sheets/modals';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { chatService } from '@/services/chatService';
import { photoService } from '@/services/photoService';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { time } from '@/utils/format';

type Tab = 'plan' | 'chat' | 'photos';
export default function OutingScreen() {
  const { id, tab: tab0 } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [H, setH] = useState(winH);
  const [tab, setTab] = useState<Tab>(tab0 || 'plan');
  useEffect(() => { if (tab0) setTab(tab0); }, [tab0]);
  const mapRef = useRef<MapCanvasRef>(null);
  const sheetRef = useRef<HopSheetRef>(null);
  const sheetH = useSharedValue(H * 0.5);
  const d = useHop(() => {
    const o = outingService.get(id);
    if (!o) return null;
    const stops = outingService.stops(id);
    return { status: o.status, title: o.title, org: outingService.isOrganiser(o), goingMe: outingService.myMembership(id)?.rsvp === 'going', unread: chatService.canChat(o) ? chatService.unread(id) : 0, photos: photoService.album(id).length,
      clock: o.live ? time(stops[o.live.current].at + (now() - o.live.arrivedAt)) : '', cur: o.live?.current ?? -1, pts: stops.map((s) => { const p = outingService.placeOf(s); return { lat: p.lat, lng: p.lng }; }) };
  }, [id], deepEqual);

  const full = H - insets.top - 8;
  const half = Math.round(H * 0.5);
  const { snaps, index } = useMemo(() => (tab === 'chat' ? { snaps: [half, Math.round(H * 0.72), full], index: 1 } : { snaps: [half, full], index: 0 }), [tab, half, full, H]);
  const padding = useMemo(() => ({ top: insets.top + 64, bottom: snaps[index], left: 0, right: 0 }), [insets.top, snaps, index]);

  // frame the route (live: where you are and where you're heading)
  const fitKey = d ? `${d.status}|${d.cur}|${d.pts.length}` : '';
  useEffect(() => {
    if (!d || !d.pts.length) return;
    const t = setTimeout(() => {
      const pts = d.status === 'live' ? [d.pts[d.cur], d.pts[d.cur + 1] || d.pts[d.cur - 1]].filter(Boolean) : d.pts;
      mapRef.current?.fitTo(pts as any, { maxZoom: 16 });
    }, 250);
    return () => clearTimeout(t);
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  const kind = d.status === 'live' ? 'live' : d.status === 'ended' ? 'memory' : 'plan';
  const tabs: [Tab, string][] = [['plan', d.status === 'ended' ? 'The night' : 'Plan'], ['chat', 'Chat'], ['photos', 'Photos']];
  const header = (
    <View style={st.tabs} accessibilityRole="tablist">
      {tabs.map(([k, l]) => (
        <Pressable key={k} testID={`otab-${k}`} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
          <Text style={[st.tabT, tab === k && { color: C.text }]}>{l}</Text>
          {k === 'chat' && d.unread ? <View style={st.ub}><Text style={st.ubT}>{d.unread}</Text></View> : null}
          {k === 'photos' && d.photos ? <Text style={st.count}>{d.photos}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
  const body = tab === 'chat' ? <ChatView outingId={id} onNew={() => { setTimeout(() => sheetRef.current?.scrollToEnd(false), 80); setTimeout(() => sheetRef.current?.scrollToEnd(false), 400); }} />
    : tab === 'photos' ? <PhotosTab id={id} />
    : d.status === 'live' ? <LivePanel id={id} /> : d.status === 'ended' ? <MemoryPanel id={id} /> : <OutingPlan id={id} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.mapBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)} testID="outing-screen">
        <HopMap ref={mapRef} mode="focus" padding={padding} route={{ outingId: id, kind }} onVenue={go.venue} onEvent={go.event} onOuting={go.outing} initialZoom={14.5} />
        <View style={[st.top, { top: insets.top + 10 }]} pointerEvents="box-none">
          {d.status === 'live' ? (
            <View style={st.livebar}>
              <Pressable testID="outing-back" accessibilityLabel="Back" onPress={() => router.back()} style={st.lbBtn}><Icon name="back" /></Pressable>
              <View style={{ flex: 1, minWidth: 0 }}><LivePill /><Text numberOfLines={1} style={st.lbT}>{d.title}</Text></View>
              <Text style={st.clock}>{d.clock}</Text>
              <Pressable accessibilityLabel="Album" onPress={() => go.album(id)} style={st.lbBtn}><Icon name="memories" /></Pressable>
            </View>
          ) : (
            <View style={st.floatbar}>
              <FloatButton testID="outing-back" label="Back" onPress={() => router.back()}><Icon name="back" /></FloatButton>
              {d.status === 'ended' ? (d.photos ? <FloatButton label="Album" onPress={() => go.album(id)}><Icon name="memories" size={18} /><Text style={st.fbT}>Album</Text></FloatButton> : null)
                : <FloatButton testID="top-invite" label={d.org ? 'Invite' : 'Share'} onPress={() => openInvite(id)}><Icon name="link" size={18} /><Text style={st.fbT}>{d.org ? 'Invite' : 'Share'}</Text></FloatButton>}
            </View>
          )}
        </View>
        <HopSheet ref={sheetRef} snaps={snaps} index={index} height={sheetH} header={header} key={tab}
          footer={tab === 'chat' ? <Composer outingId={id} onSent={() => setTimeout(() => sheetRef.current?.scrollToEnd(), 80)} /> : undefined}
          contentStyle={tab === 'chat' ? { paddingBottom: 90 } : undefined} bodyDrag={tab !== 'chat'} stickToEnd={tab === 'chat'} testID="outing-sheet">
          {body}
        </HopSheet>
        {d.status === 'live' && d.goingMe && tab !== 'chat' ? (
          <Pressable testID="camfab" accessibilityLabel="Take a photo" onPress={() => go.camera(id)} style={[st.camfab, { bottom: insets.bottom + 18 }]}><Icon name="camera" size={28} color={C.ink} strokeWidth={2} /></Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
const st = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12 },
  floatbar: { flexDirection: 'row', justifyContent: 'space-between' },
  fbT: { fontFamily: F.bodySemi, fontSize: 14, color: C.text },
  livebar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, paddingHorizontal: 6, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong },
  lbBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  lbT: { fontFamily: F.bodyBold, fontSize: 15, color: C.text, marginTop: 2 },
  clock: { fontFamily: F.monoSemi, fontSize: 14, color: C.text },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, marginHorizontal: 16 },
  tab: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: C.accent },
  tabT: { fontFamily: F.bodySemi, fontSize: 15, color: C.text3 },
  ub: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ubT: { fontFamily: F.bodyBold, fontSize: 10.5, color: C.accentInk },
  count: { fontFamily: F.mono, fontSize: 11.5, color: C.text3 },
  camfab: { position: 'absolute', right: 18, width: 64, height: 64, borderRadius: 32, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.25)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
});
