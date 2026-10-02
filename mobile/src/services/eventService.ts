/* Public events: one normalised shape from pluggable sources (demo seed today; listings
   feeds and verified venues later). */
import * as R from '@/data/demo/repository';
export type { EventWhen } from '@/data/demo/repository';
export const eventService = {
  all: R.allEvents,
  byId: R.eventById,
  placeOf: R.eventPlace,
  isLive: R.eventLive,
  upcoming: R.upcomingEvents,
  filter: R.filterEvents,
  atVenue: R.eventsAtVenue,
  tonightAt: R.eventsTonightAt,
  toggleInterest: R.toggleInterest,
  dayKey: R.dayKey,
};
