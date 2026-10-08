/* Invite-first entry: /outing/<id>?i=<plan>. Opens straight onto the outing with
   JOIN OUTING, with no homepage or onboarding in the way. */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { C, F } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { linkService } from '@/services/linkService';
import { analytics } from '@/services/analytics';

export default function OutingLink() {
  const { id, i } = useLocalSearchParams<{ id: string; i?: string }>();
  const res = useMemo(() => {
    const r = linkService.resolveOuting(id, i);
    analytics.track('invite_opened', { found: r.ok, imported: r.ok && r.imported });
    return r;
  }, [id, i]);
  if (res.ok) return <Redirect href={{ pathname: '/outings/[id]', params: { id } }} />;
  return (
    <View style={st.root} testID="link-missing">
      <Icon name="link" size={34} color={C.accent} />
      <Text style={st.h1}>This plan isn’t available</Text>
      <Text style={st.meta}>The link might be cut short, or the outing was deleted. Ask whoever sent it to share it again.</Text>
      <Button variant="primary" title="Open HOP" onPress={() => router.replace('/')} />
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink, padding: 28, justifyContent: 'center', gap: 14 },
  h1: { fontFamily: F.display, fontSize: 28, lineHeight: 31, color: C.text },
  meta: { fontFamily: F.body, fontSize: 15, lineHeight: 21, color: C.text2, marginBottom: 6 },
});
