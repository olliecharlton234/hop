/* Sharing goes through the operating system share sheet (iMessage, WhatsApp, Messenger,
   Instagram…). No direct integrations. */
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
export const shareService = {
  async share({ title, message, url }: { title: string; message: string; url?: string }): Promise<'shared' | 'copied' | 'dismissed'> {
    try {
      if (Platform.OS === 'web' && !(navigator as any).share) { await Clipboard.setStringAsync(url ? `${message} ${url}` : message); return 'copied'; }
      const res = await Share.share(Platform.OS === 'ios' && url ? { title, message, url } : { title, message: url ? `${message} ${url}` : message });
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch {
      await Clipboard.setStringAsync(url ? `${message} ${url}` : message);
      return 'copied';
    }
  },
  copy: (text: string) => Clipboard.setStringAsync(text),
};
