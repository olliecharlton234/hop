/* Photos. Capture/pick → shrink on device → keep in app storage → add to the outing album.
   The outing album is the canonical home of every photo. Sharing publicly at a venue is a
   separate, explicit opt-in that points back to the album photo.
   V7: upload the original + thumbnail to Supabase Storage and insert a photos row. */
import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as R from '@/data/demo/repository';
import { localPhotos } from './localPhotos';
import type { Photo } from '@/types/models';

async function shrink(uri: string, max: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: max });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress, format: SaveFormat.JPEG });
  return out;
}

/** Copy into the app's document directory so photos survive cache clearing (web: IndexedDB) */
async function keep(uri: string, name: string) {
  if (Platform.OS === 'web') return localPhotos.save(uri, name); // IndexedDB
  try {
    const { File, Directory, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, name);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export type PickedImage = { uri: string; width?: number; height?: number };

export const photoService = {
  album: R.photosOf,
  get: R.photoById,
  venueOf: R.photoVenue,
  setVisibility: R.setPhotoVisibility,
  sharePublicly: R.sharePhotoPublicly,
  unsharePublicly: R.unsharePhotoPublicly,

  /** Shrink to a 1600px display copy + 400px thumbnail. Never keep full-resolution copies in lists. */
  async prepare(img: PickedImage): Promise<{ src: string; thumb: string }> {
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      const [big, small] = await Promise.all([shrink(img.uri, Math.min(1600, img.width || 1600), 0.82), shrink(img.uri, 400, 0.7)]);
      return { src: await keep(big.uri, `hop-${stamp}.jpg`), thumb: await keep(small.uri, `hop-${stamp}-t.jpg`) };
    } catch {
      return { src: img.uri, thumb: img.uri };
    }
  },

  /** Add prepared photos to an outing, tagged with user, time and the current stop */
  async addToOuting(outingId: string, imgs: PickedImage[], opts: { visibility: Photo['visibility']; source: Photo['source']; stopId?: string | null }) {
    const items = [];
    for (const i of imgs) items.push(await this.prepare(i));
    return R.addPhotos(outingId, items, opts);
  },

  /** Optional: also save to the camera roll (asks for write-only permission the first time) */
  async saveToCameraRoll(uri: string): Promise<boolean> {
    if (Platform.OS === 'web') { // web: download the file (iPhone: lands in Files; long-press a photo to save to Photos)
      try {
        const url = await localPhotos.resolve(uri); if (!url) return false;
        const a = document.createElement('a'); a.href = url; a.download = `hop-${Date.now()}.jpg`; document.body.appendChild(a); a.click(); a.remove();
        return true;
      } catch { return false; }
    }
    try {
      const ML = await import('expo-media-library/legacy');
      const perm = await ML.requestPermissionsAsync(true);
      if (!perm.granted) return false;
      await ML.saveToLibraryAsync(uri);
      return true;
    } catch {
      return false;
    }
  },
};
