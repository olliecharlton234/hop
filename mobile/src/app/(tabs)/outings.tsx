import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Empty, Section } from '@/components/ui/Layout';
import { OutingRowBig } from '@/components/outings/OutingCard';
import { RsvpSeg } from '@/components/outings/RsvpSeg';
import { useHop, deepEqual } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { friendService } from '@/services/friendService';
import { go } from '@/utils/nav';

export default function Outings() {
  const insets = useSafeAreaInsets();
  const d = useHop(() => {
    const { live, invites, upcoming } = outingService.mine();
    return { live: live.map((o) => o.id), invites: invites.map((o) => ({ id: o.id, org: o.organiserId })), upcoming: upcoming.map((o) => o.id), pub: outingService.publicOutings().filter((o) => !outingService.myMembership(o.id)).map((o) => o.id) };
  }, [], deepEqual);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.surface }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 30 }} testID="outings-screen">
      <View style={st.head}><Text style={st.h1}>Outings</Text><Button testID="outings-new" sm variant="primary" icon="plus" title="New" onPress={() => go.create()} /></View>
      {d.live.length ? <Section title="Happening now">{d.live.map((id) => <OutingRowBig key={id} id={id} />)}</Section> : null}
      {d.invites.length ? (
        <Section title="Waiting on you">
          {d.invites.map((i) => (
            <View key={i.id} style={st.invite}>
              <View style={st.from}><Avatar user={friendService.user(i.org)} size={22} /><Text style={st.meta}>{friendService.user(i.org)?.first} invited you</Text></View>
              <OutingRowBig id={i.id} />
              <RsvpSeg id={i.id} />
            </View>
          ))}
        </Section>
      ) : null}
      <Section title="Coming up">{d.upcoming.length ? d.upcoming.map((id) => <OutingRowBig key={id} id={id} />) : <Empty>Nothing planned. Start one from the map.</Empty>}</Section>
      {d.pub.length ? <Section title="Public near you">{d.pub.map((id) => <OutingRowBig key={id} id={id} />)}</Section> : null}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: F.display, fontSize: 30, color: C.text },
  invite: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: C.surface2 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2 },
});
