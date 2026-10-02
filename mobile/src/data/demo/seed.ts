/* DEMO DATA — HOP V5 seed, ported unchanged in content.
   Real Sydney venues, 50 believable friends, tonight's outings, memories, public events,
   anonymous crowd reports and public venue photos. Everything here is simulated and is
   only ever read through src/data/demo/repository.ts, so it can be replaced by Supabase. */
import { rng, pick } from '@/utils/format';
import type { CrowdReport, Message, Outing, OutingMember, OutingStop, Photo, Place, PublicPhoto, SavedCollection, User, Venue, VenueCategory } from '@/types/models';

  // ---- Image pools (Unsplash photo ids) -----------------------------------
const P: Record<string, string[]> = {
  pub: ['1587574293340-e0011c4e8ecf', '1574096079513-d8259312b785', '1543007630-9710e4a00a20', '1575444758702-4a6b9222336e', '1575037614876-c38a4d44f5b8', '1527529482837-4698179dc6ce', '1528605105345-5344ea20e269', '1436076863939-06870fe779c2'],
  bar: ['1514933651103-005eec06c04b', '1470337458703-46ad1756a187', '1572116469696-31de0f17cc34', '1551024709-8f23befc6f87', '1514362545857-3bc16c4c7d1b', '1597290282695-edc43d0e7129', '1543007631-283050bb3e8c', '1546171753-97d7676e4602', '1525268323446-0505b6fe7778'],
  club: ['1566417713940-fe7c737a9ef2', '1516450360452-9312f5e86fc7', '1492684223066-81342ee5ff30', '1533174072545-7a4b6ad7a6c3', '1545128485-c400e7702796', '1574391884720-bbc3740c59d1', '1556035511-3168381ea4d4', '1505236858219-8359eb29e329', '1517457373958-b7bdd4587205', '1519214605650-76a613ee3245'],
  food: ['1504674900247-0877df9cc836', '1517248135467-4c7edcad34c4', '1414235077428-338989a2e8c0', '1559339352-11d035aa65de', '1511795409834-ef04bbd61622', '1555396273-367ea4eb4db5', '1484980972926-edee96e0960d', '1578474846511-04ba529f0b88', '1574126154517-d1e0d89ef734'],
  gig: ['1506157786151-b8491531f063', '1459749411175-04bf5292ceea', '1429962714451-bb934ecdc4ec', '1501281668745-f7f57925c3b4', '1470229722913-7c0e2dbbafd3', '1524368535928-5b5e00ddc76b', '1540575467063-178a50c2df87', '1514525253161-7a46d19cd819', '1522158637959-30385a09e0da'],
  friends: ['1529156069898-49953e39b3ac', '1528605248644-14dd04022da1', '1517457373958-b7bdd4587205', '1527529482837-4698179dc6ce', '1543269865-cbf427effbad', '1575037614876-c38a4d44f5b8', '1519671482749-fd09be7ccebf', '1541532713592-79a0317b6b77', '1528605105345-5344ea20e269', '1561489413-985b06da5bee'],
  beach: ['1507525428034-b723cf961d3e', '1519046904884-53103b34b206', '1436076863939-06870fe779c2', '1506869640319-fe1a24fd76dc', '1520209759809-a9bcb6cb3241', '1524601500432-1e1a4c71d692'],
  party: ['1530103862676-de8c9debad1d', '1492684223066-81342ee5ff30', '1505236858219-8359eb29e329', '1511795409834-ef04bbd61622'],
};
const poolFor = (cat?: string): string[] => ({ pub: P.pub, bar: P.bar, club: P.club, food: P.food, gig: P.gig, spot: P.beach } as Record<string, string[]>)[cat || ''] || P.bar;

// ---- Venues -------------------------------------------------------------
// cat: pub | bar | club | food | gig | spot
const V = (id: string, name: string, cat: VenueCategory, suburb: string, address: string, lat: number, lng: number, price: string, hours: string, blurb: string, img: string): Venue =>
  ({ id, name, cat, suburb, address, lat, lng, price, hours, blurb, img: { id: img }, claimed: false, deals: [] });

const venues: Venue[] = [
  V('clock', 'The Clock', 'pub', 'Surry Hills', '470 Crown St', -33.8856, 151.2133, '$$', 'Open till 1 AM', 'Big balcony over Crown St. Easy first stop for a crowd.', P.pub[0]),
  V('tios', "Tio's", 'bar', 'Surry Hills', '4/14 Foster St', -33.8801, 151.2100, '$', 'Open till midnight', 'Tiny tequila bar off a laneway. Tinnies, tacos, no bookings.', P.bar[5]),
  V('cliffdive', 'Cliff Dive', 'club', 'Darlinghurst', '16 Oxford Sq', -33.8789, 151.2157, '$$', 'Open till 4 AM', 'Tiki basement on Oxford Square. DJs from 10.', P.club[4]),
  V('club77', 'Club 77', 'club', 'Darlinghurst', '77 William St', -33.8749, 151.2183, '$$', 'Open till 5 AM', 'Low ceiling, loud system. House and techno till close.', P.club[0]),
  V('shady', 'Shady Pines Saloon', 'bar', 'Darlinghurst', '4/256 Crown St', -33.8798, 151.2146, '$$', 'Open till midnight', 'Peanut shells on the floor, taxidermy on the walls.', P.bar[6]),
  V('beresford', 'The Beresford', 'pub', 'Surry Hills', '354 Bourke St', -33.8823, 151.2170, '$$', 'Open till midnight', 'Huge leafy beer garden. Gets packed on Sundays.', P.pub[2]),
  V('goldenage', 'Golden Age Cinema & Bar', 'bar', 'Surry Hills', '80 Commonwealth St', -33.8810, 151.2092, '$$', 'Open till 11:30 PM', 'Old screening room in Paramount House. Drink before the film.', P.bar[1]),
  V('hollywood', 'Hollywood Hotel', 'pub', 'Surry Hills', '2 Foster St', -33.8794, 151.2093, '$', 'Open till 1 AM', 'Art deco corner pub run by the same family since the 70s.', P.pub[1]),
  V('porteno', 'Porteño', 'food', 'Surry Hills', '50 Holt St', -33.8860, 151.2072, '$$$', 'Kitchen till 10 PM', 'Argentinian wood-fire grill. Book for groups over 8.', P.food[7]),
  V('bills', 'bills Surry Hills', 'food', 'Surry Hills', '359 Crown St', -33.8837, 151.2135, '$$', 'Kitchen till 10 PM', 'Bright corner dining room. Good for a birthday dinner.', P.food[3]),
  V('strawb', 'Strawberry Hills Hotel', 'pub', 'Surry Hills', '453 Elizabeth St', -33.8886, 151.2083, '$', 'Open till midnight', 'Free jazz on Saturday arvos. Cheap jugs.', P.pub[3]),
  V('arcadia', 'Arcadia Liquors', 'bar', 'Redfern', '7 Cope St', -33.8927, 151.2046, '$', 'Open till midnight', 'Neighbourhood bar with a fire pit out the back.', P.bar[2]),
  V('oaf', 'Oxford Art Factory', 'gig', 'Darlinghurst', '38-46 Oxford St', -33.8781, 151.2134, '$$', 'Doors 8 PM', 'Two rooms of live music. Gallery bar upstairs.', P.gig[1]),
  V('stonewall', 'Stonewall Hotel', 'club', 'Darlinghurst', '175 Oxford St', -33.8804, 151.2178, '$$', 'Open till 4 AM', 'Three levels on Oxford St. Karaoke Wednesdays.', P.club[6]),
  V('tilly', 'Love, Tilly Devine', 'bar', 'Darlinghurst', '91 Crown Ln', -33.8758, 151.2150, '$$$', 'Open till midnight', 'Natural wine in a skinny laneway room.', P.bar[3]),
  V('taphouse', 'The Taphouse', 'pub', 'Darlinghurst', '122 Flinders St', -33.8838, 151.2207, '$$', 'Open till midnight', 'Sixty taps and a rooftop. Good for a large group.', P.pub[4]),
  V('kingscross', 'Kings Cross Hotel', 'pub', 'Potts Point', '244 William St', -33.8750, 151.2227, '$$', 'Open till 3 AM', 'Rooftop up top, DJs in the basement late.', P.pub[5]),
  V('msgs', "Ms.G's", 'food', 'Potts Point', '155 Victoria St', -33.8734, 151.2225, '$$', 'Kitchen till 11 PM', 'Loud pan-Asian. Banh mi sliders for the table.', P.food[0]),
  V('messina', 'Gelato Messina', 'food', 'Darlinghurst', '241 Victoria St', -33.8781, 151.2218, '$', 'Open till 11 PM', 'Late gelato on the way between bars.', P.food[6]),
  V('baxter', 'The Baxter Inn', 'bar', 'CBD', '152 Clarence St', -33.8689, 151.2047, '$$', 'Open till 1 AM', 'Basement whisky bar. Down the lane, follow the queue.', P.bar[0]),
  V('mrwong', 'Mr Wong', 'food', 'CBD', '3 Bridge Ln', -33.8638, 151.2074, '$$$', 'Kitchen till 11 PM', 'Cantonese over two floors. Big round tables.', P.food[1]),
  V('frankies', "Frankie's Pizza", 'bar', 'CBD', '50 Hunter St', -33.8655, 151.2096, '$', 'Open till 4 AM', 'Pizza, rock bar, karaoke room out the back.', P.food[8]),
  V('ivy', 'Ivy', 'club', 'CBD', '330 George St', -33.8676, 151.2077, '$$$', 'Open till 3 AM', 'Big Saturday club. Dress up, queue early.', P.club[2]),
  V('palmer', 'Palmer & Co', 'bar', 'CBD', 'Abercrombie Ln', -33.8653, 151.2085, '$$$', 'Open till 2 AM', 'Prohibition-style basement with live jazz.', P.bar[4]),
  V('kuletos', "Kuleto's", 'bar', 'Newtown', '157 King St', -33.8934, 151.1853, '$', 'Open till 2 AM', 'Two-for-one cocktail hour 6–7:30. Always loud.', P.bar[7]),
  V('bank', 'Bank Hotel', 'pub', 'Newtown', '324 King St', -33.8967, 151.1798, '$$', 'Open till 4 AM', 'Thai in the beer garden, rooftop bar upstairs.', P.pub[6]),
  V('marly', 'Marly Bar', 'pub', 'Newtown', '329 King St', -33.8961, 151.1810, '$$', 'Open till 2 AM', 'Neon signs and pool tables opposite the station.', P.pub[7]),
  V('nsc', 'Newtown Social Club', 'gig', 'Newtown', '387 King St', -33.8976, 151.1789, '$$', 'Doors 7 PM', 'Small live room, good sound, local acts most nights.', P.gig[6]),
  V('earls', "Earl's Juke Joint", 'bar', 'Newtown', '407 King St', -33.8983, 151.1781, '$$', 'Open till midnight', 'Old butcher shop, now a New Orleans dive.', P.bar[8]),
  V('duke', 'Duke of Enmore', 'pub', 'Enmore', '74 Enmore Rd', -33.8986, 151.1760, '$$', 'Open till midnight', 'Warm corner pub on the Enmore strip.', P.pub[0]),
  V('enmore', 'Enmore Theatre', 'gig', 'Enmore', '118 Enmore Rd', -33.8995, 151.1741, '$$$', 'Doors 7 PM', 'Old 2,000-cap theatre. Big touring acts.', P.gig[4]),
  V('fredas', "Freda's", 'bar', 'Chippendale', '109 Regent St', -33.8891, 151.2011, '$$', 'Open till midnight', 'Warehouse bar with DJs and a dance floor out back.', P.bar[2]),
  V('lansdowne', 'Lansdowne Hotel', 'pub', 'Chippendale', '2-6 City Rd', -33.8847, 151.1957, '$', 'Open till 2 AM', 'Uni crowd pub with a band room upstairs.', P.pub[3]),
  V('hordern', 'Hordern Pavilion', 'gig', 'Moore Park', '1 Driver Ave', -33.8935, 151.2246, '$$$', 'Doors 7 PM', '5,500-cap pavilion in Moore Park.', P.gig[2]),
  V('bondi', 'Bondi Beach', 'spot', 'Bondi', 'Queen Elizabeth Dr', -33.8908, 151.2743, '', 'Flags 9 AM – 5 PM', 'North end is calmer. South end for the pool.', P.beach[0]),
  V('icebergs', 'Icebergs Dining Room & Bar', 'food', 'Bondi', '1 Notts Ave', -33.8946, 151.2741, '$$$', 'Bar till midnight', 'Over the ocean pool. Sunset drinks on the deck.', P.beach[4]),
  V('bucketlist', 'The Bucket List', 'bar', 'Bondi', 'Bondi Pavilion', -33.8913, 151.2767, '$$', 'Open till 10 PM', 'Beachfront bar in the Pavilion. Jugs at golden hour.', P.beach[2]),
  V('mrsmacs', "Mrs Macquarie's Chair", 'spot', 'The Domain', 'Mrs Macquaries Rd', -33.8597, 151.2223, '', 'Open 24 hours', 'Best spot for the bridge and the Opera House.', P.party[1]),
  V('vanguard', 'The Vanguard', 'gig', 'Newtown', '42 King St', -33.8909, 151.1880, '$$', 'Doors 6:30 PM', 'Dinner-and-a-show room. Jazz, blues, burlesque.', P.gig[7]),
  V('comedystore', 'The Comedy Store', 'gig', 'Moore Park', 'Entertainment Quarter', -33.8916, 151.2268, '$$', 'Doors 7 PM', 'Stand-up five nights a week. Arrive early for good seats.', P.gig[6]),
  V('dolphin', 'The Dolphin Hotel', 'pub', 'Surry Hills', '412 Crown St', -33.8840, 151.2131, '$$', 'Open till midnight', 'Three rooms: wine bar, dining room, public bar.', P.pub[4]),
  V('forresters', 'The Forresters', 'pub', 'Surry Hills', '336 Riley St', -33.8835, 151.2106, '$', 'Open till 1 AM', 'Upstairs pool tables, $15 steaks on Mondays.', P.pub[7]),
  V('royalalbert', 'Royal Albert Hotel', 'pub', 'Surry Hills', '140 Commonwealth St', -33.8823, 151.2096, '$', 'Open till midnight', 'Craft taps and a quiz on Tuesdays.', P.pub[2]),
  V('wildrover', 'The Wild Rover', 'bar', 'Surry Hills', '75 Campbell St', -33.8812, 151.2082, '$$', 'Open till midnight', 'Old shirt factory, big Irish bar, walk-ins only.', P.bar[6]),
  V('bigpoppas', 'Big Poppa’s', 'bar', 'Darlinghurst', '96 Oxford St', -33.8786, 151.2168, '$$', 'Open till 3 AM', 'Hip-hop basement, cheese and natural wine. Late kitchen.', P.bar[1]),
  V('ramblin', 'Ramblin’ Rascal Tavern', 'bar', 'CBD', '199 Elizabeth St', -33.8731, 151.2101, '$$', 'Open till midnight', 'Basement tavern opposite Hyde Park. Good for six or more.', P.bar[0]),
  V('norfolk', 'The Norfolk', 'pub', 'Redfern', '305 Cleveland St', -33.8892, 151.2078, '$$', 'Open till midnight', 'Tacos in the beer garden, DJs on Saturdays.', P.pub[0]),
  V('arthur', 'Arthur', 'food', 'Surry Hills', '544 Bourke St', -33.8889, 151.2149, '$$$', 'Kitchen till 10 PM', 'One set menu, nine courses, tiny room.', P.food[2]),
  V('nomad', 'Nomad', 'food', 'Surry Hills', '16 Foster St', -33.8813, 151.2106, '$$$', 'Kitchen till 10:30 PM', 'Wood-fired share plates in a warehouse.', P.food[4]),
  V('bloodwood', 'Bloodwood', 'food', 'Newtown', '416 King St', -33.8991, 151.1773, '$$', 'Kitchen till 11 PM', 'Share plates and a long bar. Walk-ins at the bar.', P.food[5]),
];
// How busy each place gets and when (peak hour, 24+ = after midnight). Drives "popular tonight".
const POP: Record<string, [number, number]> = {
  frankies: [0.92, 21], kuletos: [0.86, 19], shady: [0.8, 21], bank: [0.82, 21], club77: [0.78, 25], cliffdive: [0.72, 23],
  beresford: [0.74, 17], taphouse: [0.66, 20], clock: [0.72, 20], baxter: [0.72, 20], ivy: [0.6, 23], stonewall: [0.66, 23],
  tios: [0.66, 21], strawb: [0.46, 18], msgs: [0.6, 20], messina: [0.55, 21], mrwong: [0.62, 20], oaf: [0.6, 22], nsc: [0.62, 22],
  earls: [0.56, 21], marly: [0.62, 21], hollywood: [0.5, 20], fredas: [0.58, 21], lansdowne: [0.5, 21], porteno: [0.62, 20],
  bills: [0.5, 19], tilly: [0.5, 20], goldenage: [0.56, 20], icebergs: [0.62, 18], bucketlist: [0.52, 17], kingscross: [0.6, 23],
  dolphin: [0.6, 20], forresters: [0.5, 20], royalalbert: [0.48, 20], wildrover: [0.66, 21], bigpoppas: [0.7, 24], ramblin: [0.58, 20],
  norfolk: [0.55, 20], arthur: [0.45, 20], nomad: [0.6, 20],
  duke: [0.46, 20], arcadia: [0.46, 20], palmer: [0.58, 22], vanguard: [0.55, 21], comedystore: [0.5, 21], bloodwood: [0.62, 20],
};
const PLACES: Record<string, Place> = {
  quay: { name: 'Circular Quay', suburb: 'Sydney', lat: -33.8611, lng: 151.2111 },
  hydepark: { name: 'Hyde Park North', suburb: 'Sydney', lat: -33.8712, lng: 151.2117 },
  carriageworks: { name: 'Carriageworks', suburb: 'Eveleigh', lat: -33.8933, lng: 151.1927 },
  glebe: { name: 'Glebe Public School', suburb: 'Glebe', lat: -33.8797, lng: 151.1856 },
  pavilion: { name: 'Bondi Pavilion', suburb: 'Bondi', lat: -33.8918, lng: 151.2752 },
  mca: { name: 'Museum of Contemporary Art', suburb: 'The Rocks', lat: -33.8597, lng: 151.2089 },
  shannon: { name: 'Crown St, Shannon Reserve', suburb: 'Surry Hills', lat: -33.8878, lng: 151.2125 },
};

// ---- People -------------------------------------------------------------
const U = (id: string, name: string, g: string, n: number, suburb: string): User => ({ id, name, first: name.split(' ')[0], avatar: `https://randomuser.me/api/portraits/${g}/${n}.jpg`, handle: name.split(' ')[0].toLowerCase() + name.split(' ')[1][0].toLowerCase(), suburb });
const users: User[] = [
  U('u_ollie', 'Ollie Charlton', 'men', 32, 'Surry Hills'),
  U('u_jack', 'Jack Reid', 'men', 45, 'Redfern'),
  U('u_sarah', 'Sarah Nguyen', 'women', 44, 'Newtown'),
  U('u_tom', 'Tom Hadley', 'men', 22, 'Newtown'),
  U('u_mia', 'Mia Costa', 'women', 68, 'Bondi'),
  U('u_liam', "Liam O'Brien", 'men', 11, 'Glebe'),
  U('u_chloe', 'Chloe Park', 'women', 26, 'Darlinghurst'),
  U('u_josh', 'Josh Tan', 'men', 75, 'Chippendale'),
  U('u_grace', 'Grace Whitfield', 'women', 17, 'Paddington'),
  U('u_sam', 'Sam Patel', 'men', 36, 'Erskineville'),
  U('u_emily', 'Emily Rossi', 'women', 65, 'Surry Hills'),
  U('u_ben', 'Ben Carter', 'men', 52, 'Marrickville'),
  U('u_zoe', 'Zoe Lambert', 'women', 79, 'Potts Point'),
  U('u_matt', 'Matt Kowalski', 'men', 61, 'Alexandria'),
  U('u_hannah', 'Hannah Lee', 'women', 50, 'Redfern'),
  U('u_nick', 'Nick Gallo', 'men', 8, 'Leichhardt'),
  U('u_jess', 'Jess Morgan', 'women', 33, 'Bondi'),
  U('u_dan', 'Dan Fraser', 'men', 85, 'Newtown'),
  U('u_priya', 'Priya Shah', 'women', 90, 'Ultimo'),
  U('u_will', 'Will Hughes', 'men', 14, 'Coogee'),
  U('u_ella', 'Ella Brooks', 'women', 12, 'Enmore'),
  U('u_harry', 'Harry Dunn', 'men', 29, 'Zetland'),
  U('u_lucy', 'Lucy Tran', 'women', 57, 'Waterloo'),
  U('u_kate', 'Kate Murphy', 'women', 21, 'Camperdown'),
  U('u_ava', 'Ava Mitchell', 'women', 2, 'Glebe'), U('u_noah', 'Noah Kim', 'men', 3, 'Ultimo'), U('u_ruby', 'Ruby Walsh', 'women', 5, 'Darlinghurst'),
  U('u_jake', 'Jake Thompson', 'men', 6, 'Surry Hills'), U('u_olivia', 'Olivia Chen', 'women', 9, 'Chippendale'), U('u_lachlan', 'Lachlan Ross', 'men', 18, 'Newtown'),
  U('u_sophie', 'Sophie Bennett', 'women', 24, 'Stanmore'), U('u_ethan', 'Ethan Wright', 'men', 24, 'Petersham'), U('u_georgia', 'Georgia Hall', 'women', 29, 'Paddington'),
  U('u_callum', 'Callum Young', 'men', 40, 'Redfern'), U('u_maddie', 'Maddie King', 'women', 37, 'Surry Hills'), U('u_tyler', 'Tyler Scott', 'men', 47, 'Waterloo'),
  U('u_amelia', 'Amelia Green', 'women', 41, 'Elizabeth Bay'), U('u_riley', 'Riley Adams', 'men', 55, 'Chippendale'), U('u_charlotte', 'Charlotte Baker', 'women', 47, 'Annandale'),
  U('u_hamish', 'Hamish Nelson', 'men', 63, 'Rozelle'), U('u_freya', 'Freya Hill', 'women', 53, 'Enmore'), U('u_oscar', 'Oscar Campbell', 'men', 70, 'Pyrmont'),
  U('u_zara', 'Zara Ahmed', 'women', 60, 'Ultimo'), U('u_leo', 'Leo Martin', 'men', 77, 'Newtown'), U('u_imogen', 'Imogen Clarke', 'women', 72, 'Potts Point'),
  U('u_finn', 'Finn Murray', 'men', 81, 'Bondi'), U('u_tahlia', 'Tahlia Evans', 'women', 83, 'Rosebery'), U('u_jordan', 'Jordan Lee', 'men', 91, 'Zetland'),
  U('u_bella', 'Bella Rodriguez', 'women', 88, 'Surry Hills'), U('u_marcus', 'Marcus Wong', 'men', 94, 'Haymarket'),
];

// ---- Outings ------------------------------------------------------------
const D = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const HOUR = 36e5, MIN = 6e4;

function build(now: number) {
  const outings: Outing[] = [], attendees: OutingMember[] = [], stops: OutingStop[] = [], photos: Photo[] = [];

  function outing(o: any, stopList: [string, number][], people: [string, string][], photoCount = 0) {
    const id = o.id;
    outings.push({
      kind: 'night', // future: holiday | festival | run | daytrip
      visibility: 'private',
      cover: null,
      live: null,
      endedAt: null,
      createdAt: o.startsAt - 6 * 24 * HOUR,
      inviteCode: id.replace('o_', '') + '-' + Math.random().toString(36).slice(2, 6),
      activity: [],
      ...o,
    });
    stopList.forEach(([venueId, at], i) => stops.push(venueId.startsWith('ev:')
      ? { id: `${id}_s${i}`, outingId: id, venueId: null, eventId: venueId.slice(3), order: i, at }
      : { id: `${id}_s${i}`, outingId: id, venueId, order: i, at }));
    people.forEach(([userId, rsvp], i) => attendees.push({ id: `${id}_a${i}`, outingId: id, userId, rsvp: rsvp as any, role: userId === o.organiserId ? 'organiser' : 'guest', invitedBy: o.organiserId, respondedAt: o.createdAt + i * 37 * MIN, shareLocation: false }));

    if (photoCount) {
      const r = rng(id);
      const goers = people.filter((p) => p[1] === 'going').map((p) => p[0]);
      const os = stops.filter((s) => s.outingId === id);
      // more photos later in the night, a few people shoot most of them
      const weights = os.map((_, i) => 1 + i * 0.35);
      const wsum = weights.reduce((a, b) => a + b, 0);
      const shooters = goers.slice().sort(() => r() - 0.5);
      for (let n = 0; n < photoCount; n++) {
        let x = r() * wsum, si = 0;
        while (x > weights[si] && si < os.length - 1) { x -= weights[si]; si++; }
        if (o.live) si = Math.min(si, o.live.current);
        const s = os[si];
        const v = venues.find((vv) => vv.id === s.venueId) || { cat: 'food' };
        let next = os[si + 1] ? os[si + 1].at : s.at + 2 * HOUR;
        if (o.live) next = Math.min(next, now - 2 * MIN);
        const pool = r() < 0.38 ? P.friends : r() < 0.15 && o.icon === 'cake' ? P.party : poolFor(v.cat);
        const who = r() < 0.55 ? shooters[Math.floor(r() * Math.min(3, shooters.length))] : pick(r, goers);
        photos.push({
          id: `${id}_p${n}`, outingId: id, stopId: s.id, userId: who,
          takenAt: s.at + r() * (next - s.at),
          visibility: 'outing', // future: 'venue' (Public @ Venue)
          source: r() < 0.7 ? 'camera' : 'upload',
          u: { id: pick(r, pool), fx: (0.25 + r() * 0.5).toFixed(2), fy: (0.3 + r() * 0.4).toFixed(2), fz: (1 + r() * 0.8).toFixed(2) },
        });
      }
    }
    return id;
  }

  // Upcoming: Ollie's Birthday — Saturday 7:30 PM (the next Saturday from "now")
  const sat = new Date(now); sat.setHours(19, 30, 0, 0);
  while (sat.getDay() !== 6 || sat.getTime() < now) sat.setDate(sat.getDate() + 1);
  const b = sat.getTime();
  const bdayPeople: [string, string][] = [
    ['u_ollie', 'going'], ['u_jack', 'going'], ['u_sarah', 'going'], ['u_tom', 'going'], ['u_mia', 'going'], ['u_liam', 'going'],
    ['u_chloe', 'going'], ['u_josh', 'going'], ['u_grace', 'going'], ['u_sam', 'going'], ['u_emily', 'going'], ['u_ben', 'going'],
    ['u_zoe', 'going'], ['u_matt', 'going'], ['u_hannah', 'going'], ['u_nick', 'going'], ['u_jess', 'going'],
    ['u_dan', 'maybe'], ['u_priya', 'maybe'], ['u_ella', 'maybe'], ['u_will', 'declined'], ['u_harry', 'invited'], ['u_lucy', 'invited'],
  ];
  outing({ id: 'o_bday', title: "Ollie's Birthday", icon: 'cake', organiserId: 'u_ollie', status: 'planning', startsAt: b, createdAt: now - 9 * 24 * HOUR },
    [['clock', b], ['tios', b + 2 * HOUR], ['cliffdive', b + 3.5 * HOUR], ['club77', b + 5.5 * HOUR]], bdayPeople);
  const ob = outings.find((o) => o.id === 'o_bday')!;
  ob.activity = [
    { id: 'ac1', type: 'joined', userId: 'u_sarah', at: now - 14 * MIN },
    { id: 'ac2', type: 'maybe', userId: 'u_ella', at: now - 52 * MIN },
    { id: 'ac3', type: 'declined', userId: 'u_will', at: now - 3 * HOUR },
    { id: 'ac4', type: 'stop', userId: 'u_ollie', venueId: 'club77', at: now - 5 * HOUR },
    { id: 'ac5', type: 'joined', userId: 'u_jack', at: now - 26 * HOUR },
  ];

  // ---- Tonight (Friday) --------------------------------------------------
  const day = (k: number, h: number, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + k); d.setHours(h, m, 0, 0); return d.getTime(); };
  const F = (h: number, m: number) => day(0, h, m);

  // Jack's knock-offs: live, you're invited
  outing({ id: 'o_knockoffs', title: 'Friday knock-offs', icon: 'beer', organiserId: 'u_jack', status: 'live', startsAt: F(17, 30), createdAt: now - 2 * 24 * HOUR,
    live: { current: 1, startedAt: F(17, 30), arrivedAt: F(18, 48) } },
    [['baxter', F(17, 30)], ['frankies', F(18, 45)], ['palmer', F(21, 30)]],
    [['u_jack', 'going'], ['u_matt', 'going'], ['u_hannah', 'going'], ['u_nick', 'going'], ['u_priya', 'going'], ['u_harry', 'going'], ['u_kate', 'going'], ['u_marcus', 'going'], ['u_olivia', 'maybe'], ['u_ben', 'maybe'], ['u_ollie', 'invited']], 23);
  outings.find((o) => o.id === 'o_knockoffs')!.activity = [
    { id: 'k1', type: 'photos', userId: 'u_hannah', count: 4, at: now - 6 * MIN },
    { id: 'k2', type: 'moved', userId: 'u_jack', venueId: 'frankies', at: F(18, 48) },
    { id: 'k3', type: 'photos', userId: 'u_priya', count: 3, at: F(18, 20) },
    { id: 'k4', type: 'started', userId: 'u_jack', at: F(17, 30) },
  ];

  // Sarah's Newtown night: dinner, then a gig. You said maybe.
  outing({ id: 'o_newtown', title: 'Dinner + Harbour Static', icon: 'guitar', organiserId: 'u_sarah', status: 'planning', startsAt: F(19, 30), createdAt: now - 3 * 24 * HOUR },
    [['bloodwood', F(19, 30)], ['ev:ev_nsc', F(21, 0)], ['earls', F(23, 0)]],
    [['u_sarah', 'going'], ['u_dan', 'going'], ['u_tom', 'going'], ['u_ella', 'going'], ['u_leo', 'going'], ['u_freya', 'going'], ['u_lachlan', 'maybe'], ['u_ollie', 'maybe']]);
  outings.find((o) => o.id === 'o_newtown')!.activity = [
    { id: 'n1', type: 'joined', userId: 'u_freya', at: now - 22 * MIN },
    { id: 'n2', type: 'maybe', userId: 'u_ollie', at: now - 5 * HOUR },
  ];

  // Noah's public night, live at the Noodle Markets
  outing({ id: 'o_noodles', title: 'Noodle Markets then Darlo', icon: 'bowl', organiserId: 'u_noah', status: 'live', visibility: 'public', startsAt: F(18, 30), createdAt: now - 4 * 24 * HOUR,
    live: { current: 0, startedAt: F(18, 30), arrivedAt: F(18, 34) } },
    [['ev:ev_noodle', F(18, 30)], ['tilly', F(21, 0)], ['cliffdive', F(22, 30)]],
    [['u_noah', 'going'], ['u_olivia', 'going'], ['u_bella', 'going'], ['u_oscar', 'going'], ['u_zara', 'going']], 9);

  // Public outing nearby (shows the public/private model on the map)
  const sun = new Date(day(2, 14));
  outing({ id: 'o_beres', title: 'Sunday session at the Bero', icon: 'sun', organiserId: 'u_emily', status: 'planning', visibility: 'public', startsAt: sun.getTime() },
    [['beresford', sun.getTime()]], [['u_emily', 'going'], ['u_grace', 'going'], ['u_zoe', 'going'], ['u_sam', 'maybe']]);

  // Memories ---------------------------------------------------------------
  const t1 = D(2026, 9, 19, 15, 0);
  outing({ id: 'o_tomcrawl', title: "Tom's Pub Crawl", icon: 'beer', organiserId: 'u_tom', status: 'ended', startsAt: t1, endedAt: t1 + 9 * HOUR },
    [['kuletos', t1], ['bank', t1 + 1.5 * HOUR], ['marly', t1 + 3 * HOUR], ['nsc', t1 + 4.5 * HOUR], ['earls', t1 + 6.5 * HOUR]],
    [['u_tom', 'going'], ['u_ollie', 'going'], ['u_sarah', 'going'], ['u_jack', 'going'], ['u_dan', 'going'], ['u_ella', 'going'], ['u_sam', 'going'], ['u_ben', 'going'], ['u_kate', 'going'], ['u_liam', 'going'], ['u_josh', 'going'], ['u_will', 'declined']], 87);

  const t2 = D(2026, 9, 13, 11, 0);
  outing({ id: 'o_bondi', title: 'Bondi Sunday', icon: 'beach', organiserId: 'u_mia', status: 'ended', startsAt: t2, endedAt: t2 + 8 * HOUR },
    [['bondi', t2], ['icebergs', t2 + 2.5 * HOUR], ['bucketlist', t2 + 5 * HOUR]],
    [['u_mia', 'going'], ['u_ollie', 'going'], ['u_jess', 'going'], ['u_grace', 'going'], ['u_will', 'going'], ['u_chloe', 'going']], 31);

  const t3 = D(2026, 8, 28, 18, 30);
  outing({ id: 'o_fred', title: 'Fred again..', icon: 'music', organiserId: 'u_josh', status: 'ended', startsAt: t3, endedAt: t3 + 6 * HOUR },
    [['fredas', t3], ['hordern', t3 + 2 * HOUR]],
    [['u_josh', 'going'], ['u_ollie', 'going'], ['u_priya', 'going'], ['u_liam', 'going'], ['u_zoe', 'going'], ['u_harry', 'going'], ['u_sarah', 'going'], ['u_lucy', 'going']], 64);

  const t4 = D(2026, 7, 18, 19, 0);
  outing({ id: 'o_chloe', title: "Chloe's 25th", icon: 'glass', organiserId: 'u_chloe', status: 'ended', startsAt: t4, endedAt: t4 + 7 * HOUR },
    [['porteno', t4], ['shady', t4 + 2.5 * HOUR], ['tilly', t4 + 4 * HOUR], ['stonewall', t4 + 5.5 * HOUR]],
    [['u_chloe', 'going'], ['u_ollie', 'going'], ['u_grace', 'going'], ['u_emily', 'going'], ['u_zoe', 'going'], ['u_mia', 'going'], ['u_jess', 'going'], ['u_hannah', 'going'], ['u_sam', 'going'], ['u_jack', 'going'], ['u_nick', 'going'], ['u_kate', 'going'], ['u_lucy', 'going'], ['u_matt', 'going']], 52);

  const t5 = D(2025, 12, 31, 20, 0);
  outing({ id: 'o_nye', title: 'NYE on the harbour', icon: 'fireworks', organiserId: 'u_ollie', status: 'ended', startsAt: t5, endedAt: t5 + 6 * HOUR },
    [['mrsmacs', t5], ['kingscross', t5 + 4.5 * HOUR]],
    [['u_ollie', 'going'], ['u_jack', 'going'], ['u_sarah', 'going'], ['u_tom', 'going'], ['u_mia', 'going'], ['u_liam', 'going'], ['u_grace', 'going'], ['u_josh', 'going'], ['u_dan', 'going']], 48);

  // the photos of NYE lean on party pool
  photos.filter((p) => p.outingId === 'o_nye').forEach((p, i) => { if (i % 2 === 0) (p.u as any).id = P.party[i % P.party.length]; });

  // Friends sharing where they are (people out without a HOP outing)
  const here = (userId: string, venueId: string | null, h: number, m: number, eventId?: string): { userId: string; venueId: string | null; eventId: string | null; since: number } => ({ userId, venueId: venueId || null, eventId: eventId || null, since: F(h, m) });
  const presence = [
    here('u_chloe', 'shady', 18, 40), here('u_zoe', 'shady', 18, 40), here('u_grace', 'shady', 18, 52),
    here('u_sam', 'strawb', 18, 15), here('u_ben', 'strawb', 18, 15),
    here('u_will', null, 18, 0, 'ev_runclub'), here('u_amelia', null, 18, 0, 'ev_runclub'),
    here('u_emily', 'clock', 18, 55), here('u_bella', null, 0, 0),
    here('u_mia', 'icebergs', 17, 30),
    here('u_liam', 'goldenage', 18, 45), here('u_ruby', 'taphouse', 18, 20), here('u_jake', 'taphouse', 18, 20),
    here('u_lachlan', 'kuletos', 18, 35),
    here('u_maddie', 'beresford', 17, 0),
    here('u_riley', 'fredas', 18, 30),
    here('u_georgia', 'vanguard', 18, 58), here('u_imogen', 'msgs', 18, 30),
  ].filter((p) => p.venueId || p.eventId);

  // ---- Outing chats: before (planning), during (coordinating), after (a short tail, then closed)
  const messages: Message[] = [];
  let mi = 0;
  const M = (outingId: string, userId: string, at: number, text: string, extra: any = {}) => messages.push({ id: `m${mi++}`, outingId, userId, kind: 'text', text, at, reactions: {}, ...extra });
  const SYS = (outingId: string, at: number, sys: any) => messages.push({ id: `m${mi++}`, outingId, userId: null, kind: 'system', at, reactions: {}, sys });
  const ago = (m: number) => now - m * MIN;
  const photosBy = (oid: string, uid: string, n: number) => photos.filter((p) => p.outingId === oid && p.userId === uid).slice(0, n).map((p) => p.id);

  // Ollie's Birthday — tomorrow. Planning chat.
  M('o_bday', 'u_ollie', ago(6 * 24 * 60), 'Birthday drinks Saturday! Starting at The Clock 7:30, upstairs balcony');
  M('o_bday', 'u_jack', ago(6 * 24 * 60 - 3), 'Ledge. Is anyone booking food first?', { reactions: { up: ['u_mia'] } });
  M('o_bday', 'u_ollie', ago(6 * 24 * 60 - 9), 'Nah just snacks at The Clock. Balcony fits heaps of us', { replyTo: 'm1' });
  M('o_bday', 'u_sarah', ago(5 * 24 * 60), 'Can I bring Freya?');
  M('o_bday', 'u_ollie', ago(5 * 24 * 60 - 20), 'Course', { replyTo: 'm3', reactions: { heart: ['u_sarah'] } });
  messages.push({ id: `m${mi++}`, outingId: 'o_bday', userId: 'u_ollie', kind: 'poll', at: ago(4 * 24 * 60), reactions: {},
    poll: { q: 'Where after Cliff Dive?', closed: true, options: [
      { venueId: 'club77', votes: ['u_jack', 'u_hannah', 'u_mia', 'u_liam', 'u_zoe', 'u_matt', 'u_nick', 'u_jess'] },
      { venueId: 'ivy', votes: ['u_chloe', 'u_grace', 'u_emily'] },
      { venueId: 'bigpoppas', votes: ['u_josh', 'u_ben'] }] } });
  SYS('o_bday', ago(3 * 24 * 60), { type: 'poll', count: 8, venueId: 'club77' });
  SYS('o_bday', ago(3 * 24 * 60 - 1), { type: 'stop', userId: 'u_ollie', venueId: 'club77' });
  M('o_bday', 'u_mia', ago(2 * 24 * 60), 'Pre-pre drinks here?', { kind: 'place', place: { venueId: 'shady' }, keen: ['u_mia', 'u_grace', 'u_chloe'] });
  M('o_bday', 'u_grace', ago(26 * 60), 'What time are we actually meeting?');
  M('o_bday', 'u_ollie', ago(25 * 60), '7:30 at The Clock. Upstairs balcony, I’ll grab the corner', { replyTo: `m${mi - 1}` });
  SYS('o_bday', ago(14), { type: 'joined', userId: 'u_sarah' });
  M('o_bday', 'u_will', ago(3 * 60), 'Gutted, can’t make it. Have one for me', { reactions: { heart: ['u_ollie', 'u_jack'] } });
  M('o_bday', 'u_hannah', ago(12), '@Ollie is there a dress code for Club 77?');
  M('o_bday', 'u_jack', ago(6), 'Running 10 late tomorrow probably');
  M('o_bday', 'u_jack', ago(2), 'Are we doing anything after 77 or is that it');

  // Jack's knock-offs — live right now. Coordination.
  M('o_knockoffs', 'u_jack', F(16, 50), 'Baxter from 5:30. First round’s on Matt apparently');
  M('o_knockoffs', 'u_matt', F(16, 52), 'Absolutely not', { reactions: { haha: ['u_jack', 'u_kate', 'u_priya'] } });
  SYS('o_knockoffs', F(17, 30), { type: 'started', userId: 'u_jack' });
  M('o_knockoffs', 'u_priya', F(17, 48), 'Queue’s short, come now');
  SYS('o_knockoffs', F(18, 20), { type: 'photos', userId: 'u_priya', count: 3, photoIds: photosBy('o_knockoffs', 'u_priya', 3) });
  M('o_knockoffs', 'u_hannah', F(18, 40), 'Heading to Frankie’s now');
  SYS('o_knockoffs', F(18, 48), { type: 'moved', userId: 'u_jack', venueId: 'frankies' });
  M('o_knockoffs', 'u_kate', F(18, 52), 'We’re out the back near the karaoke room');
  messages.push({ id: `m${mi++}`, outingId: 'o_knockoffs', userId: 'u_jack', kind: 'location', at: F(18, 55), reactions: {},
    loc: { lat: -33.8657, lng: 151.2093, label: 'Hunter St', until: F(19, 25) } });
  SYS('o_knockoffs', F(18, 58), { type: 'photos', userId: 'u_hannah', count: 4, photoIds: photosBy('o_knockoffs', 'u_hannah', 4) });
  M('o_knockoffs', 'u_jack', ago(3), '@Ollie you coming or what');

  // Sarah's Newtown night — tonight, still planning
  M('o_newtown', 'u_sarah', ago(2 * 24 * 60), 'Booked Bloodwood 7:30 for 8. Gig’s at 9 next door-ish');
  M('o_newtown', 'u_dan', ago(2 * 24 * 60 - 30), 'Harbour Static are $22 on the door, don’t pre-buy', { kind: 'place', place: { eventId: 'ev_nsc' } });
  M('o_newtown', 'u_sarah', ago(5 * 60), '@Ollie you in? There’s room at the table');
  M('o_newtown', 'u_leo', ago(20), 'Running a bit late, start without me');
  M('o_newtown', 'u_sarah', ago(4), 'We’re here early, grabbed the long table at the back');

  // Tom's Pub Crawl — the night, then the morning after, then closed
  const tc = outings.find((o) => o.id === 'o_tomcrawl')!.startsAt;
  const T = (h: number) => tc + h * 36e5;
  M('o_tomcrawl', 'u_tom', T(-2), 'Kuleto’s at 3. Two-for-ones till 4:30, don’t be late');
  M('o_tomcrawl', 'u_sarah', T(1.2), 'Where are you guys?');
  M('o_tomcrawl', 'u_dan', T(1.25), 'Upstairs, left of the bar', { replyTo: `m${mi - 1}` });
  SYS('o_tomcrawl', T(1.5), { type: 'moved', userId: 'u_tom', venueId: 'bank' });
  SYS('o_tomcrawl', T(4.5), { type: 'moved', userId: 'u_tom', venueId: 'nsc' });
  M('o_tomcrawl', 'u_ella', T(7.1), 'Heading to Earl’s now, meet us there');
  M('o_tomcrawl', 'u_tom', T(19), 'Last night was cooked', { reactions: { haha: ['u_ollie', 'u_jack', 'u_dan', 'u_sam'] } });
  M('o_tomcrawl', 'u_sarah', T(19.5), 'Who has the photo from Kuleto’s with the sombrero');
  M('o_tomcrawl', 'u_dan', T(19.6), 'This one?', { kind: 'photo', photoIds: photos.filter((p) => p.outingId === 'o_tomcrawl' && p.stopId === 'o_tomcrawl_s0').slice(2, 3).map((p) => p.id), replyTo: `m${mi - 1}` });
  M('o_tomcrawl', 'u_ella', T(19.8), 'Framing it');

  M('o_bondi', 'u_mia', outings.find((o) => o.id === 'o_bondi')!.startsAt + 6 * 36e5, 'Icebergs at sunset was unreal');

  // what I've already read
  const reads = { u_ollie: { o_bday: ago(20), o_knockoffs: F(18, 45), o_newtown: ago(6 * 60), o_tomcrawl: T(30), o_bondi: now } };

  return { outings, attendees, stops, photos, presence, messages, reads };
}

// ---- Public events (demo source) -----------------------------------------
function events(now: number): any[] {
  const day = (k: number, h: number, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + k); d.setHours(h, m, 0, 0); return d.getTime(); };
  const venue = (name: string, verified = true) => ({ type: 'venue', name, verified });
  const feed = { type: 'feed', name: 'What’s On Sydney', verified: false };
  const E = (id: string, title: string, cat: string, where: string, start: number, end: number, price: number, genre: string, interested: number, friendIds: string[], extra: any = {}) => ({
    id, title, cat, ...(PLACES[where] ? { place: PLACES[where] } : { venueId: where }), startsAt: start, endsAt: end, price, genre, interested, friendIds, ...extra,
  });
  return [
    // Tonight
    E('ev_housefri', 'House Fridays', 'club', 'cliffdive', day(0, 20), day(1, 3), 20, 'House / Dance', 126, ['u_chloe', 'u_zoe', 'u_priya', 'u_ruby', 'u_jake'], { img: P.club[4], publisher: venue('Cliff Dive'), recurs: 'weekly', blurb: 'Resident DJs in the tiki basement from 8. Free entry before 9 with a drink.' }),
    E('ev_jazz', 'Late Jazz: Nadia Oyelaran Quartet', 'live', 'vanguard', day(0, 19, 30), day(0, 22, 30), 25, 'Jazz', 58, ['u_georgia'], { img: P.gig[7], publisher: venue('The Vanguard'), blurb: 'Two sets. Dinner seating from 6:30, standing room at the bar.' }),
    E('ev_runclub', 'Friday Run Club', 'run', 'quay', day(0, 18), day(0, 19, 15), 0, 'Run club · 5 km', 212, ['u_will', 'u_amelia', 'u_ella'], { img: P.friends[6], publisher: { type: 'community', name: 'Harbour Runners', verified: false }, recurs: 'weekly', blurb: 'Meet under the Customs House clock. Loop past the Opera House and Botanic Garden. All paces, drinks after.' }),
    E('ev_trivia', 'Trivia Night', 'trivia', 'clock', day(0, 19), day(0, 21, 30), 0, 'Pub trivia', 44, ['u_emily', 'u_lucy'], { img: P.pub[6], publisher: venue('The Clock'), recurs: 'weekly', blurb: 'Teams of up to six. $100 bar tab for the winners.' }),
    E('ev_kuletos', 'Two-for-one cocktail hour', 'happyhour', 'kuletos', day(0, 18), day(0, 19, 30), 0, 'Cocktails', 77, ['u_lachlan', 'u_sophie'], { img: P.bar[3], publisher: venue('Kuleto’s'), deal: '2-for-1 cocktails till 7:30', recurs: 'weekly' }),
    E('ev_comedy', 'Friday Night Comedy', 'comedy', 'comedystore', day(0, 20), day(0, 22), 35, 'Stand-up', 89, ['u_josh', 'u_kate'], { img: P.gig[6], publisher: feed, blurb: 'Five comics, one headliner. Drinks at the bar before doors.' }),
    E('ev_noodle', 'Night Noodle Markets', 'festival', 'hydepark', day(0, 17), day(0, 22), 0, 'Hawker stalls · bars', 1400, ['u_noah', 'u_olivia', 'u_bella', 'u_oscar', 'u_zara', 'u_marcus'], { img: P.food[0], publisher: feed, blurb: 'Forty stalls under the fig trees. Free entry, pay per dish. Gets busy after 7.' }),
    E('ev_nsc', 'Harbour Static + Pale Rooms', 'live', 'nsc', day(0, 21), day(0, 23, 30), 22, 'Indie / Rock', 64, ['u_sarah', 'u_dan', 'u_tom', 'u_ella', 'u_leo', 'u_freya'], { img: P.gig[0], publisher: venue('Newtown Social Club'), blurb: 'Album launch. Pale Rooms on at 9:30, Harbour Static at 10:30.' }),
    E('ev_club77', 'Late: Techno All Night', 'dj', 'club77', day(0, 23), day(1, 5), 25, 'Techno', 97, ['u_harry'], { img: P.club[0], publisher: venue('Club 77') }),
    E('ev_oaf', 'Indie Club Night', 'club', 'oaf', day(0, 22), day(1, 3), 15, 'Indie / Alt', 83, [], { img: P.gig[5], publisher: venue('Oxford Art Factory') }),
    E('ev_hollywood', 'Acoustic Fridays', 'pub', 'hollywood', day(0, 19, 30), day(0, 22), 0, 'Acoustic covers', 23, ['u_amelia'], { img: P.pub[1], publisher: venue('Hollywood Hotel'), recurs: 'weekly' }),
    E('ev_stonewall', 'Drag Bingo', 'pub', 'stonewall', day(0, 21), day(0, 23), 10, 'Bingo · drag', 112, [], { img: P.club[6], publisher: venue('Stonewall Hotel') }),
    // Saturday
    E('ev_bondirun', 'Bondi Run Club', 'run', 'pavilion', day(1, 7), day(1, 8, 30), 0, 'Run club · 6 km coastal', 180, ['u_jess', 'u_mia', 'u_will'], { img: P.beach[1], publisher: { type: 'community', name: 'Bondi Run Club', verified: false }, recurs: 'weekly' }),
    E('ev_carriage', 'Carriageworks Farmers Market', 'market', 'carriageworks', day(1, 8), day(1, 13), 0, 'Produce · coffee', 640, ['u_mia', 'u_charlotte'], { img: P.food[6], publisher: feed, recurs: 'weekly' }),
    E('ev_glebe', 'Glebe Markets', 'market', 'glebe', day(1, 10), day(1, 16), 0, 'Vintage · food', 310, ['u_ava'], { img: P.friends[4], publisher: feed, recurs: 'weekly' }),
    E('ev_brunch', 'Bottomless Brunch', 'food', 'bills', day(1, 11), day(1, 13), 69, 'Brunch · spritz', 51, [], { img: P.food[3], publisher: venue('bills Surry Hills') }),
    E('ev_mca', 'After Hours: New Photography', 'exhibition', 'mca', day(1, 17), day(1, 21), 0, 'Photography', 96, ['u_georgia', 'u_imogen'], { img: P.gig[6], publisher: feed }),
    E('ev_77sat', 'Saturdays at 77', 'dj', 'club77', day(1, 23), day(2, 5), 20, 'House / Disco', 154, ['u_jack', 'u_hannah', 'u_ruby'], { img: P.club[2], publisher: venue('Club 77'), deal: '$10 entry before midnight', recurs: 'weekly', blurb: 'Disco upstairs, house downstairs. Last entry 3 AM.' }),
    E('ev_oafsat', 'Late Night Disco', 'club', 'oaf', day(1, 22, 30), day(2, 3), 18, 'Disco / Funk', 72, [], { img: P.club[9], publisher: venue('Oxford Art Factory') }),
    // Sunday
    E('ev_fair', 'Crown St Spring Fair', 'festival', 'shannon', day(2, 10), day(2, 17), 0, 'Stalls · live music', 520, ['u_bella', 'u_maddie'], { img: P.friends[8], publisher: feed }),
    E('ev_bero', 'Sunday DJs in the beer garden', 'dj', 'beresford', day(2, 14), day(2, 18), 0, 'Disco / Soul', 88, ['u_emily', 'u_grace'], { img: P.pub[2], publisher: venue('The Beresford'), recurs: 'weekly' }),
    E('ev_nrl', 'NRL Grand Final on the big screen', 'sport', 'beresford', day(2, 18), day(2, 22), 0, 'NRL', 230, ['u_maddie', 'u_tyler', 'u_sam', 'u_ben'], { img: P.pub[0], publisher: venue('The Beresford'), blurb: 'Big screen in the beer garden. Book a table for 6 or more.' }),
    E('ev_nrl2', 'Grand Final on the rooftop', 'sport', 'bank', day(2, 18), day(2, 22), 0, 'NRL', 160, ['u_dan', 'u_tom'], { img: P.pub[6], publisher: venue('Bank Hotel') }),
    // Next week
    E('ev_comedy2', 'Comedy at the Duke', 'comedy', 'duke', day(5, 19, 30), day(5, 21, 30), 15, 'Stand-up', 34, [], { img: P.gig[6], publisher: venue('Duke of Enmore') }),
    E('ev_housefri2', 'House Fridays', 'club', 'cliffdive', day(7, 20), day(8, 3), 20, 'House / Dance', 41, ['u_zoe'], { img: P.club[4], publisher: venue('Cliff Dive'), recurs: 'weekly', blurb: 'Resident DJs in the tiki basement from 8. Free entry before 9 with a drink.' }),
    E('ev_kito', 'Kito Mara — Live', 'live', 'hordern', day(7, 20), day(7, 23), 89, 'Electronic / Live', 2300, ['u_josh', 'u_priya', 'u_liam', 'u_zoe', 'u_harry'], { img: P.gig[2], publisher: feed, blurb: 'Australian tour. Support from 8, Kito Mara on at 9:30. All ages, 18+ bar.' }),
  ];
}

// ---- DEMO DATA: anonymous crowd reports + public venue photos ---------------
// Simulated, clearly separate from friends' data. Production: reports come from people at the
// venue; public photos are ones people chose to share publicly at a venue. No names attached.
function demoCity(now: number): { reports: CrowdReport[]; venuePhotos: PublicPhoto[] } {
  const r = rng(77);
  const MIN = 6e4;
  const hourNow = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const reports: CrowdReport[] = [], venuePhotos: PublicPhoto[] = [];
  const CROWD = ['quiet', 'moderate', 'busy', 'packed'], QUEUE = ['none', 'short', 'medium', 'long'];
  venues.forEach((v) => {
    const [pop, peak] = POP[v.id] || [0.3, 21];
    const busy = pop * Math.exp(-(((hourNow - peak) / 3.2) ** 2));
    if (v.cat === 'spot' || busy < 0.3) return;
    const n = Math.round(busy * 7 + r() * 2);
    const lvl = Math.min(3, Math.floor(busy * 4.2));
    for (let k = 0; k < n; k++) {
      const at = now - Math.round(3 + r() * 80) * MIN;
      const jitter = r() < 0.25 ? (r() < 0.5 ? -1 : 1) : 0;
      reports.push({ id: `dr_${v.id}_${k}c`, venueId: v.id, kind: 'crowd', value: CROWD[Math.max(0, Math.min(3, lvl + jitter))], at, userId: null, demo: true });
      if (r() < 0.6) reports.push({ id: `dr_${v.id}_${k}q`, venueId: v.id, kind: 'queue', value: QUEUE[Math.max(0, Math.min(3, lvl - 1 + jitter))], at, userId: null, demo: true });
      if (r() < 0.3) reports.push({ id: `dr_${v.id}_${k}e`, venueId: v.id, kind: 'entry', value: v.cat === 'club' && hourNow > 20 ? 'cover' : 'free', at, userId: null, demo: true });
      if (r() < 0.3) reports.push({ id: `dr_${v.id}_${k}v`, venueId: v.id, kind: 'vibe', value: v.cat === 'club' ? 'dancing' : v.cat === 'gig' ? 'live' : busy > 0.55 ? 'loud' : 'chatty', at, userId: null, demo: true });
    }
    const np = Math.round(busy * 9 * r());
    const pool = poolFor(v.cat);
    for (let k = 0; k < np; k++) venuePhotos.push({ id: `vp_${v.id}_${k}`, venueId: v.id, u: pool[Math.floor(r() * pool.length)], takenAt: now - Math.round(2 + r() * 150) * MIN, visibility: 'public', userId: null, demo: true });
  });
  return { reports, venuePhotos };
}

// Saved collections (per person). Items: { venueId } or { eventId }.
const collections = (): Record<string, SavedCollection[]> => ({ u_ollie: [
  { id: 'want', name: 'Want to go', items: [{ venueId: 'tilly' }, { venueId: 'arcadia' }, { venueId: 'palmer' }] },
  { id: 'pubs', name: 'Good pubs', items: [{ venueId: 'clock' }, { venueId: 'dolphin' }, { venueId: 'forresters' }, { venueId: 'royalalbert' }, { venueId: 'norfolk' }] },
  { id: 'food', name: 'Restaurants', items: [{ venueId: 'porteno' }, { venueId: 'nomad' }, { venueId: 'bloodwood' }] },
  { id: 'late', name: 'Late night', items: [{ venueId: 'bigpoppas' }, { venueId: 'club77' }, { venueId: 'kingscross' }] },
  { id: 'date', name: 'Date night', items: [{ venueId: 'goldenage' }, { venueId: 'arthur' }] },
] });


export { venues, users, build, events, P, poolFor, POP, PLACES, demoCity, collections };
