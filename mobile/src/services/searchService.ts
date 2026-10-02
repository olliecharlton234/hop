import * as R from '@/data/demo/repository';
import { hop } from '@/store/hopStore';
export const searchService = {
  recent: () => hop.state.recentSearches,
  remember: R.rememberSearch,
};
