/* Saved collections: Want to go, Good pubs, Restaurants, Late night, Date night. */
import * as R from '@/data/demo/repository';
export const savedService = {
  collections: R.collections,
  collectionsOf: R.collectionsOf,
  isSaved: R.isSaved,
  set: R.setSaved,
  venueIds: R.savedVenueIds,
  eventIds: R.savedEventIds,
};
