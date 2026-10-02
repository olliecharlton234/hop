/* Time picker as a bottom sheet (same on iOS, Android and web): −15 / +15 minutes, an
   hour stepper, and the result in words. Late times belong to the same night. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';
import { modal, SheetBody } from './ModalSheet';
import { Button, BtnRow } from './Button';
import { time, when } from '@/utils/format';

export function openTimeSheet({ title, at, onSave, withDay }: { title: string; at: number; onSave: (t: number) => void; withDay?: boolean }) {
  modal.open(<TimeSheet title={title} at={at} onSave={onSave} withDay={withDay} />);
}
function TimeSheet({ title, at, onSave, withDay }: { title: string; at: number; onSave: (t: number) => void; withDay?: boolean }) {
  const [t, setT] = useState(at);
  const step = (m: number) => setT((x) => x + m * 6e4);
  return (
    <SheetBody title={title} footer={<Button testID="time-save" title="Save" variant="primary" block onPress={() => { modal.close(); onSave(t); }} />}>
      <Text style={st.big} testID="time-value">{time(t)}</Text>
      <Text style={st.sub}>{when(t)}</Text>
      <BtnRow style={{ marginTop: 14 }}>
        <Button testID="time-minus-60" style={{ flex: 1 }} title="−1h" onPress={() => step(-60)} />
        <Button testID="time-minus-15" style={{ flex: 1 }} title="−15m" onPress={() => step(-15)} />
        <Button testID="time-plus-15" style={{ flex: 1 }} title="+15m" onPress={() => step(15)} />
        <Button testID="time-plus-60" style={{ flex: 1 }} title="+1h" onPress={() => step(60)} />
      </BtnRow>
      {withDay ? (
        <BtnRow style={{ marginTop: 8 }}>
          <Button style={{ flex: 1 }} title="Day before" onPress={() => step(-1440)} />
          <Button style={{ flex: 1 }} title="Day after" onPress={() => step(1440)} />
        </BtnRow>
      ) : null}
      <View style={{ height: 8 }} />
    </SheetBody>
  );
}
const st = StyleSheet.create({
  big: { fontFamily: F.display, fontSize: 44, color: C.text, textAlign: 'center', marginTop: 6 },
  sub: { fontFamily: F.body, fontSize: 14, color: C.text2, textAlign: 'center', marginTop: 4 },
});
