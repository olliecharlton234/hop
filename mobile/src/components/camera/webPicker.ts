/* Web only: open the phone's own picker straight from the tap.
   On iPhone Safari this offers Take Photo / Photo Library; on Android Chrome, Camera / Files.
   It must run synchronously inside the tap handler (browsers block pickers opened later),
   which is why it doesn't go through the async expo-image-picker wrapper. */
import type { PickedImage } from '@/services/photoService';

export function pickImagesWeb({ multiple = true, capture = false }: { multiple?: boolean; capture?: boolean } = {}): Promise<PickedImage[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed'; input.style.left = '-1000px'; input.style.opacity = '0';
    input.setAttribute('data-testid', 'web-photo-input');
    let done = false;
    const finish = async () => {
      if (done) return; done = true;
      const files = Array.from(input.files || []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)).slice(0, 20);
      input.remove();
      const out: PickedImage[] = await Promise.all(files.map((f) => new Promise<PickedImage>((res) => {
        const uri = URL.createObjectURL(f);
        const im = new Image();
        im.onload = () => res({ uri, width: im.naturalWidth, height: im.naturalHeight });
        im.onerror = () => res({ uri });
        im.src = uri;
      })));
      resolve(out);
    };
    input.addEventListener('change', finish);
    input.addEventListener('cancel', () => { done = true; input.remove(); resolve([]); });
    document.body.appendChild(input);
    input.click();
  });
}
