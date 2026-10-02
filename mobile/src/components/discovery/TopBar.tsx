/* Top of the map: search, your face (Profile), and the map modes
   TONIGHT / FRIENDS / PLACES / EVENTS with each mode's filters. */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { C, F } from '@/theme';
import { Icon, VenueGlyph } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { setUi, useUi, panel, type Lens } from '@/store/uiStore';
import { useHop } from '@/store/hopStore';
import { friendService } from '@/services/friendService';

const LENSES: [Lens, string][] = [['tonight', 'Tonight'], ['friends', 'Friends'], ['places', 'Places'], ['events', 'Events']];
const SUBS = {
  friends: [['out', 'Out now'], ['outings', 'Outings'], ['recent', 'Recent']],
  places: [['all', 'All'], ['pub', 'Pubs'], ['bar', 'Bars'], ['club', 'Clubs'], ['food', 'Food'], ['late', 'Late night']],
} as const;
const EV_WHEN = [['tonight', 'Tonight'], ['tomorrow', 'Tomorrow'], ['weekend', 'Weekend']] as const;
const EV_GROUP = [['music', 'Music'], ['comedy', 'Comedy'], ['sport', 'Sport'], ['nightlife', 'Nightlife'], ['food', 'Food'], ['free', 'Free']] as const;

export function setLens(l: Lens) {
  setUi({ lens: l, query: '' });
  if (l === 'events') { panel.reset(); panel.push({ kind: 'whatson' }); } else panel.reset();
}

export const TopBar = memo(function TopBar({ onFocusSearch, onCancelSearch, searching }: { onFocusSearch: () => void; onCancelSearch: () => void; searching: boolean }) {
  const lens = useUi((u) => u.lens);
  const sub = useUi((u) => u.lensSub);
  const query = useUi((u) => u.query);
  const evWhen = useUi((u) => u.evWhen);
  const evGroup = useUi((u) => u.evGroup);
  const meId = useHop(() => friendService.meId());
  return (
    <View style={st.wrap} pointerEvents="box-none">
      <View style={st.row}>
        <View style={st.search}>
          <Icon name="search" size={20} color={C.text2} />
          <TextInput testID="search-input" value={query} onChangeText={(t) => setUi({ query: t })} onFocus={onFocusSearch}
            placeholder={lens === 'events' ? 'Gigs, trivia, markets…' : 'Places, events, areas'} placeholderTextColor={C.text2}
            style={st.input} returnKeyType="search" autoCorrect={false} accessibilityLabel="Search places, events, outings and areas" />
          {searching ? <IconButton name="close" bare size={18} label="Cancel search" onPress={onCancelSearch} style={{ width: 32, height: 32 }} /> : null}
        </View>
        <Pressable testID="me-btn" accessibilityLabel="Your profile" onPress={() => router.navigate('/profile')} style={st.me}>
          <Avatar user={friendService.user(meId)} size={34} />
        </Pressable>
      </View>
      <View style={st.lenses} accessibilityRole="tablist">
        {LENSES.map(([k, l]) => (
          <Pressable key={k} testID={`lens-${k}`} accessibilityRole="tab" accessibilityState={{ selected: lens === k }} onPress={() => setLens(k)} style={[st.lens, lens === k && st.lensOn]}>
            <Text style={[st.lensT, lens === k && { color: C.accent }]}>{l.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {lens === 'friends' || lens === 'places' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.subs} contentContainerStyle={st.subsIn}>
          {SUBS[lens].map(([k, l]) => {
            const on = (sub as any)[lens] === k;
            return (
              <Pressable key={k} testID={`sub-${k}`} onPress={() => setUi((u) => ({ lensSub: { ...u.lensSub, [lens]: k } }))} style={[st.chip, on && st.chipOn]}>
                {lens === 'places' && !['all', 'late'].includes(k) ? <VenueGlyph cat={k} size={13} color={on ? C.text : C.text2} /> : null}
                <Text style={[st.chipT, on && { color: C.text }]}>{l}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : lens === 'events' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.subs} contentContainerStyle={st.subsIn}>
          {EV_WHEN.map(([k, l]) => <Pressable key={k} testID={`ev-when-${k}`} onPress={() => setUi({ evWhen: k })} style={[st.chip, evWhen === k && st.chipOn]}><Text style={[st.chipT, evWhen === k && { color: C.text }]}>{l}</Text></Pressable>)}
          <View style={st.sep} />
          {EV_GROUP.map(([k, l]) => <Pressable key={k} testID={`ev-group-${k}`} onPress={() => setUi({ evGroup: evGroup === k ? null : k })} style={[st.chip, evGroup === k && st.chipOn]}><Text style={[st.chipT, evGroup === k && { color: C.text }]}>{l}</Text></Pressable>)}
        </ScrollView>
      ) : null}
    </View>
  );
});

const shadow = { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 };
const st = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 14, paddingRight: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, ...shadow },
  input: { flex: 1, minWidth: 0, color: C.text, fontFamily: F.bodyMedium, fontSize: 16, paddingVertical: 0, outlineStyle: 'none' } as any,
  me: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', ...shadow },
  lenses: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10, padding: 3, ...shadow },
  lens: { flex: 1, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  lensOn: { backgroundColor: C.surface3 },
  lensT: { fontFamily: F.display, fontSize: 11, letterSpacing: 1.4, color: C.text3 },
  subs: { flexGrow: 0, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10 },
  subsIn: { padding: 3, gap: 2, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 7 },
  chipOn: { backgroundColor: C.surface3 },
  chipT: { fontFamily: F.bodySemi, fontSize: 13, color: C.text2 },
  sep: { width: 1, height: 18, backgroundColor: C.lineStrong, marginHorizontal: 4 },
});
