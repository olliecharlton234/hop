/* Did this app open from a shared link (an outing, venue, event or memory), rather than cold? */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

function isContentLink(url: string | null | undefined) {
  if (!url) return false;
  const { path, queryParams } = Linking.parse(url);
  const p = (path || '').replace(/^\/+/, '');
  return /^(outing|outings|event|events|venue|memory|memories)\//.test(p) || !!(queryParams && (queryParams.venue || queryParams.event || queryParams.area));
}
export async function entryIsLink(): Promise<boolean> {
  if (Platform.OS === 'web') return typeof window !== 'undefined' && isContentLink(window.location.href);
  try { return isContentLink(await Linking.getInitialURL()); } catch { return false; }
}
