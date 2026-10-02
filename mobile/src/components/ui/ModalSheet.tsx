/* Modal bottom sheet (save, report, share, invite, who's coming…). One at a time, opened
   imperatively like V5's ui.openModal: modal.open(<SaveSheet … />). */
import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/theme';
import { IconButton } from './Button';

let current: { node: ReactNode; key: number; onClose?: () => void } | null = null;
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
export const modal = {
  open(node: ReactNode, onClose?: () => void) { current = { node, key: ++seq, onClose }; emit(); },
  close() { const c = current; current = null; emit(); c?.onClose?.(); },
  get isOpen() { return !!current; },
};

export function ModalHost() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!current} transparent animationType="slide" onRequestClose={() => modal.close()} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={st.scrim} onPress={() => modal.close()} accessibilityLabel="Close" />
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} key={current?.key}>
          <View style={st.grab}><View style={st.grabBar} /></View>
          {current?.node}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Standard modal layout: title row with close + scrolling body + optional footer */
export function SheetBody({ title, children, footer, left, testID }: { title: string; children?: ReactNode; footer?: ReactNode; left?: ReactNode; testID?: string }) {
  return (
    <View style={{ flexShrink: 1 }} testID={testID}>
      <View style={st.head}>
        {left}
        <Text style={st.title} numberOfLines={2}>{title}</Text>
        <IconButton name="close" bare label="Close" onPress={() => modal.close()} />
      </View>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
    </View>
  );
}

const st = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', flexDirection: 'column', backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderColor: C.lineStrong },
  grab: { height: 20, alignItems: 'center', justifyContent: 'center' },
  grabBar: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.lineStrong },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingBottom: 8, gap: 8 },
  title: { flex: 1, fontFamily: F.display, fontSize: 21, color: C.text },
});
