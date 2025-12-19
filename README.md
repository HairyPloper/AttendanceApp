# AttendanceApp

[![Deploy](https://github.com/HairyPloper/AttendanceApp/actions/workflows/deploy.yml/badge.svg)](https://github.com/HairyPloper/AttendanceApp/actions/workflows/deploy.yml)

Small Expo + Router app. This repo includes a ready-to-run web deploy workflow that publishes to GitHub Pages.

## Quick setup

1. Install dependencies:

```bash
npm install
```

2. Format and type-check before committing:

```bash
npm run format
npm run typecheck
```

3. Build and test web locally (export static web):

```bash
npm run build-web
# serve dist locally, e.g. using 'npx serve dist' or similar
npx serve dist
```

4. Deploy to GitHub Pages (the repo homepage is set to `https://<user>.github.io/AttendanceApp`):

```bash
npm run deploy
```

## Helpful scripts (added)

- `npm run clean` — remove build caches and `dist` folder.
- `npm run format` — run Prettier to format code.
- `npm run format:check` — check formatting.
- `npm run typecheck` — run TypeScript type-check (no emit).
- `npm run build-web` — export static web build (`expo export -p web --clear`).
- `npm run deploy` — build and publish `dist` to `gh-pages` (already present). The deploy script creates `dist/.nojekyll` so GitHub Pages will serve files and folders that start with an underscore (for example `_expo/`).

## Notes about GitHub Pages

- In your repository Settings → Pages, ensure the Source is set to the `gh-pages` branch and the folder set to `/ (root)`.
- If you host at the repository subpath (not the user root), ensure links and asset paths resolve correctly; the deploy script creates `.nojekyll` so underscore-prefixed runtime files (like `_expo/`) are served by Pages.

## Clean-up checklist before push

- Run `npm run format` and `npm run typecheck` locally.
- Remove any local secrets or tokens from files (check `git status` and local config files).
- Commit changes and push to your `main` branch, then run `npm run deploy` to publish web assets.

If you want, I can:
- Add a `prettier` config and run it across the repo.
- Add `husky` + `lint-staged` to enforce formatting on commit.
- Create a GitHub Actions workflow to build & publish Pages automatically on push to `main`.
