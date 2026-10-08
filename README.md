# HOP

A map-first social app for organising real-world outings with friends.

| Folder | What it is | How to run |
|---|---|---|
| `mobile/` | **HOP V6 / V6.1**: the React Native app (Expo + TypeScript + Expo Router). Runs natively on iPhone and Android, and as a web beta / installable PWA deployed to Vercel | See `mobile/README.md` |
| `prototype/` | **HOP V5**: the original web prototype. Design reference, kept unchanged, never deployed | Open `prototype/HOP.html` in a browser |

## Quick start

**Web beta (any phone, via a link)**
- Vercel project → Root Directory `mobile`, everything else comes from `mobile/vercel.json`.
- `git push` → Vercel deploys → share the URL → open on a phone → Share → Add to Home Screen.
- Local: `cd mobile && npm install && npx expo start --web`.

**Native (development)**
- `cd mobile && npm install && npx expo start --go` → scan the QR code with Expo Go.

## Branches

- `main`: V5 as first committed.
- `v6-native`: the native migration (V6), plus EAS setup.
- `v6-web-beta`: V6.1 web/PWA beta on top of V6. Deploy this one.
