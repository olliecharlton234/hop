/* Adding stops on the map: tap a venue → "Add as stop 3 · 10:30 pm" (with "Newtown expected
   busy around 10:30pm" as context), or search, or pick from Saved lists. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, Platform, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { C, F } from '@/theme';
import { HopMap } from '@/components/map/HopMap';
import type { MapCanvasRef } from '@/components/map/mapTypes';
import { HopSheet } from '@/components/sheets/HopSheet';
import { Button } from '@/components/ui/Button';
import { Icon, VenueGlyph } from '@/components/ui/Icon';
import { VenueRow } from '@/components/discovery/rows';
import { VenueDetails } from '@/components/venues/VenueDetails';
import { openSavedLists } from '@/components/sheets/modals';
import { useHop, deepEqual } from '@/store/hopStore';
import { setUi } from '@/store/uiStore';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { locationService } from '@/services/locationService';
import { VENUE_CAT_LABEL } from '@/data/eventCategories';
import { metres } from '@/utils/format';

const FILTERS: [string, string][] = [['all', 'All'], ['pub', 'Pubs'], ['bar', 'Bars'], ['club', 'Clubs'], ['food', 'Food']];
export default function Pick() {
  const { id, venue } = useLocalSearchParams<{ id: string; venue?: string }>();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [H, setH] = useState(winH);
  const [sel, setSel] = useState<string | null>(venue || null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState('all');
  const mapRef = useRef<MapCanvasRef>(null);
  const sheetH = useSharedValue(200);
  useEffect(() => { if (venue) setSel(venue); }, [venue]);
  useEffect(() => { setUi({ picking: id }); return () => setUi({ picking: null }); }, [id]);

  const d = useHop(() => { const o = outingService.get(id); return o ? { title: o.title, stops: outingService.stops(id).map((s) => ({ id: s.id, name: outingService.stopName(s), p: outingService.placeOf(s) })) } : null; }, [id], deepEqual);
  const results = useHop(() => {
    const t = q.trim().toLowerCase(); const me = locationService.current();
    return venueService.all().filter((v) => (filter === 'all' || v.cat === filter || (filter === 'bar' && v.cat === 'gig')) && (!t || (v.name + ' ' + v.suburb + ' ' + VENUE_CAT_LABEL[v.cat] + ' ' + v.address).toLowerCase().includes(t))).sort((a, b) => metres(me, a) - metres(me, b)).slice(0, 30).map((v) => v.id);
  }, [q, filter], deepEqual);

  const stopsKey = d?.stops.map((s) => s.id).join(',') || '';
  useEffect(() => {
    if (!d) return;
    const t = setTimeout(() => {
      if (sel) mapRef.current?.focus(venueService.byId(sel), Math.min(mapRef.current.zoom(), 16));
      else if (d.stops.length > 1) mapRef.current?.fitTo(d.stops.map((s) => s.p), { maxZoom: 15.75 });
      else mapRef.current?.focus(d.stops[0]?.p || locationService.current(), 15.5);
    }, 200);
    return () => clearTimeout(t);
  }, [sel, stopsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = () => { setUi({ picking: null }); router.replace({ pathname: '/outings/[id]', params: { id } }); };
  const full = H - insets.top - 8;
  const { snaps, index } = useMemo(() => (sel ? { snaps: [Math.round(H * 0.5), full], index: 0 } : searching ? { snaps: [Math.round(H * 0.5), full], index: 0 } : { snaps: [d?.stops.length ? 168 : 128, Math.round(H * 0.5)], index: 0 }), [sel, searching, H, full, d?.stops.length]);
  if (!d) return <View style={{ flex: 1, backgroundColor: C.ink }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.mapBg }} onLayout={(e) => setH(e.nativeEvent.layout.height)} testID="pick-screen">
      <HopMap ref={mapRef} mode="pick" padding={{ top: insets.top + 110, bottom: snaps[index], left: 0, right: 0 }} selected={sel} route={{ outingId: id, kind: 'plan' }} onVenue={(v) => { Keyboard.dismiss(); setSearching(false); setSel(v); }} onBlank={() => setSel(null)} initialZoom={15} />
      <View style={[st.top, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={st.search}>
            <Icon name="search" color={C.text2} />
            <TextInput testID="pick-search" value={q} onChangeText={setQ} onFocus={() => { setSearching(true); setSel(null); }} placeholder="Search a venue to add" placeholderTextColor={C.text2} style={st.input} />
            {searching ? <Pressable hitSlop={8} onPress={() => { setSearching(false); setQ(''); Keyboard.dismiss(); }}><Icon name="close" size={18} color={C.text2} /></Pressable> : null}
          </View>
          <Pressable testID="pick-done-top" accessibilityLabel="Done" onPress={done} style={st.me}><Icon name="check" size={22} color={C.accent} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filters} contentContainerStyle={{ padding: 3, gap: 2 }}>
          <Pressable testID="pick-saved" onPress={() => openSavedLists()} style={st.chip}><Icon name="bookmark" size={13} color={C.event} /><Text style={[st.chipT, { color: C.event }]}>Saved</Text></Pressable>
          <View style={st.sep} />
          {FILTERS.map(([k, l]) => <Pressable key={k} onPress={() => setFilter(k)} style={[st.chip, filter === k && st.chipOn]}>{k !== 'all' ? <VenueGlyph cat={k} size={13} color={filter === k ? C.text : C.text2} /> : null}<Text style={[st.chipT, filter === k && { color: C.text }]}>{l}</Text></Pressable>)}
        </ScrollView>
      </View>
      <HopSheet snaps={snaps} index={index} height={sheetH} key={sel ? 'v' + sel : searching ? 's' : 'p'} testID="pick-sheet">
        {sel ? <VenueDetails id={sel} picking={id} onPicked={() => setSel(null)} onClose={() => setSel(null)} />
          : searching ? <View style={{ paddingTop: 4 }}><Text style={st.label}>TAP ONE TO ADD IT</Text>{results.map((v, i) => <VenueRow key={v} id={v} first={i === 0} onPress={(x) => { Keyboard.dismiss(); setSearching(false); setSel(x); }} />)}</View>
          : (
            <View>
              <View style={st.pickbar}>
                <View style={{ flex: 1 }}><Text style={st.label}>ADDING STOPS · {d.title.toUpperCase()}</Text><Text style={st.h2}>{d.stops.length ? 'Tap another venue, or you’re done' : 'Tap a venue on the map'}</Text></View>
                <Button testID="pick-done" sm variant="primary" title="Done" onPress={done} />
              </View>
              {d.stops.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 12 }}>{d.stops.map((s, i) => <View key={s.id} style={st.pchip}><Text style={st.pn}>{i + 1}</Text><Text style={st.pT}>{s.name}</Text></View>)}</ScrollView> : null}
            </View>
          )}
      </HopSheet>
    </View>
  );
}
const shadow = { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 };
const st = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12, gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, ...shadow },
  input: { flex: 1, color: C.text, fontFamily: F.bodyMedium, fontSize: 16, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any,
  me: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', ...shadow },
  filters: { flexGrow: 0, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 7 },
  chipOn: { backgroundColor: C.surface3 },
  chipT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text2 },
  sep: { width: 1, height: 18, backgroundColor: C.lineStrong, alignSelf: 'center', marginHorizontal: 4 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3 },
  h2: { fontFamily: F.display, fontSize: 19, color: C.text, marginTop: 4 },
  pickbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  pchip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, paddingLeft: 4, height: 30, borderRadius: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  pn: { width: 22, height: 22, borderRadius: 6, backgroundColor: C.accent, color: C.accentInk, textAlign: 'center', lineHeight: 22, fontFamily: F.displayBlack, fontSize: 12, overflow: 'hidden' },
  pT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text },
});
