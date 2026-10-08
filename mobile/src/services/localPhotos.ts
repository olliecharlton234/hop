/* Where photo files live on this device. Native: the app's document folder (see
   photoService.keep), so a stored uri is a normal file:// uri and needs no resolving.
   Web has its own implementation (localPhotos.web.ts) backed by IndexedDB. */
export const localPhotos = {
  /** Store a picked/processed image; returns the uri to keep in the outing album */
  async save(uri: string, _name: string): Promise<string> { return uri; },
  /** Resolve a stored uri to something an <Image> can show */
  peek(uri: string): string { return uri; },
  async resolve(uri: string): Promise<string> { return uri; },
};
export function useLocalPhotoUri(uri: string): string { return uri; }
