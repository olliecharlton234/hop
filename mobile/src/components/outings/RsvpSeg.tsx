import { Seg } from '@/components/ui/Seg';
import { useHop } from '@/store/hopStore';
import { outingService } from '@/services/outingService';
import { toast } from '@/services/notificationService';
import { C } from '@/theme';
import type { Rsvp } from '@/types/models';

/** Going / Maybe / Can't go */
export function RsvpSeg({ id }: { id: string }) {
  const v = useHop(() => outingService.myMembership(id)?.rsvp ?? 'invited', [id]);
  return (
    <Seg<Rsvp> value={v === 'invited' ? null : v} options={[['going', 'Going'], ['maybe', 'Maybe'], ['declined', 'Can’t go']]}
      colors={{ going: [C.going, '#04170c'], maybe: [C.maybe, '#1d1503'] }}
      onChange={(k) => { outingService.rsvp(id, k); toast(({ going: 'You’re going', maybe: 'Marked as maybe', declined: 'Let them know you can’t make it' } as any)[k]); }} />
  );
}
