/* Sharing goes through the operating system share sheet (iMessage, WhatsApp, Messenger,
   Instagram…), on web via the Web Share API, with copy-the-link as the fallback.
   No direct integrations. */
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
export const shareService = {
  async share({ title, message, url }: { title: string; message: string; url?: string }): Promise<'shared' | 'copied' | 'dismissed'> {
    const text = url ? `${message} ${url}` : message;
    if (Platform.OS === 'web') {
      // Web Share API (iPhone Safari, Android Chrome) → the phone's share sheet; otherwise copy the link
      const nav = navigator as any;
      if (typeof nav.share === 'function') {
        try { await nav.share(url ? { title, text: message, url } : { title, text: message }); return 'shared'; }
        catch (e: any) { if (e?.name === 'AbortError') return 'dismissed'; }
      }
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
    try {
      const res = await Share.share(Platform.OS === 'ios' && url ? { title, message, url } : { title, message: text });
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch {
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
  },
  copy: (text: string) => Clipboard.setStringAsync(text),
  /** Share the photo itself where the browser supports sharing files (iPhone Safari, Android Chrome) */
  async shareImage(uri: string, text: string): Promise<'shared' | 'copied' | 'dismissed' | 'unsupported'> {
    if (Platform.OS !== 'web') { const r = await shareService.share({ title: 'Photo', message: text, url: uri }); return r; }
    try {
      const { localPhotos } = await import('./localPhotos');
      const url = await localPhotos.resolve(uri);
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'hop-photo.jpg', { type: blob.type || 'image/jpeg' });
      const nav = navigator as any;
      if (!nav.canShare?.({ files: [file] })) return 'unsupported';
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e: any) { return e?.name === 'AbortError' ? 'dismissed' : 'unsupported'; }
  },
};
