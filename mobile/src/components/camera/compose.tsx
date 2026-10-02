/* Adding photos: from the library (preview, who sees it, confirm) and the follow-up
   "Also share publicly at The Clock?" prompt. Keep with outing is always the default. */
import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { C, F } from '@/theme';
import { modal, SheetBody } from '@/components/ui/ModalSheet';
import { Button } from '@/components/ui/Button';
import { Seg } from '@/components/ui/Seg';
import { Icon } from '@/components/ui/Icon';
import { outingService } from '@/services/outingService';
import { photoService, type PickedImage } from '@/services/photoService';
import { toast } from '@/services/notificationService';
import { plural, time } from '@/utils/format';
import type { Photo } from '@/types/models';

/** Ask for library access only now, when the user wants to add photos */
export async function pickFromLibrary(outingId: string) {
  try {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain === false) {
      modal.open(
        <SheetBody title="Photo access is off" footer={<Button title="Open Settings" variant="primary" block onPress={() => { modal.close(); Linking.openSettings(); }} />}>
          <Text style={st.meta}>To add photos from your library, allow HOP to access your photos in Settings. Nothing is shared until you choose to add it.</Text>
        </SheetBody>,
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 1, orderedSelection: true });
    if (res.canceled || !res.assets?.length) return;
    openCompose(outingId, res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })), 'upload');
  } catch {
    toast('Couldn’t open your photos');
  }
}

export function openCompose(outingId: string, imgs: PickedImage[], source: Photo['source']) {
  modal.open(<Compose outingId={outingId} imgs={imgs} source={source} />);
}
function Compose({ outingId, imgs, source }: { outingId: string; imgs: PickedImage[]; source: Photo['source'] }) {
  const o = outingService.get(outingId)!;
  const st0 = outingService.stops(outingId);
  const stop = o.live ? st0[o.live.current] : st0[st0.length - 1];
  const [vis, setVis] = useState<Photo['visibility']>('outing');
  const [busy, setBusy] = useState(false);
  const post = async () => {
    setBusy(true);
    try {
      const added = await photoService.addToOuting(outingId, imgs, { visibility: vis, source, stopId: stop?.id });
      modal.close();
      afterAdd(outingId, added);
    } catch (e: any) { setBusy(false); toast(e?.message || 'Couldn’t add those photos'); }
  };
  return (
    <SheetBody title={imgs.length > 1 ? plural(imgs.length, 'photo') : 'New photo'} testID="compose"
      footer={<Button testID="compose-post" variant="primary" block disabled={busy} title={busy ? 'Adding…' : vis === 'outing' ? `Add to ${o.title}` : 'Keep it private'} onPress={post}>{busy ? <ActivityIndicator color={C.accentInk} /> : null}</Button>}>
      <Text style={[st.meta, { marginBottom: 10 }]}>{o.title}{stop ? ` · at ${outingService.stopName(stop)}` : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {imgs.map((i) => <Image key={i.uri} source={{ uri: i.uri }} style={{ width: imgs.length > 1 ? 120 : 300, height: imgs.length > 1 ? 150 : 300, borderRadius: 10 }} contentFit="cover" />)}
      </ScrollView>
      <Seg style={{ marginTop: 12 }} value={vis} onChange={setVis} options={[['outing', 'The outing', 'users'], ['private', 'Just me', 'lock']]} />
    </SheetBody>
  );
}

/** "Added to Ollie's Birthday — also share publicly at The Clock?" Default: keep with outing. */
export function afterAdd(outingId: string, added: Photo[], opts: { quiet?: boolean } = {}) {
  const o = outingService.get(outingId)!;
  if (!added.length) return;
  const st0 = outingService.stops(outingId).find((s) => s.id === added[0].stopId);
  const msg = added[0].visibility === 'private' ? 'Saved privately' : `Added to ${o.title}`;
  if (!opts.quiet) toast(`${msg}${st0 ? ` · ${outingService.stopName(st0)}` : ''} · ${time(added[0].takenAt)}`);
  const venue = photoService.venueOf(added[0]);
  if (added[0].visibility !== 'outing' || !venue) return;
  modal.open(<PublicPrompt outingTitle={o.title} venueName={venue.name} ids={added.map((p) => p.id)} />);
}
function PublicPrompt({ outingTitle, venueName, ids }: { outingTitle: string; venueName: string; ids: string[] }) {
  return (
    <SheetBody title={`Added to ${outingTitle}`} testID="public-prompt"
      footer={
        <View style={{ gap: 8 }}>
          <Button testID="keep-with-outing" variant="primary" block title="Keep with outing" onPress={() => modal.close()} />
          <Button testID="share-publicly" block icon="globe" title="Share publicly" onPress={() => { ids.forEach((id) => photoService.sharePublicly(id)); modal.close(); toast(`Shared publicly at ${venueName}. The original stays in the album.`); }} />
        </View>
      }>
      <View style={st.row}><Icon name="globe" size={20} color={C.text2} /><Text style={[st.b, { flex: 1 }]}>Also share {ids.length > 1 ? 'these' : 'it'} publicly at {venueName}?</Text></View>
      <Text style={[st.meta, { marginTop: 8 }]}>Public photos show on {venueName} and its neighbourhood for anyone on HOP, without the outing’s name or who you’re with. You can take it down any time from the photo.</Text>
    </SheetBody>
  );
}
const st = StyleSheet.create({
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.text2, lineHeight: 19 },
  b: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
