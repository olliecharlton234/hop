# HOP — prototype

Map-first app for planning nights out with friends: plan together → go out → share photos live → keep the memory.

## Run it

Open **HOP.html** in Chrome or Safari. It's one self-contained file. It needs an internet connection for the map tiles, fonts and demo photos; without one it falls back to a simple drawn map of the inner city.

To see it as a phone, open dev tools and switch to a device view (e.g. iPhone 14).

## What you're looking at

The demo opens at **Friday, 7:04 PM** (Profile → "Use real time" switches this off). About 30 of your 50 friends are out: Jack's knock-offs are live at Frankie's Pizza, Noah's crew is at the Night Noodle Markets, Sarah's planning dinner and a gig in Newtown, and Ollie's Birthday is tomorrow.

**Map key**

| On the map | Means |
|---|---|
| Round pin, coloured icon | Venue (pub, bar, club, food, live music) |
| Coloured ring (yellow / orange / red) | Busy / very busy / packed right now |
| Small face on a pin | Friends are there |
| Small blue diamond on a pin | Something's on there tonight |
| Small photo on a pin | Photos taken there tonight |
| Blue diamond | Public event (club night, market, run club…) |
| Friend's face, white ring | A friend's outing |
| Friend's face, red pulsing ring | A friend's outing that's live now |
| Amber numbered squares + route | Your outing |
| Colour under the streets | Activity, blue (quiet) → green → yellow → orange → red (packed). Turn on/off with **Activity** |
| Neighbourhood name + "Very busy · rising" | How alive that area is, with friends you can see and things on |
| Faces with "Jack + 4" | A group of your friends at one place |

The map reveals more as you zoom: neighbourhoods first, then friend groups and major events, then busy venues, then every venue with names and what's happening there.

## Activity (heat) layer

**Activity** (right side) colours the city by how busy it is: **Quiet** (blue) · **Moderate** (green) · **Busy** (yellow) · **Very busy** (orange) · **Packed** (red). A small key sits above the time control (tap × to hide it). **Now · Later tonight · Tomorrow · This weekend** change the colours; future windows are a forecast, drawn softer and labelled "Forecast".

Tap a coloured part of the map, or a neighbourhood name, to see **why** it's busy: the level and when it peaks ("Peak expected packed · 7–11:30pm"), the main reasons, friends around, what's popular now, what's starting soon and recent public photos.

How it's built (`js/activity.js`): `Heat(area, time)` = weighted sum of pluggable sources (anonymous presence, planned outings, public outings and events, venue patterns, crowd reports, recent photos). `cells(when)` turns that into a grid the map draws: each cell is `{ cell, lat, lng, intensity, level, confidence, timeWindow }` with levels `QUIET / MODERATE / BUSY / VERY_BUSY / PACKED`. The grid can be swapped for H3 cells without touching the map. Privacy is enforced in that file: only area-level heat and public points reach the map; private outings, attendees, routes and individual locations never do, and user signals only count once an area/time bucket passes a minimum size.

**Demo data:** the wider city population (`DEMO_POP`, `DEMO_PLANS`), the anonymous crowd reports and the public venue photos are simulated (`seed.demoCity`). Friends' outings and events from the demo data feed in the same way real data would.

## Map modes

The bar under search switches what the map shows:

- **Tonight**: everything, with the Tonight sheet.
- **Friends**: Out now · Outings · Recent (only friends who share where they are, or outings you can see).
- **Places**: All · Pubs · Bars · Clubs · Food · Late night, ranked by how busy they are now.
- **Events**: What's on, with Tonight · Tomorrow · Weekend · Music · Comedy · Sport.

**Search** before typing shows popular tonight, busy areas, events starting soon, popular with friends, your saved places and recent searches. Typing searches places, events, public outings and areas.

## Venues, crowd reports, saved lists

A venue card leads with its state ("PACKED · Activity rising"), what's on, who's there, the latest **crowd reports** (Crowd · Queue · Entry · Music, "6 reports · Updated 8m ago") and tonight's photos. Actions: **Add to outing · Save · Share · Report**.

**Report** only works when you're there (within about 600 m of the venue in the demo, or at your outing's current stop). Reports are anonymous, fade over 45 minutes, need a few to count, and only nudge the area's activity.

**Save** puts a place or event into a list: Want to go, Good pubs, Restaurants, Late night, Date night. When adding stops, tap **Saved** to pick from a list (Saved → Good pubs → The Clock).

## During a night out

The middle button becomes the **camera** while you're on a live outing. The live sheet has **Where next?**: three nearby options ranked by distance, how busy they are now and later, events, friends there, saved places, chat votes and the route ("6 min walk · Busy · 4 friends there"). **Add stop** (organiser) or **Vote** (starts a vote in the chat).

## Home through the day

The Tonight sheet has three heights: **peek** (about a fifth of the screen: three one-line rows, e.g. your next plan, how many friends are out, what's starting nearby), **explore** (half) and **full**. Expanded it shows Your plans, Friends tonight, What's happening, Popular tonight, Busy areas, Recent from friends and Saved. What leads changes with the time: last night's photos and weekend plans in the morning, plans and "expected busy tonight" in the afternoon, people, things starting soon, busy areas and recent photos in the evening, your group and friends nearby late at night. Preview each one from **Profile → Preview how Home changes**. If there's little happening near you it says so and shows what's on across Sydney instead of inventing activity.

## Friday-night demo

1. Read the **Tonight** rows at the bottom of the map. Tap **Join** on Jack's knock-offs, or **30 friends are out** to see who's where.
2. Tap **What's on** (top left). Filter Tonight / Tomorrow / This weekend / Music / Nightlife / Food / Sport / Free.
3. Open **Saturdays at 77** → **Add to outing** → Ollie's Birthday. It becomes a stop at 11 PM.
4. Search What's on for **Kito Mara** (a gig next Friday at the Hordern) → **Plan a night around this**. You get dinner → gig → drinks after, ready to invite people.
5. Start Ollie's Birthday → tap the big white **camera** button. On a phone or laptop with a camera it opens straight into the viewfinder; each shot goes to the outing immediately, tagged with you, the time and the current stop. "Just me" keeps it private.

## Outing chat

Every outing has its own small group chat for the people on it. It isn't a general messenger: no DMs, no public rooms. Links from WhatsApp, Messenger or iMessage get people into the outing; this chat runs the night once they're in.

- **Plan / Chat / Photos** tabs on every outing, live outing and memory. The map stays above.
- **Messages**: text, @mentions, replies (tap a message), reactions, photos pointed at from the album, places, live location, and "where next?" votes.
- **Quiet system lines** for the things that matter: joined, stop added, next stop changed, the group is now at…, photos added (with a preview that opens the album), vote results.
- **Share a place**: tap any venue on the map → **Send to outing**. Others can view it on the map, say "I'm keen", or the organiser can add it as a stop. Events can be sent the same way.
- **Share my location**: one tap, visible to that outing for 30 minutes, shown on the map with your face, stoppable any time. No background tracking.
- **Notifications**: All messages / Mentions only / Mute per outing. Updates such as "added 6 photos" never notify on their own. Outings you're only invited to default to mentions.
- **Lifecycle**: planning before, coordinating during, a short tail after; the chat closes 48 hours after the night and stays readable inside the memory.
- **Unread + last message** show on the Tonight rows and the Outings list.

Try it: open **Ollie's Birthday → Chat**, ask "Where are you guys?" and someone answers. Tap **+ → Vote: where next?** and watch votes come in. Open Jack's knock-offs chat to see a live location share. For real-time between people, use **Profile → Open Jack in a new tab** and message from there.

## Original demo flow

1. **Profile → Remove Ollie's Birthday** so you can make it from scratch. (Or skip this and open the one already planned.)
2. Tap **+** → name it, pick the cake icon, Saturday 7:30 PM → **Next: pick the stops**.
3. Tap The Clock, Tio's, Cliff Dive, Club 77 on the map (or search) → **Add as stop** each time → **Done**.
4. Drag the grip handles to reorder, edit times inline. **Invite** → copy the link, or tick friends. Some reply within seconds.
5. **Start the night** → live map with Now / Next stop. Take a photo or add some from your camera roll.
6. **Photo rush** (prototype controls at the bottom of the live sheet) shows batched notifications. **Open as Jack** opens a second tab as Jack: photos added there pop up in the first tab in real time.
7. **Go to Tio's** … → **End the night** → wrap-up → it's now in **Memories** with the route, people and photos.

Data is saved in the browser (localStorage). **Profile → Reset demo data** starts over.

## Code

`app/` is the source; `python3 app/build.py` rebuilds `HOP.html`. No framework, no build step needed to run `app/index.html` directly either.

| File | What it does |
|---|---|
| `js/seed.js` | Demo venues (real Sydney spots), 50 friends, tonight's outings and who's where, memories, demo events |
| `js/events.js` | Public events: one normalised shape, pluggable sources (demo data now; listings feeds and verified venues later), filters |
| `js/screens-events.js` | What's on, the event sheet, add-to-outing and "plan a night around this" |
| `js/activity.js` | City activity model: areas, weighted signal sources, time windows, privacy thresholds, five levels, the cell grid the map draws |
| `js/screens-tonight.js` | The Tonight sheet (peek / explore / full), Friends and Places modes, Where next?, saved lists, the area sheet |
| `js/screens-chat.js` | Outing chat: Plan / Chat / Photos tabs, messages, place and location cards, votes, notification settings |
| `js/store.js` | The core entities — User, Outing, Attendee, Stop, Photo, plus Message — with mutations, read state, persistence and cross-tab sync |
| `js/map.js` | Leaflet map, venue pins, route drawing (plan / live / memory modes), offline fallback |
| `js/ui.js` | Bottom sheet, layers, modals, banners |
| `js/screens-*.js` | Map home + venue + outings, create/plan/invite, live + album, memories + profile |
| `js/app.js` | Routing, notification batching, the group simulator |

### Where later features plug in

- **Real backend / live sync**: replace `persist()` and the BroadcastChannel in `store.js` (Supabase or Firebase realtime fit this shape).
- **Live friend locations**: today "who's where" comes from live outings plus a `presence` list (friends who share where they are). Swap `presence` for real location sharing.
- **Public venue photos**: demo ones live in `state.venuePhotos` (`visibility: 'public'`, no names). A real feed would be photos people chose to share publicly at a venue.
- **Crowd reports**: `state.reports` (`{ venueId, kind, value, at }`); `store.reportsAt()` gives the recency-weighted read per category.
- **Business profiles, deals, promotion**: `Venue.claimed`/`Venue.deals` and each event's `publisher` (`venue` / `feed` / `community`, `verified`), `deal` and `promoted` fields are in place. A venue dashboard would write events through a new source in `events.js`; engagement is already counted (`interested`, friends interested).
- **External event listings**: add a source to `HOP.events.sources` that returns raw events; `normalize()` maps them to the shared shape.
- **Holidays, festivals, run clubs, day trips**: `Outing.kind` is `'night'` today; stops can already hold a non-venue `place`.
- **Travel Safe routing**: routes are drawn as arcs between stops in `map.js → showRoute`; swap in real walking routes there.
