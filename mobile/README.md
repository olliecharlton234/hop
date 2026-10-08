# HOP — React Native app (native + web beta)

HOP rebuilt with React Native components (no web view). One codebase, two ways to run it:

- **Web beta (V6.1)** — deployed from GitHub to Vercel. Anyone with the link can open it on their
  phone and add it to their Home Screen. No App Store, no TestFlight.
- **Native app (V6)** — Expo Go on iPhone and Android for development, EAS builds later.

Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router. Data is demo data behind service
interfaces, so V7 can plug in Supabase without rewriting the screens.

---

## Web beta

| | Command |
|---|---|
| Local web development | `npx expo start --web` (opens http://localhost:8081) |
| Production build | `npm run build:web` → `dist/` |
| Preview the production build | `npm run serve:web` → http://localhost:8099 |

### Deploy: GitHub → Vercel

Every push to the production branch redeploys automatically. Every other branch and pull
request gets its own preview URL.

**Vercel settings** (most are already in `vercel.json`, so Vercel picks them up itself):

| Setting | Value |
|---|---|
| Root Directory | `mobile` ← set this when importing; the old prototype is never deployed |
| Framework Preset | Other |
| Install Command | `npm ci` |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |
| Node.js version | from `package.json` engines (`>=20.19.4`, Vercel uses 24.x). Tested on 22 and 24. |
| Production Branch | `v6-web-beta` (or `main` once you merge it) |

Routing: `vercel.json` sends every path that isn't a real file to `index.html`, so links like
`/outing/o_abc`, `/event/ev_77sat`, `/venue/clock` and `/memory/o_tomcrawl` open directly and
survive a refresh. Hashed bundles are cached for a year; `index.html` and `sw.js` are never cached,
so a new deploy reaches people on their next open.

**First deploy, step by step**

1. Create an empty repository on GitHub (private is fine), e.g. `hop`.
2. In the `HOP` folder on your computer:
   ```bash
   git remote add origin https://github.com/<you>/hop.git
   git push -u origin v6-web-beta   # push this first, so it becomes the repo's default branch
   git push origin main v6-native
   ```
3. On vercel.com → **Add New… → Project** → import the repo.
4. Set **Root Directory** to `mobile`. Leave the rest as detected (they come from `vercel.json`).
5. Optional: add environment variables (below). **Deploy.**
6. You get a URL like `https://hop-xyz.vercel.app`. Send it to anyone.

After that: commit → `git push` → Vercel deploys → the beta is live (about 1–2 minutes).

**Custom domain later** (gethop.app, tryhop.app…): Vercel → Project → Settings → Domains → add
it. No code changes: links use whatever domain the app is opened on. Set `EXPO_PUBLIC_APP_URL`
to the domain if you also want links shared *from the native app* to point there.

### Environment variables

All optional. Copy `.env.example` to `.env` locally; in Vercel add them under
Project → Settings → Environment Variables, then redeploy.

| Variable | What | Public? |
|---|---|---|
| `EXPO_PUBLIC_APP_URL` | Base URL for shared links (defaults to the current domain on web) | public |
| `EXPO_PUBLIC_POSTHOG_KEY` / `_HOST` | Analytics (PostHog project key, `phc_…`) | public, write-only |
| `EXPO_PUBLIC_FEEDBACK_URL` | Form link for "Send feedback" (Tally, Google Forms) | public |
| `EXPO_PUBLIC_FEEDBACK_EMAIL` | Or an email address for feedback | public |
| `EXPO_PUBLIC_MAP_TILE_URL` / `_LABELS_URL` / `_ATTRIBUTION` | Swap the web map tiles | public |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | V7 | public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | V7, server only | **private — never `EXPO_PUBLIC_`** |

Anything starting `EXPO_PUBLIC_` is compiled into the JavaScript every visitor downloads. Never
put a secret there. V6.1 has no secrets at all.

Map tiles: the web map uses Esri's keyless dark basemap, so there's no key to leak. For a public
launch, switch to a provider with a key (Mapbox, MapTiler, Stadia) via `EXPO_PUBLIC_MAP_TILE_URL`
and restrict that key to your domains (`*.vercel.app` previews, your custom domain, `localhost`)
in the provider's dashboard.

### Add HOP to your Home Screen

**iPhone (Safari):** open the link → tap **Share** (square with an arrow) → scroll → **Add to
Home Screen** → **Add**. HOP opens full screen from its own icon, with its own launch screen.
In Chrome on iPhone it's Share → Add to Home Screen too (iOS 16.4+).

**Android (Chrome):** open the link → HOP offers **Install** after a moment on the map (or menu
⋮ → **Install app** / **Add to Home screen**).

HOP shows a small one-time tip about this on phones after you've had a moment on the map. It
never shows during onboarding, over an invite, or once installed. Profile → HOP Beta → "Add HOP
to your Home Screen" shows the steps again.

### Web vs native

| | Web beta | Native |
|---|---|---|
| Map | Leaflet + dark tiles, same pins, routes, heat, gestures | Apple Maps (iOS) / Google Maps (Android) |
| Camera | Phone's own picker: Take Photo or Photo Library, then HOP's preview → add → share-publicly choice | HOP's in-app camera + library |
| Photos stored | IndexedDB in the browser (this device only) | App storage on the phone |
| Save photo | Downloads the file | Saves to camera roll |
| Share | Web Share API (phone share sheet); copies the link where unsupported | OS share sheet |
| Location | Browser prompt when you tap Locate; one reading | OS prompt when you tap Locate; one reading |
| Notifications | In-app banners | In-app banners |

### Invite links (no backend yet)

An outing link is `/outing/<id>?i=<the plan>`. The plan (title, time, stops, who's going) rides
inside the link, so it opens on a phone that has never seen HOP: straight onto the outing with
**Join outing**, no onboarding first. Joining is saved on that phone only until V7 adds the
backend; the person who shared it won't see the RSVP yet.

### Analytics and feedback

`src/services/analytics.ts` tracks: app opened, onboarding started/completed, outing created,
outing joined, invite shared/opened, venue opened, event opened, heatmap enabled, Where Next
opened, photo added, memory opened, saved place added, install prompt shown/accepted, feedback
opened. Without a key nothing is sent. With `EXPO_PUBLIC_POSTHOG_KEY` it posts anonymous events
(random device id, no names, messages, photos, locations or links; no autocapture; Do Not Track
and Global Privacy Control respected). In PostHog, also turn on "Discard client IP data".
To use Plausible or Amplitude instead, replace the provider in that one file.

---

## Native app on your phone (Expo Go)

### 1. One-time setup

1. On your computer, install **Node.js LTS** (22 or 24) from nodejs.org. Check it worked with `node -v`.
2. On your phone, install **Expo Go** from the App Store or Google Play.
   - It must support **SDK 57**. If it says the project is incompatible, update Expo Go.
3. Make sure your phone and computer are on the **same Wi-Fi**.

### 2. Install and start

Open a terminal (PowerShell is fine) in this `mobile` folder:

```bash
npm install
npx expo start --go
```

A QR code appears in the terminal. (`--go` matters: this project also has `expo-dev-client`
installed for EAS builds, so plain `npx expo start` targets a development build. If you forget,
press `s` in the terminal to switch to Expo Go.)

- **iPhone:** open the Camera app, point it at the QR code and tap the banner. HOP opens in Expo Go.
- **Android:** open Expo Go and tap **Scan QR code**.

The first load takes about 20–40 seconds while the app bundles. After that, saving a file
reloads the app on your phone instantly.

### 3. If the phone can't connect

- **Windows Firewall:** the first time you run `npx expo start`, Windows asks whether Node.js
  can use the network. Allow it on **Private** networks.
- **Phone and computer can't see each other** (common on uni, work or hotel Wi-Fi): run
  `npx expo start --go --tunnel` instead. Accept the prompt to install `@expo/ngrok`.
- **"Incompatible SDK version":** update Expo Go from the store.
- **Stuck on the splash screen or seeing old code:** run `npx expo start --go -c` to clear the bundler cache.
- **OneDrive:** `node_modules` is about 40,000 files, and OneDrive will try to sync them, which
  is slow and can lock files while Metro runs. Either pause OneDrive while you work, or run HOP
  from a clone outside OneDrive:
  `git clone -b v6-native C:\OneDrive\PERSONAL\HOP C:\dev\HOP`
  then `cd C:\dev\HOP\mobile`. `node_modules` is git-ignored, so it is never committed.

---

## Things to try on the phone

| Try | Where |
|---|---|
| Drag the Tonight sheet: peek → explore → full | Map |
| Tap **Later tonight / Tomorrow**, watch the colours change, then tap a red area | Map |
| Tap **Friends / Places / Events** and their filters | Map, under search |
| Search before typing, then type "trivia" or "Newtown" | Map, search |
| A venue → **Save**, **Share** (your phone's share sheet), **Report** | Map, any venue |
| **+** → name it → pick stops → reorder (long-press the grip) → **Invite** | Bottom nav |
| An outing → **Chat** → "where are you guys?" → **+** → Vote: where next? | Outings |
| **Start the night** → **Where next?** → the centre button becomes the camera | Ollie's Birthday |
| Take a photo → confirm → **Share publicly** or **Keep with outing** | Camera |
| **End the night** → the memory shows the route and photos | Live outing |

**Demo controls** are in Profile. From there you can:

- view the app as Jack or Sarah
- switch between your real location and the demo location
- preview Home at other times of day
- reset the demo data

### Camera (native)

- HOP asks for camera access the first time you open the camera, not at launch.
- If you deny it, HOP offers Settings or your photo library instead.
- Photos are kept in the app's own storage on the phone. The outing album is the original copy.
- **Share publicly** is always opt-in. The default is **Keep with outing**.

### Location (native)

- HOP asks for location only when you tap the locate button, or choose "My location" in Profile.
- It takes one reading. It never tracks you in the background.
- If you say no, or you're more than 30 km from inner Sydney (where all the demo data is), HOP
  uses a demo spot in Surry Hills.
- Crowd reports need you to be within about 600 m of the venue, or at your live outing's
  current stop. The demo location is about 3 minutes' walk from The Clock, so you can report there.

---

## Project structure

```
mobile/
  app.json                 Expo config: name, icons, permission wording (camera, photos, location)
  src/
    app/                   Screens (Expo Router). One file per route.
      (tabs)/              Map · Outings · Memories · Profile   (+ centre button: New / Camera)
      outings/[id].tsx     An outing: Plan / Chat / Photos; live mode; memory
      outings/create.tsx   New / edit outing
      outings/pick.tsx     Adding stops on the map
      camera.tsx photo.tsx album/[id].tsx wrap/[id].tsx
      outing/ event/ venue/ memory/   shared links: /outing/:id (invite), /event/:id, /venue/:id, /memory/:id
      events/[id].tsx memories/[id].tsx   older deep links (hop://events/ev_x)
    components/
      map/                 HopMap (zoom tiers, modes, declutter), pins, MapCanvas (native) / .web
      heatmap/             Heat image renderer (ActivityCells → ground overlay), Activity controls
      sheets/              HopSheet (native-gesture bottom sheet), modal sheets
      discovery/           Tonight, search, Friends/Places/Events modes, area sheet, rows
      venues/ events/      Venue live card, event sheet
      outings/ chat/ camera/   Outing panels, Where next?, stops, chat, photo flows
      onboarding/          First-open intro (3 screens), Add to Home Screen tip
      ui/                  Type, buttons, avatars, photos, icons (vector, no emoji), banners
    services/              What the UI calls: outingService, venueService, eventService,
                           photoService, chatService, activityService, friendService,
                           reportService, savedService, locationService, shareService,
                           linkService (share/invite links), analytics, localPhotos (.web = IndexedDB)
    data/demo/             DEMO DATA + the local "backend": seed, repository, activity model,
                           group simulator. Only services import from here.
    store/                 hopStore (local cache + persistence + selective subscriptions), uiStore, prefs
    config/env.ts          Public build-time config (EXPO_PUBLIC_*): app URL, map tiles, analytics, feedback
    types/models.ts        User, Friend, Outing, OutingMember, OutingStop, Venue, Event, Message,
                           Photo, PublicPhoto, CrowdReport, SavedPlace, ActivityCell, Notification…
    theme/                 Colours, five heat levels, fonts (fonts.web.ts: small WOFF2 subsets)
    utils/pwa.ts           Web install prompt, standalone detection, service worker registration
  public/                  Web only: index.html (PWA meta, loading screen), manifest, icons,
                           iPhone launch screens, fonts, sw.js, og.png (link preview)
  scripts/                 web-postbuild.mjs (stamps sw.js + preview URL), serve-dist.mjs (local preview)
  vercel.json              Vercel build, routing (every path → index.html) and caching rules
  .env.example             Every environment variable, public vs private
```

Platform-specific code lives in `*.web.ts(x)` files next to the native file (map, fonts, photo
storage), or behind `Platform.OS === 'web'` for a few lines (camera picker, share, location).
Native code paths are unchanged.

**How data flows:** a screen reads data through `useHop(selector)` and calls a service. In V6,
each service calls the demo repository in `data/demo`. In V7, the same functions will call
Supabase instead (queries, RPCs, Realtime channels, Storage), and the screens won't change.

### Scripts

```bash
npx expo start --go     # native: run on your phone (Expo Go)
npx expo start --web    # web: local development
npm run build:web       # web: production build into dist/
npm run serve:web       # web: preview dist/ at http://localhost:8099 with Vercel's routing
npm run typecheck       # TypeScript
npx expo export --platform ios --platform android   # check the native bundles build
```

### Builds outside Expo Go (later)

When you want your own installable native app (TestFlight or Play internal testing):

1. Run `npx eas-cli build --profile development` (or `preview`). `eas.json` is set up.
2. Add a Google Maps API key to `app.json` under the react-native-maps plugin. Expo Go doesn't
   need one, but a standalone Android build does. An iOS build only needs one if you switch iOS
   to Google Maps. It uses Apple Maps today.
