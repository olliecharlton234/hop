/* "Add HOP to your Home Screen": a quiet, one-time tip on the web beta.
   iPhone: how to do it from Safari's Share menu. Android/Chrome: the browser's install flow.
   Shown once, after the person has had a moment on the map; never during onboarding,
   never over an invite, never once HOP is installed. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { modal, SheetBody } from '@/components/ui/ModalSheet';
import { getPrefs, setPrefs, usePrefs } from '@/store/prefs';
import { analytics } from '@/services/analytics';
import { toast } from '@/services/notificationService';
import { pwa, useInstallable } from '@/utils/pwa';

export function InstallTip({ top }: { top: number }) {
  const installable = useInstallable();
  const onboarded = usePrefs((p) => p.onboarded);
  const done = usePrefs((p) => p.installTipDone);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pwa.isWeb || !pwa.isMobile() || done || !onboarded || !installable) return;
    const t = setTimeout(() => { if (!getPrefs().installTipDone) { setShow(true); analytics.track('install_prompt_shown', { ios: pwa.isIOS() }); } }, getPrefs().opens > 1 ? 4000 : 20000);
    return () => clearTimeout(t);
  }, [done, onboarded, installable]);
  if (!show || done) return null;
  const close = () => { setShow(false); setPrefs({ installTipDone: true }); };
  const ios = pwa.isIOS();
  return (
    <View style={[st.card, { top }]} testID="install-tip">
      <View style={st.ic}><Text style={st.icT}>HOP</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={st.t}>Add HOP to your Home Screen</Text>
        <Text style={st.s}>{ios ? 'Open HOP like an app for the best experience. Tap ' : 'Open HOP like an app for the best experience.'}{ios ? <><Icon name="share" size={13} color={C.text} /> Share, then Add to Home Screen.</> : null}</Text>
        {!ios ? <Button sm variant="primary" title="Install" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={async () => { close(); const ok = await pwa.prompt(); analytics.track('install_accepted', { accepted: ok }); }} /> : null}
      </View>
      <Pressable testID="install-tip-close" accessibilityLabel="Dismiss" onPress={close} hitSlop={10} style={st.x}><Icon name="close" size={18} color={C.text2} /></Pressable>
    </View>
  );
}

/** Profile → "Add to Home Screen": the same help, on demand */
export function openInstallHelp() {
  if (pwa.canPrompt()) { pwa.prompt().then((ok) => { analytics.track('install_accepted', { accepted: ok }); if (ok) toast('HOP is on your Home Screen'); }); return; }
  modal.open(
    <SheetBody title="Add HOP to your Home Screen" testID="install-help">
      {pwa.isIOS() ? (
        <View style={{ gap: 12 }}>
          <Step n={1}>Open this page in <Text style={st.b}>Safari</Text>.</Step>
          <Step n={2}>Tap <Icon name="share" size={14} color={C.text} /> <Text style={st.b}>Share</Text> in the toolbar.</Step>
          <Step n={3}>Scroll down and tap <Text style={st.b}>Add to Home Screen</Text>, then <Text style={st.b}>Add</Text>.</Step>
          <Text style={st.meta}>HOP then opens full screen from its own icon, like an app.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Step n={1}>Open your browser’s menu (the three dots).</Step>
          <Step n={2}>Tap <Text style={st.b}>Install app</Text> or <Text style={st.b}>Add to Home screen</Text>.</Step>
        </View>
      )}
    </SheetBody>,
  );
}
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={st.num}><Text style={st.numT}>{n}</Text></View><Text style={[st.meta, { flex: 1, color: C.text }]}>{children}</Text></View>;
}
const st = StyleSheet.create({
  card: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  ic: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.ink, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  icT: { fontFamily: F.displayBlack, fontSize: 12, color: C.accent },
  t: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.text },
  s: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.text2, marginTop: 2 },
  x: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  b: { fontFamily: F.bodyBold, color: C.text },
  meta: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.text2 },
  num: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.displayBlack, fontSize: 12, color: C.accentInk },
});
