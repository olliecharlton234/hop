/* Web: the same fonts as small Latin-subset WOFF2 files (public/fonts, ~150 KB in total instead
   of ~800 KB of TTF), declared in public/index.html with font-display: swap. We wait briefly
   for the main faces so the first frame is in HOP's type, but never block on a slow network. */
import { useEffect, useState } from 'react';

const MAIN = ['InstrumentSans_400Regular', 'InstrumentSans_600SemiBold', 'InstrumentSans_700Bold', 'Archivo_800ExtraBold', 'IBMPlexMono_500Medium'];

export function useHopFonts(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const fonts = (document as any).fonts;
    if (!fonts?.load) { setOk(true); return; }
    const t = setTimeout(() => setOk(true), 1200);
    Promise.all(MAIN.map((f) => fonts.load(`16px "${f}"`))).finally(() => { clearTimeout(t); setOk(true); });
    return () => clearTimeout(t);
  }, []);
  return ok;
}
