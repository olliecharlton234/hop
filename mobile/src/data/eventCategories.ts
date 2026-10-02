import type { EventCategory } from '@/types/models';

export const EVENT_CATS: Record<EventCategory, { label: string; groups: string[] }> = {
  club: { label: 'Club night', groups: ['nightlife', 'music'] },
  live: { label: 'Live music', groups: ['music'] },
  dj: { label: 'DJ set', groups: ['music', 'nightlife'] },
  pub: { label: 'Pub event', groups: ['nightlife'] },
  trivia: { label: 'Trivia', groups: ['nightlife'] },
  happyhour: { label: 'Happy hour', groups: ['nightlife', 'food'] },
  festival: { label: 'Festival', groups: ['music', 'food'] },
  market: { label: 'Market', groups: ['food'] },
  run: { label: 'Run club', groups: ['sport'] },
  comedy: { label: 'Comedy', groups: ['nightlife', 'comedy'] },
  exhibition: { label: 'Exhibition', groups: [] },
  sport: { label: 'Sports screening', groups: ['sport'] },
  food: { label: 'Food event', groups: ['food'] },
};

export const VENUE_CAT_LABEL: Record<string, string> = { pub: 'Pub', bar: 'Bar', club: 'Club', food: 'Food', gig: 'Live music', spot: 'Spot' };
