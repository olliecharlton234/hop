/* Crowd reports: structured (crowd, queue, entry, music/vibe), anonymous, decaying.
   A separate data source; the activity model reads them as one capped signal. */
import * as R from '@/data/demo/repository';
import { locationService } from './locationService';
export const reportService = {
  KINDS: R.REPORT_KINDS,
  summary: R.reportsAt,
  hasDemo: R.hasDemoReports,
  canReport: (venueId: string) => R.canReport(venueId, locationService.current()),
  add: R.addReport,
};
