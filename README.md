# AttendanceApp

[![Deploy](https://github.com/HairyPloper/AttendanceApp/actions/workflows/deploy.yml/badge.svg)](https://github.com/HairyPloper/AttendanceApp/actions/workflows/deploy.yml)

Small Expo Router attendance app with QR check-in, personal history, cached event data, and leaderboard views.

## Quick Setup

1. Install dependencies:

```bash
npm install
```

2. Validate before committing:

```bash
npm run typecheck
npm run format:check
npm test
```

3. Run locally:

```bash
npm start
```

4. Build static web output:

```bash
npm run build-web
```

## Scripts

- `npm start` - start Expo.
- `npm run web` - start Expo web dev mode.
- `npm run android` / `npm run ios` - run native builds.
- `npm run clean` - remove generated build/cache folders.
- `npm run typecheck` - run TypeScript without emitting files.
- `npm run format` / `npm run format:check` - write or check Prettier formatting.
- `npm test` - run Jest.
- `npm run build-web` - export the static web build into `dist`.
- `npm run deploy` - manual `gh-pages` deployment path.

## GitHub Pages

The included workflow builds on pushes to `main`, uploads `dist`, and deploys with GitHub Pages Actions. In repository settings, use GitHub Actions as the Pages source.

If local Git commands fail with a dubious ownership warning, mark this checkout as safe:

```bash
git config --global --add safe.directory D:/Learn/event_attendance_app/AttendanceApp
```
