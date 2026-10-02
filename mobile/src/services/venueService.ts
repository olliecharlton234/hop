/* Venues + live venue context. V7: venues table (PostGIS), venue_activity view. */
import * as R from '@/data/demo/repository';
export const venueService = {
  all: () => R.venues,
  byId: (id: string) => R.venueById[id],
  activity: R.venueActivity,
  memoryPhotos: R.memoryPhotosAt,
  publicPhotos: R.venuePhotos,
  pop: (id: string) => R.POP[id] || ([0.3, 21] as [number, number]),
  imagePool: R.poolFor,
  isLate: (v: { id: string; hours: string; cat: string }) => /till ([1-5])\s?am/i.test(v.hours) || (R.POP[v.id]?.[1] || 0) >= 23 || v.cat === 'club',
};
