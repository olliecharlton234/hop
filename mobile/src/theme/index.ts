// HOP visual identity, carried over from the V5 prototype (css/app.css :root).
// Dark map, charcoal chrome, sodium-amber accent, semantic heat colours.
export const C = {
  ink: '#0d0e11', // app chrome
  surface: '#16181d', // sheets
  surface2: '#1e2127', // controls on the sheet
  surface3: '#272b33',
  line: '#2a2e36',
  lineStrong: '#3b404b',
  text: '#f3f0ea', // warm white
  text2: '#a8a9ae',
  text3: '#70737b',
  accent: '#ffad1f', // sodium-vapour amber
  accentInk: '#1b1204',
  accentSoft: 'rgba(255,173,31,0.14)',
  live: '#ff4b3a',
  going: '#48d18a',
  maybe: '#f5c451',
  blue: '#4da3ff',
  event: '#6fd3e3', // public events: cool, never read as your plans
  hot: '#ff7b47',
  mapBg: '#0b0d10',
} as const;

// Five activity levels: blue/cyan quiet → green → yellow → orange → red packed.
// Same values as the heat ramp (components/heatmap/heatImage.ts).
export const LV = ['#3fb6e8', '#3ecf8e', '#f2d24b', '#ff8f2e', '#ff4438'] as const;

// Venue category colours (pin glyphs)
export const CAT_COLOR: Record<string, string> = {
  pub: '#e9b86a', bar: '#ef9a83', club: '#86bdf0', food: '#a6d18f', gig: '#e9a4cb', spot: '#e8e2d4',
};

export const F = {
  display: 'Archivo_800ExtraBold',
  displayBlack: 'Archivo_900Black',
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodySemi: 'InstrumentSans_600SemiBold',
  bodyBold: 'InstrumentSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
} as const;

export const GUTTER = 16;
export const NAV_H = 62;

// Hue-based placeholder tint (avatars, photos before they load)
export const hue = (s: string) => { let h = 0; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) % 360; return h; };
export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
