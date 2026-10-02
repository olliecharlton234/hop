/* Venue and event details opened from screens other than the map (outing plan, chat cards…) */
import { ScrollView, View } from 'react-native';
import { modal } from '@/components/ui/ModalSheet';
import { IconButton } from '@/components/ui/Button';
import { VenueDetails } from '@/components/venues/VenueDetails';
import { EventDetails } from '@/components/events/EventDetails';
import { registerDetailModals } from '@/utils/nav';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexShrink: 1 }}>
      <View style={{ position: 'absolute', right: 8, top: -6, zIndex: 2 }}><IconButton name="close" bare label="Close" onPress={() => modal.close()} /></View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</ScrollView>
    </View>
  );
}
export function registerDetails() {
  registerDetailModals({
    venue: (id) => modal.open(<Frame><VenueDetails id={id} /></Frame>),
    event: (id) => modal.open(<Frame><EventDetails id={id} /></Frame>),
  });
}
