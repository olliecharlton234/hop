/* New outing (or edit): occasion, icon or cover photo, when, privacy. From an event it
   proposes the shape of the night (dinner → event → drinks). Next: pick the stops. */
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { C, F } from '@/theme';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon, OutingIcon, OUTING_ICON_CHOICES, EVENT_ICON } from '@/components/ui/Icon';
import { Photo } from '@/components/ui/Photo';
import { openTimeSheet } from '@/components/ui/TimeSheet';
import { Choice } from '@/components/sheets/modals';
import { outingService } from '@/services/outingService';
import { eventService } from '@/services/eventService';
import { venueService } from '@/services/venueService';
import { friendService } from '@/services/friendService';
import { photoService } from '@/services/photoService';
import { planAround } from '@/services/planService';
import { toast } from '@/services/notificationService';
import { go } from '@/utils/nav';
import { now } from '@/utils/clock';
import { DAYS_LONG, timeShort, when } from '@/utils/format';
import type { OutingIcon as OI, Visibility } from '@/types/models';

const nextDow = (dow: number, h = 19, m = 30) => { const d = new Date(now()); d.setHours(h, m, 0, 0); while (d.getDay() !== dow || d.getTime() < now() - 6 * 36e5) d.setDate(d.getDate() + 1); return d.getTime(); };

export default function Create() {
  const p = useLocalSearchParams<{ edit?: string; venue?: string; event?: string }>();
  const insets = useSafeAreaInsets();
  const src = p.edit ? outingService.get(p.edit) : undefined;
  const ev = p.event ? eventService.byId(p.event) : undefined;
  const plan = useMemo(() => (ev ? planAround(ev) : null), [ev]);
  const [title, setTitle] = useState(src ? src.title : ev ? ev.title.replace(/ — .*/, '') : '');
  const [icon, setIcon] = useState<OI>((src ? src.icon : ev ? EVENT_ICON[ev.cat] || 'party' : 'cake') as OI);
  const [cover, setCover] = useState<string | null>(src?.cover || null);
  const [at, setAt] = useState<number>(src ? src.startsAt : plan ? plan[0].at : nextDow(6));
  const [vis, setVis] = useState<Visibility>(src ? src.visibility : 'private');
  const [wrap, setWrap] = useState(true);
  const v = p.venue ? venueService.byId(p.venue) : undefined;
  const placeholder = `${friendService.me().first}'s Birthday`;
  const day = (t: number) => new Date(t).toDateString();
  const quick: [string, number][] = [['Tonight', (() => { const d = new Date(now()); d.setHours(new Date(at).getHours(), new Date(at).getMinutes(), 0, 0); return d.getTime(); })()], ['Fri', nextDow(5, new Date(at).getHours(), new Date(at).getMinutes())], ['Sat', nextDow(6, new Date(at).getHours(), new Date(at).getMinutes())]];

  const pickCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets?.[0]) return;
    const { thumb } = await photoService.prepare({ uri: r.assets[0].uri, width: r.assets[0].width });
    setCover(thumb);
  };
  const go_ = () => {
    const name = title.trim() || placeholder;
    if (src) { outingService.update(src.id, { title: name, icon, cover, startsAt: at, visibility: vis }); toast('Saved'); router.back(); return; }
    if (ev && plan) {
      const items = plan.filter((x) => wrap || x.eventId);
      const delta = at - items[0].at;
      const o = outingService.create({ title: name, icon, cover, startsAt: at, visibility: vis });
      items.forEach((x) => (x.eventId ? outingService.addEventStop(o.id, x.eventId) : outingService.addStop(o.id, x.venueId!, x.at + delta)));
      router.replace({ pathname: '/outings/[id]', params: { id: o.id } });
      toast(items.length > 1 ? `${items.map((x) => x.role.split(' ')[0]).join(' → ')}. Swap any stop, then invite people.` : 'Created. Add stops or invite people.');
      return;
    }
    const o = outingService.create({ title: name, icon, cover, startsAt: at, visibility: vis });
    if (v) outingService.addStop(o.id, v.id);
    router.back();
    setTimeout(() => go.pick(o.id), 50);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 16), paddingBottom: insets.bottom + 24, gap: 20 }} keyboardShouldPersistTaps="handled" testID="create-screen">
        <View style={st.head}><Text style={st.h1}>{src ? 'Edit outing' : 'New outing'}</Text><IconButton name="close" bare label="Cancel" onPress={() => router.back()} /></View>
        <View>
          <Text style={st.label}>WHAT’S THE OCCASION?</Text>
          <TextInput testID="create-title" value={title} onChangeText={setTitle} placeholder={placeholder} placeholderTextColor={C.text3} maxLength={48} style={st.name} autoFocus={!src && Platform.OS !== 'web'} />
        </View>
        <View>
          <Text style={st.label}>ICON</Text>
          <View style={st.icons}>
            {OUTING_ICON_CHOICES.map((k) => (
              <Pressable key={k} testID={`icon-${k}`} accessibilityLabel={k} onPress={() => { setIcon(k as OI); setCover(null); }} style={[st.ic, !cover && icon === k && st.icOn]}><OutingIcon icon={k} size={22} color={!cover && icon === k ? C.accent : C.text2} /></Pressable>
            ))}
            <Pressable accessibilityLabel="Use a photo" onPress={pickCover} style={[st.ic, cover ? st.icOn : null]}>{cover ? <Photo p={{ id: 'cover', src: cover }} w={100} radius={8} style={{ width: 40, height: 40 }} /> : <Icon name="image" color={C.text2} />}</Pressable>
          </View>
        </View>
        <View>
          <Text style={st.label}>WHEN</Text>
          <View style={st.quick}>{quick.map(([l, t]) => <Pressable key={l} onPress={() => setAt(t)} style={[st.q, day(t) === day(at) && st.qOn]}><Text style={[st.qT, day(t) === day(at) && { color: C.text }]}>{l}</Text></Pressable>)}</View>
          <Pressable testID="create-when" onPress={() => openTimeSheet({ title: 'Starts', at, withDay: true, onSave: setAt })} style={st.when}>
            <Icon name="clock" color={C.text2} /><Text style={st.whenT}>{when(at)}</Text><Text style={st.whenS}>{DAYS_LONG[new Date(at).getDay()]}</Text>
          </Pressable>
        </View>
        <View>
          <Text style={st.label}>WHO CAN SEE IT</Text>
          <Choice testID="vis-private" on={vis === 'private'} icon="lock" title="Private" sub="Only people with the link" onPress={() => setVis('private')} />
          <Choice testID="vis-public" on={vis === 'public'} icon="globe" title="Public" sub="Shows on the map so anyone nearby can join" onPress={() => setVis('public')} />
        </View>
        {ev && plan ? (
          <View>
            <Text style={st.label}>THE PLAN</Text>
            {plan.filter((x) => wrap || x.eventId).map((x, i) => {
              const e = x.eventId ? eventService.byId(x.eventId) : undefined;
              const name = e ? e.title : venueService.byId(x.venueId!).name;
              const where = e ? eventService.placeOf(e)?.name : venueService.byId(x.venueId!).suburb;
              return (
                <View key={i} style={[st.pp, e && { borderColor: C.event }]}>
                  <View style={st.num}><Text style={st.numT}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}><Text style={st.ppB}>{name}</Text><Text style={st.ppS}>{x.role} · {where}</Text></View>
                  <Text style={st.ppT}>{timeShort(x.at)}</Text>
                </View>
              );
            })}
            <View style={st.check}><Switch value={wrap} onValueChange={setWrap} trackColor={{ true: C.accent, false: C.surface3 }} thumbColor={C.text} /><Text style={st.ppS}>Add dinner and drinks around it</Text></View>
          </View>
        ) : null}
        {v ? <Text style={st.ppS}>First stop: <Text style={{ color: C.text, fontFamily: F.bodyBold }}>{v.name}</Text>, {v.suburb}</Text> : null}
        <Button testID="create-go" variant="primary" block title={src ? 'Save' : ev ? 'Create the plan' : v ? 'Create and add more stops' : 'Next: pick the stops'} onPress={go_} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: F.display, fontSize: 30, color: C.text },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, color: C.text3, marginBottom: 8 },
  name: { fontFamily: F.display, fontSize: 26, color: C.text, borderBottomWidth: 1, borderBottomColor: C.lineStrong, paddingVertical: 8, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any,
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ic: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  icOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  quick: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  q: { paddingHorizontal: 14, height: 36, borderRadius: 9, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' },
  qOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  qT: { fontFamily: F.bodySemi, fontSize: 14, color: C.text2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface2 },
  whenT: { flex: 1, fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  whenS: { fontFamily: F.body, fontSize: 13, color: C.text3 },
  pp: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, marginBottom: 6 },
  num: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.displayBlack, fontSize: 13, color: C.accentInk },
  ppB: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  ppS: { fontFamily: F.body, fontSize: 13, color: C.text2 },
  ppT: { fontFamily: F.mono, fontSize: 12.5, color: C.accent },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
});
