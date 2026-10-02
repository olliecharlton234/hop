/* MAP — HOP's home. Full-screen map, search + modes on top, Activity controls floating,
   and one native bottom sheet whose content follows what you tapped:
   Tonight (peek / explore / full) → venue / event / neighbourhood / search / What's on. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { HopMap, type RouteSpec } from '@/components/map/HopMap';
import type { MapCanvasRef } from '@/components/map/mapTypes';
import { HopSheet, type HopSheetRef } from '@/components/sheets/HopSheet';
import { TopBar } from '@/components/discovery/TopBar';
import { ActivityToggle, HeatBar } from '@/components/heatmap/HeatControls';
import { TonightPanel, PEEK_HEIGHT } from '@/components/discovery/TonightPanel';
import { SearchPanel } from '@/components/discovery/SearchPanel';
import { FriendsLens, PlacesLens, WhatsOnPanel, whatsOnList } from '@/components/discovery/LensPanels';
import { AreaDetails } from '@/components/discovery/AreaDetails';
import { VenueDetails } from '@/components/venues/VenueDetails';
import { EventDetails } from '@/components/events/EventDetails';
import { FloatButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { panel, setUi, useUi, getUi } from '@/store/uiStore';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { eventService } from '@/services/eventService';
import { activityService } from '@/services/activityService';
import { locationService } from '@/services/locationService';
import { toast } from '@/services/notificationService';
import { setOnMapHome, go } from '@/utils/nav';
import { metres } from '@/utils/format';
import { C } from '@/theme';

export default function MapHome() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [H, setH] = useState(winH - 62 - insets.bottom);
  const mapRef = useRef<MapCanvasRef>(null);
  const sheetRef = useRef<HopSheetRef>(null);
  const sheetH = useSharedValue(PEEK_HEIGHT);
  const [snapIdx, setSnapIdx] = useState(0);
  const panels = useUi((u) => u.panels);
  const lens = useUi((u) => u.lens);
  const evWhen = useUi((u) => u.evWhen);
  const evGroup = useUi((u) => u.evGroup);
  const query = useUi((u) => u.query);
  const top = panels[panels.length - 1];
  const params = useLocalSearchParams<{ event?: string; venue?: string; area?: string }>();

  // deep links (hop://events/ev_x → event sheet on the map)
  useEffect(() => {
    if (params.event) panel.push({ kind: 'event', id: params.event });
    else if (params.venue) panel.push({ kind: 'venue', id: params.venue });
    else if (params.area) panel.push({ kind: 'area', id: params.area });
  }, [params.event, params.venue, params.area]);

  useFocusEffect(useCallback(() => {
    setOnMapHome(true);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (getUi().panels.length > 1) { closeTop(); return true; } return false; });
    return () => { setOnMapHome(false); sub.remove(); };
  }, []));

  // ---- sheet sizes per panel ------------------------------------------------------
  const full = H - insets.top - 8;
  const half = Math.round(H * 0.5);
  const { snaps, index } = useMemo(() => {
    switch (top.kind) {
      case 'tonight': return lens === 'tonight' ? { snaps: [PEEK_HEIGHT, half, full], index: 0 } : { snaps: [PEEK_HEIGHT, half, full], index: 1 };
      case 'search': return { snaps: [half, H - insets.top - 66], index: 1 };
      case 'venue': case 'event': return { snaps: [Math.round(H * 0.56), full], index: 0 };
      default: return { snaps: [half, full], index: 0 };
    }
  }, [top.kind, lens, half, full, H]);
  const topH = 48 + 8 + 38 + (lens === 'tonight' ? 0 : 44);
  const padding = useMemo(() => ({ top: insets.top + 10 + topH, bottom: snaps[index], left: 0, right: 0 }), [insets.top, topH, snaps, index]);

  // ---- what the map shows ------------------------------------------------------------
  const route = useHop<RouteSpec>(() => {
    const { live, upcoming } = outingService.mine();
    const focus = live[0] || upcoming.find((o) => outingService.myMembership(o.id)?.rsvp === 'going');
    return focus && top.kind !== 'event' && top.kind !== 'whatson' ? { outingId: focus.id, kind: 'home' } : null;
  }, [top.kind], deepEqual);
  const outingPins = useHop(() => {
    if (top.kind !== 'tonight' && top.kind !== 'search') return [];
    const { live, upcoming } = outingService.mine();
    const focus = live[0] || upcoming.find((o) => outingService.myMembership(o.id)?.rsvp === 'going');
    const tonight = new Set(outingService.tonight().map((o) => o.id));
    return [...upcoming.slice(focus && !live[0] ? 1 : 0), ...outingService.publicOutings().filter((o) => !outingService.myMembership(o.id))].filter((o) => o.id !== focus?.id && !tonight.has(o.id)).map((o) => o.id);
  }, [top.kind], deepEqual);
  const eventIds = useHop(() => (top.kind === 'whatson' ? whatsOnList(evWhen, evGroup).filter((e) => !query || e.title.toLowerCase().includes(query.toLowerCase())).map((e) => e.id) : top.kind === 'event' ? [top.id] : null), [top.kind, (top as any).id, evWhen, evGroup, query], deepEqual);
  const mode = top.kind === 'whatson' || top.kind === 'event' ? 'events' : 'default';
  const selected = top.kind === 'venue' ? top.id : top.kind === 'event' ? top.id : null;

  // ---- camera follows the sheet's subject ----------------------------------------------
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const t = setTimeout(() => {
      if (top.kind === 'venue') m.focus(venueService.byId(top.id), Math.max(m.zoom(), 16));
      else if (top.kind === 'event') { const p = eventService.placeOf(eventService.byId(top.id)); if (p) m.focus(p, Math.max(m.zoom(), 15.5)); }
      else if (top.kind === 'area') { const a = activityService.area(top.id); m.fitTo([{ lat: a.lat - a.r / 111000, lng: a.lng - a.r / 92000 }, { lat: a.lat + a.r / 111000, lng: a.lng + a.r / 92000 }], { maxZoom: 15.6 }); }
      else if (top.kind === 'whatson' && eventIds?.length) {
        const me = locationService.current();
        const ps = eventIds.map((id) => eventService.placeOf(eventService.byId(id))).filter(Boolean) as { lat: number; lng: number }[];
        const close = ps.filter((p) => metres(me, p) < 1600);
        const pts = close.length >= 2 ? close : ps.filter((p) => metres(me, p) < 4000);
        if (pts.length) m.fitTo(pts, { maxZoom: 15.25 });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [top.kind, (top as any).id, evWhen, evGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeTop = () => { Keyboard.dismiss(); if (getUi().panels[getUi().panels.length - 1]?.kind === 'search') setUi({ query: '' }); if (getUi().panels[getUi().panels.length - 1]?.kind === 'whatson') setUi({ lens: 'tonight', query: '' }); panel.back(); };
  const onBlank = useCallback(() => { const k = panel.top().kind; if (k === 'venue' || k === 'event' || k === 'area' || k === 'search') closeTop(); }, []);
  const locate = async () => {
    const r = await locationService.locate();
    if (!r.ok && r.message) toast(r.message);
    mapRef.current?.focus(locationService.current(), 15.5);
  };

  const floatStyle = useAnimatedStyle(() => ({ bottom: sheetH.value + 12, opacity: sheetH.value > full - 40 ? 0 : 1 }));
  const showTop = top.kind !== 'event' && top.kind !== 'area';

  let content: React.ReactNode;
  switch (top.kind) {
    case 'venue': content = <VenueDetails id={top.id} />; break;
    case 'event': content = <EventDetails id={top.id} onScrollToDetail={() => sheetRef.current?.snapTo(1)} />; break;
    case 'area': content = <AreaDetails id={top.id} />; break;
    case 'search': content = <SearchPanel />; break;
    case 'whatson': content = <WhatsOnPanel />; break;
    default: content = lens === 'friends' ? <FriendsLens /> : lens === 'places' ? <PlacesLens /> : <TonightPanel />;
  }

  return (
    <View style={st.root} onLayout={(e) => setH(e.nativeEvent.layout.height)} testID="map-home">
      <HopMap ref={mapRef} mode={mode} padding={padding} selected={selected} eventIds={eventIds} route={route} outingPins={outingPins}
        onVenue={(id) => panel.push({ kind: 'venue', id })} onEvent={(id) => panel.push({ kind: 'event', id })} onOuting={(id) => go.outing(id)} onArea={(id) => panel.push({ kind: 'area', id })} onBlank={onBlank} testID="map" />

      <View style={[st.top, { top: insets.top + 10 }]} pointerEvents="box-none">
        {showTop ? <TopBar searching={top.kind === 'search'} onFocusSearch={() => { if (panel.top().kind !== 'search' && panel.top().kind !== 'whatson') panel.push({ kind: 'search' }); }} onCancelSearch={closeTop} />
          : <View style={{ flexDirection: 'row' }}><FloatButton testID="map-back" label="Back" onPress={closeTop}><Icon name="back" /></FloatButton></View>}
      </View>

      <Animated.View style={[st.left, floatStyle]} pointerEvents="box-none"><HeatBar /></Animated.View>
      <Animated.View style={[st.right, floatStyle]} pointerEvents="box-none">
        <ActivityToggle />
        <FloatButton testID="locate" label="Show where I am" onPress={locate}><Icon name="locate" /></FloatButton>
      </Animated.View>

      <HopSheet ref={sheetRef} snaps={snaps} index={index} height={sheetH} onChange={setSnapIdx} testID="map-sheet" key={top.kind === 'tonight' ? 'tonight' : 'panel'}>
        {content}
      </HopSheet>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.mapBg },
  top: { position: 'absolute', left: 12, right: 12 },
  left: { position: 'absolute', left: 12, right: 70 },
  right: { position: 'absolute', right: 12, gap: 10, alignItems: 'flex-end' },
});
