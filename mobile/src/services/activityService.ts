/* Activity: the UI only consumes ActivityCells and area summaries from here.
   V6: computed on the device by the demo model. V7: fetched from the backend (H3 cells,
   precomputed per time window), with the same shapes. */
import * as A from '@/data/demo/activityModel';
import type { TimeWindow } from '@/types/models';
export const activityService = {
  WINDOWS: A.WINDOWS,
  LEVELS: A.LEVELS,
  areas: () => A.AREAS,
  area: (id: string) => A.areaById[id],
  cells: (w: TimeWindow) => A.cells(w),
  areaInfo: A.areaInfo,
  areaPublic: A.areaPublic,
  why: A.why,
  areaAt: A.areaAt,
  areaOfVenue: A.areaOfVenue,
  areaOfPoint: A.areaOfPoint,
  levelAt: A.levelAt,
  level: A.level,
  levelIdx: A.levelIdx,
};
