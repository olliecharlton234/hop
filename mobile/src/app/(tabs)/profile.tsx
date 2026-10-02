import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C, F } from '@/theme';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Seg } from '@/components/ui/Seg';
import { Empty, Section } from '@/components/ui/Layout';
import { confirm } from '@/components/sheets/modals';
import { MemoriesByYear } from '@/components/outings/OutingCard';
import { useHop, deepEqual, resetStore } from '@/store/hopStore';
import { setUi, useUi, panel } from '@/store/uiStore';
import { outingService } from '@/services/outingService';
import { friendService } from '@/services/friendService';
import { photoService } from '@/services/photoService';
import { locationService } from '@/services/locationService';
import { toast } from '@/services/notificationService';
import { useLocation } from '@/hooks/useLocation';
import { clock, now } from '@/utils/clock';
import { plural } from '@/utils/format';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const loc = useLocation();
  const preview = useUi((u) => u.previewHour);
  const d = useHop(() => {
    const me = friendService.me();
    const { memories } = outingService.mine();
    const year = new Date(now()).getFullYear();
    const thisYear = memories.filter((o) => new Date(o.startsAt).getFullYear() === year);
    const people = new Set<string>(); thisYear.forEach((o) => outingService.going(o.id).forEach((a) => a.userId !== me.id && people.add(a.userId)));
    return { meId: me.id, name: me.name, handle: me.handle, suburb: me.suburb, year, nights: thisYear.length, photos: thisYear.reduce((n, o) => n + photoService.album(o.id).length, 0), people: people.size,
      friends: friendService.byNights().filter((f) => f.n > 0).slice(0, 10).map((f) => ({ id: f.u.id, n: f.n })), memories: memories.map((o) => o.id) };
  }, [], deepEqual);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.surface }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 30 }} testID="profile-screen">
      <View style={st.prof}><Avatar user={friendService.user(d.meId)} size={64} /><View style={{ flex: 1 }}><Text style={st.h1}>{d.name}</Text><Text style={st.meta}>@{d.handle} · {d.suburb}</Text></View></View>
      <View style={st.stats}>
        {[[d.nights, `nights in ${d.year}`], [d.photos, 'photos'], [d.people, 'people']].map(([n, l], i) => <View key={i} style={[st.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}><Text style={st.statN}>{n}</Text><Text style={st.statL}>{l}</Text></View>)}
      </View>
      {d.friends.length ? (
        <Section title="Who you go out with">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {d.friends.map((f) => <View key={f.id} style={{ alignItems: 'center', width: 60 }}><Avatar user={friendService.user(f.id)} size={52} /><Text numberOfLines={1} style={st.pb}>{friendService.user(f.id)?.first}</Text><Text style={st.ps}>{plural(f.n, 'night')}</Text></View>)}
          </ScrollView>
        </Section>
      ) : null}
      <Section title="Your outings">{d.memories.length ? <MemoriesByYear ids={d.memories} /> : <Empty>Nothing yet.</Empty>}</Section>

      <View style={st.demo}>
        <Text style={st.label}>PROTOTYPE · DEMO CONTROLS</Text>
        <Text style={st.meta}>Viewing as</Text>
        <Seg value={d.meId} options={[['u_ollie', 'Ollie'], ['u_jack', 'Jack'], ['u_sarah', 'Sarah']]} onChange={(id) => { friendService.setMe(id); toast(`Viewing as ${friendService.user(id)?.first}`); }} />
        <Text style={st.meta}>Location</Text>
        <Seg value={loc.mode} options={[['demo', 'Demo (Surry Hills)'], ['device', 'My location']]} onChange={async (m) => { if (m === 'demo') locationService.useDemo(); else { const r = await locationService.locate(); if (!r.ok) toast(r.message); } }} />
        <Text style={st.meta}>Preview how Home changes through the day</Text>
        <Seg value={preview == null ? 'now' : String(preview)} options={[['now', 'Now'], ['10', 'Morning'], ['15', 'Afternoon'], ['19', 'Evening'], ['0', 'Late']]}
          onChange={(k) => { setUi({ previewHour: k === 'now' ? null : Number(k) }); panel.reset(); router.navigate('/'); toast(k === 'now' ? 'Back to now' : 'Previewing Home at that time of day'); }} />
        <Button sm title="Remove Ollie’s Birthday (to create it fresh)" onPress={() => { const o = outingService.mine().upcoming.find((x) => x.title === "Ollie's Birthday"); if (o) outingService.remove(o.id); toast('Gone. Tap + to plan it from scratch.'); }} />
        <Button sm title={clock.realtime ? 'Use demo time (Friday 7 PM)' : 'Use real time'} onPress={() => confirm({ title: clock.realtime ? 'Use demo time?' : 'Use real time?', text: 'This resets the demo data so everything lines up with the new clock.', ok: 'Reset and switch', onOk: () => { resetStore(!clock.realtime); toast('Clock changed'); } })} />
        <Button testID="reset-demo" sm title="Reset demo data" onPress={() => confirm({ title: 'Reset demo data?', text: 'Everything goes back to Friday 7:04 PM with the original outings, chats and photos.', ok: 'Reset', danger: true, onOk: () => { resetStore(); panel.reset(); toast('Demo data reset'); } })} />
        <Text style={[st.meta, { fontSize: 12 }]}>Friends, crowd reports, public photos and the city’s activity are demo data. The group simulator posts photos and replies on live outings so you can see HOP move.</Text>
      </View>
    </ScrollView>
  );
}
const st = StyleSheet.create({
  prof: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  h1: { fontFamily: F.display, fontSize: 26, color: C.text },
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2, marginTop: 4 },
  stats: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 10, marginTop: 16 },
  stat: { flex: 1, padding: 12 },
  statN: { fontFamily: F.display, fontSize: 22, color: C.text },
  statL: { fontFamily: F.body, fontSize: 12, color: C.text2 },
  pb: { fontFamily: F.bodyBold, fontSize: 13, color: C.text, marginTop: 6 },
  ps: { fontFamily: F.body, fontSize: 11.5, color: C.text2 },
  demo: { marginTop: 28, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, gap: 8 },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3 },
});
