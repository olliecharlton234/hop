/* Friends and where they are. Only from outings you can see or explicit, temporary sharing.
   HOP never tracks anyone in the background. */
import * as R from '@/data/demo/repository';
export const friendService = {
  users: () => R.users,
  user: (id?: string | null) => (id ? R.userById[id] : undefined),
  me: R.me,
  meId: R.getMeId,
  setMe: R.setMe,
  out: R.friendsOut,
  at: R.friendsAt,
  atEvent: R.friendsAtEvent,
  byNights: R.friendsByNights,
  sharedLocations: R.activeLocations,
};
