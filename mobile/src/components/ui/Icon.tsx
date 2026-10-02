import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { C } from '@/theme';
import { EVENT_GLYPHS, OUTING_ICONS, REACTIONS, UI_ICONS, VENUE_GLYPHS } from './iconPaths';

const xml = (paths: string, color: string, sw: number) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths.replace(/currentColor/g, color)}</svg>`;

type P = { size?: number; color?: string; strokeWidth?: number };
export type IconName = keyof typeof UI_ICONS;

/** Stroke icon from the HOP set (search, map, camera, …) */
export const Icon = memo(({ name, size = 20, color = C.text, strokeWidth = 1.8 }: P & { name: string }) => (
  <SvgXml xml={xml(UI_ICONS[name] || '', color, strokeWidth)} width={size} height={size} />
));
/** Outing icon (cake, beer, …). Outing.icon holds the key. */
export const OutingIcon = memo(({ icon, size = 20, color = C.accent }: P & { icon: string }) => (
  <SvgXml xml={xml(OUTING_ICONS[icon] || OUTING_ICONS.party, color, 1.8)} width={size} height={size} />
));
export const ReactionIcon = memo(({ k, size = 16, color = C.text }: P & { k: string }) => (
  <SvgXml xml={xml(REACTIONS[k] || REACTIONS.up, color, 1.8)} width={size} height={size} />
));
export const EventGlyph = memo(({ cat, size = 12, color = C.event }: P & { cat: string }) => (
  <SvgXml xml={xml(EVENT_GLYPHS[cat] || EVENT_GLYPHS.festival, color, 2.1)} width={size} height={size} />
));
export const VenueGlyph = memo(({ cat, size = 14, color = C.text2 }: P & { cat: string }) => (
  <SvgXml xml={xml(VENUE_GLYPHS[cat] || VENUE_GLYPHS.spot, color, 2)} width={size} height={size} />
));
export const REACTION_KEYS = ['up', 'heart', 'haha', 'fire', 'wow'] as const;
export const OUTING_ICON_CHOICES = ['cake', 'beer', 'cocktail', 'glass', 'disco', 'music', 'bowl', 'food', 'beach', 'party'] as const;
export const EVENT_ICON: Record<string, string> = { club: 'disco', dj: 'disco', live: 'music', festival: 'party', pub: 'beer', trivia: 'star', happyhour: 'cocktail', market: 'food', run: 'run', comedy: 'mic', exhibition: 'star', sport: 'ball', food: 'bowl' };
