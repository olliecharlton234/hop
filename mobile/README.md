# HOP V6 — native app (React Native + Expo)

HOP V5 rebuilt as a real phone app: same design, same behaviour, built from React Native
components (no web view). It runs on demo data that sits behind service interfaces, so V7 can
plug in Supabase without rewriting the screens.

- **Expo SDK 57**, React Native 0.86, TypeScript, Expo Router
- Runs in **Expo Go** on iPhone and Android. You don't need a development build for anything in V6.

---

## Run HOP on your phone

### 1. One-time setup

1. On your computer, install **Node.js 22 LTS** from nodejs.org. Check it worked with `node -v`.
2. On your phone, install **Expo Go** from the App Store or Google Play.
   - It must support **SDK 57**. If it says the project is incompatible, update Expo Go.
3. Make sure your phone and computer are on the **same Wi-Fi**.

### 2. Install and start

Open a terminal (PowerShell is fine) in this `mobile` folder:

```bash
npm install
npx expo start
```

A QR code appears in the terminal.

- **iPhone:** open the Camera app, point it at the QR code and tap the banner. HOP opens in Expo Go.
- **Android:** open Expo Go and tap **Scan QR code**.

The first load takes about 20–40 seconds while the app bundles. After that, saving a file
reloads the app on your phone instantly.

### 3. If the phone can't connect

- **Windows Firewall:** the first time you run `npx expo start`, Windows asks whether Node.js
  can use the network. Allow it on **Private** networks.
- **Phone and computer can't see each other** (common on uni, work or hotel Wi-Fi): run
  `npx expo start --tunnel` instead. Accept the prompt to install `@expo/ngrok`.
- **"Incompatible SDK version":** update Expo Go from the store.
- **Stuck on the splash screen or seeing old code:** run `npx expo start -c` to clear the bundler cache.
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

### Camera

- HOP asks for camera access the first time you open the camera, not at launch.
- If you deny it, HOP offers Settings or your photo library instead.
- Photos are kept in the app's own storage on the phone. The outing album is the original copy.
- **Share publicly** is always opt-in. The default is **Keep with outing**.

### Location

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
      events/[id].tsx memories/[id].tsx   deep links (hop://events/ev_x)
    components/
      map/                 HopMap (zoom tiers, modes, declutter), pins, MapCanvas (native) / .web
      heatmap/             Heat image renderer (ActivityCells → ground overlay), Activity controls
      sheets/              HopSheet (native-gesture bottom sheet), modal sheets
      discovery/           Tonight, search, Friends/Places/Events modes, area sheet, rows
      venues/ events/      Venue live card, event sheet
      outings/ chat/ camera/   Outing panels, Where next?, stops, chat, photo flows
      ui/                  Type, buttons, avatars, photos, icons (vector, no emoji), banners
    services/              What the UI calls: outingService, venueService, eventService,
                           photoService, chatService, activityService, friendService,
                           reportService, savedService, locationService, shareService …
    data/demo/             DEMO DATA + the local "backend": seed, repository, activity model,
                           group simulator. Only services import from here.
    store/                 hopStore (local cache + persistence + selective subscriptions), uiStore
    types/models.ts        User, Friend, Outing, OutingMember, OutingStop, Venue, Event, Message,
                           Photo, PublicPhoto, CrowdReport, SavedPlace, ActivityCell, Notification…
    theme/                 Colours, five heat levels, fonts
```

**How data flows:** a screen reads data through `useHop(selector)` and calls a service. In V6,
each service calls the demo repository in `data/demo`. In V7, the same functions will call
Supabase instead (queries, RPCs, Realtime channels, Storage), and the screens won't change.

**Web build:** `npx expo start --web` also works, using a Leaflet version of the map. It's there
for quick checks and automated tests only. HOP is a phone app.

### Scripts

```bash
npx expo start          # run on your phone (Expo Go)
npx expo start --tunnel # if the phone can't reach your computer
npm run typecheck       # TypeScript
npx expo export --platform ios --platform android   # check the native bundles build
```

### Builds outside Expo Go (later)

V6 doesn't need this. When you want your own installable app (TestFlight or Play internal testing):

1. Run `npx eas-cli build --profile development` (or `preview`).
2. Add a Google Maps API key to `app.json` under the react-native-maps plugin. Expo Go doesn't
   need one, but a standalone Android build does. An iOS build only needs one if you switch iOS
   to Google Maps. It uses Apple Maps today.
