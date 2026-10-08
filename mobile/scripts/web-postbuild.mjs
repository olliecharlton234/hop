// After `expo export --platform web`: stamp the service worker with this build's id and fill in
// the public URL used by link previews. Runs locally and on Vercel (npm run build:web).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const build = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 10) || Date.now().toString(36);
const appUrl = (process.env.EXPO_PUBLIC_APP_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).replace(/\/+$/, '');

const sw = new URL('sw.js', dist);
if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__BUILD_ID__', build));

const index = new URL('index.html', dist);
let html = readFileSync(index, 'utf8').replaceAll('%APP_URL%', appUrl);
writeFileSync(index, html);

console.log(`web-postbuild: build ${build}${appUrl ? `, links ${appUrl}` : ''}`);
