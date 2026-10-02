/* HOP data model. Shaped so the demo repository (src/data/demo) can be swapped for
   Supabase/Postgres later without the UI changing. Timestamps are epoch milliseconds. */

export type ID = string;
export type LatLng = { lat: number; lng: number };

/** Unsplash reference with optional focal-point crop, or a local/remote uri. */
export type ImageRef = { id: string; fx?: string; fy?: string; fz?: string } | string;

// ---------------------------------------------------------------- people
export interface User {
  id: ID;
  name: string;
  first: string;
  handle: string;
  avatar: string | null;
  suburb: string;
}
/** A friend, as the viewer sees them (friendship is mutual and opt-in). */
export interface Friend extends User {
  nightsTogether: number;
}
/** Where a friend is right now: only from outings you can see, or explicit sharing. Never tracked. */
export interface FriendPresence {
  user: User;
  venueId: ID | null;
  eventId: ID | null;
  outingId: ID | null;
  since: number;
}

// ---------------------------------------------------------------- places + events
export type VenueCategory = 'pub' | 'bar' | 'club' | 'food' | 'gig' | 'spot';
export interface Venue extends LatLng {
  id: ID;
  name: string;
  cat: VenueCategory;
  suburb: string;
  address: string;
  price: string;
  hours: string;
  blurb: string;
  img: ImageRef;
  claimed: boolean;
  deals: string[];
}
/** A place that isn't a venue (park, foreshore, street) */
export interface Place extends LatLng { id?: ID; name: string; suburb: string; address?: string; img?: ImageRef }

export type EventCategory = 'club' | 'live' | 'dj' | 'pub' | 'trivia' | 'happyhour' | 'festival' | 'market' | 'run' | 'comedy' | 'exhibition' | 'sport' | 'food';
export interface EventPublisher { type: 'venue' | 'feed' | 'community'; name: string; verified: boolean }
export interface HopEvent {
  id: ID;
  title: string;
  cat: EventCategory;
  venueId: ID | null;
  place: Place | null;
  startsAt: number;
  endsAt: number;
  price: number;
  priceLabel: string;
  genre: string;
  blurb: string;
  img: ImageRef | null;
  interested: number;
  friendIds: ID[];
  publisher: EventPublisher;
  deal: string | null;
  promoted: boolean;
  recurs: 'weekly' | null;
  ticketUrl: string | null;
  source: string;
}

// ---------------------------------------------------------------- outings
export type OutingStatus = 'planning' | 'live' | 'ended';
export type Visibility = 'private' | 'public';
export type Rsvp = 'going' | 'maybe' | 'invited' | 'declined';
export type OutingIcon = 'cake' | 'beer' | 'cocktail' | 'glass' | 'disco' | 'music' | 'guitar' | 'food' | 'bowl' | 'beach' | 'sun' | 'party' | 'fireworks' | 'mic' | 'ball' | 'run' | 'star';

export interface OutingActivity { id: ID; type: string; userId?: ID | null; venueId?: ID | null; eventId?: ID | null; count?: number; at: number }
export interface Outing {
  id: ID;
  title: string;
  icon: OutingIcon;
  cover: string | null;
  kind: 'night';
  visibility: Visibility;
  organiserId: ID;
  status: OutingStatus;
  startsAt: number;
  createdAt: number;
  endedAt: number | null;
  live: { current: number; startedAt: number; arrivedAt: number } | null;
  inviteCode: string;
  activity: OutingActivity[];
}
export interface OutingMember {
  id: ID;
  outingId: ID;
  userId: ID;
  rsvp: Rsvp;
  role: 'organiser' | 'guest';
  invitedBy: ID;
  respondedAt: number | null;
  shareLocation: boolean;
}
export interface OutingStop {
  id: ID;
  outingId: ID;
  venueId: ID | null;
  eventId?: ID | null;
  place?: Place | null;
  order: number;
  at: number;
}

// ---------------------------------------------------------------- photos + chat
export type PhotoVisibility = 'outing' | 'private';
export interface Photo {
  id: ID;
  outingId: ID;
  stopId: ID | null;
  userId: ID;
  takenAt: number;
  visibility: PhotoVisibility;
  source: 'camera' | 'upload';
  u?: ImageRef; // demo imagery
  src?: string; // local file / remote url
  thumb?: string;
  /** set when the owner also shared it publicly at the venue (the album keeps the original) */
  publicAt?: ID | null;
}
/** A photo visible publicly at a venue. Points back to the outing photo when it came from one. */
export interface PublicPhoto {
  id: ID;
  venueId: ID;
  takenAt: number;
  u?: ImageRef;
  src?: string;
  userId: ID | null; // null = anonymous
  sourcePhotoId?: ID | null;
  visibility: 'public';
  demo?: boolean;
}

export type MessageKind = 'text' | 'system' | 'place' | 'location' | 'poll' | 'photo';
export interface SystemPayload { type: 'joined' | 'stop' | 'moved' | 'next' | 'started' | 'ended' | 'photos' | 'poll'; userId?: ID | null; venueId?: ID | null; eventId?: ID | null; count?: number; photoIds?: ID[]; at?: number }
export interface PollOption { venueId: ID; votes: ID[] }
export interface Message {
  id: ID;
  outingId: ID;
  userId: ID | null;
  kind: MessageKind;
  at: number;
  text?: string | null;
  replyTo?: ID | null;
  reactions: Record<string, ID[]>;
  sys?: SystemPayload;
  place?: { venueId?: ID; eventId?: ID };
  keen?: ID[];
  loc?: LatLng & { label: string; until: number };
  poll?: { q: string; closed: boolean; options: PollOption[] };
  photoIds?: ID[];
}
export type ChatPref = 'all' | 'mentions' | 'mute';
export type ChatPhase = 'before' | 'during' | 'after' | 'closed';

// ---------------------------------------------------------------- reports, saved, activity
export type ReportKind = 'crowd' | 'queue' | 'entry' | 'vibe';
export interface CrowdReport { id: ID; venueId: ID; kind: ReportKind; value: string; at: number; userId: ID | null; demo?: boolean }
export interface ReportSummary { value: string; label: string; n: number; last: number }

export type SavedRef = { venueId: ID; eventId?: undefined } | { eventId: ID; venueId?: undefined };
export interface SavedCollection { id: ID; name: string; items: SavedRef[] }
/** One saved place/event inside a collection (flattened view) */
export interface SavedPlace { collectionId: ID; ref: SavedRef }

export type ActivityLevel = 'QUIET' | 'MODERATE' | 'BUSY' | 'VERY_BUSY' | 'PACKED';
export type TimeWindow = 'now' | 'later' | 'tomorrow' | 'weekend';
/** What the map consumes. Grid today, H3 cells later. */
export interface ActivityCell {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number; // 0..1
  activityLevel: ActivityLevel;
  confidence: number; // 0..1
  timeWindow: TimeWindow;
  isForecast: boolean;
}
export interface ActivityGrid {
  lat0: number; lng0: number; step: number; nx: number; ny: number;
  cells: ActivityCell[];
  isForecast: boolean;
  timeWindow: TimeWindow;
}
export interface Area extends LatLng { id: ID; name: string; r: number; suburbs: string[] }
export interface AreaInfo {
  area: Area;
  heat: number;
  level: string; // "Very busy"
  code: ActivityLevel;
  lv: number; // 0..4
  trend: 'rising' | 'easing' | 'steady';
  peak: string;
  peakLevel: string;
  note: string;
  span: string;
  t: number;
  isNow: boolean;
}
export interface VenueActivity {
  busy: number;
  label: string;
  lv: number;
  trend: 'rising' | 'easing' | 'steady';
  hot: boolean;
  friends: FriendPresence[];
  liveHere: Outing[];
  tonightPhotos: Photo[];
}

// ---------------------------------------------------------------- in-app notifications
export interface HopNotification {
  id: ID;
  kind: 'photos' | 'chat' | 'rsvp' | 'live' | 'info';
  title: string;
  text?: string;
  outingId?: ID;
  userId?: ID;
  photoIds?: ID[];
  at: number;
}
