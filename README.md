# FitnessTrack

A free, open-source progressive overload tracker for strength training. Log every set, track weight and rep progression across all your exercises, and let the built-in algorithm decide when to increase load — no spreadsheets, no subscriptions, no cloud required.

An installable, offline-first web app (PWA): add it to your phone's home screen and log workouts with no signal and no server. Your data never leaves your device.


| <img height="768" alt="Screenshot 2026-05-18 084721" src="https://github.com/user-attachments/assets/7194704d-c4c8-4ec2-8428-39598b8e9347" /> | <img width="394" height="768" alt="FitnessTrack progression feedback — per-set targets advance automatically via double progression" src="https://github.com/user-attachments/assets/a42cf1b7-8edc-44d0-b97c-a6ba0022d9bd" /> | <img width="396" height="768" alt="FitnessTrack workout plan calendar — week-by-week session grid with completion status" src="https://github.com/user-attachments/assets/ef5f2243-1bf8-4a10-a4f2-425cf770bb6d" /><br> | <img height="768" alt="image" src="https://github.com/user-attachments/assets/cd8240bb-644f-43d2-bfae-c8188cf9e09a" /> |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |





## Features

- **Dynamic double progression** — each set climbs toward its rep-range ceiling, then adds weight and resets — automatically, based purely on the reps you actually log. No subjective check-ins
- **Self-tuning pace** — progression speeds up when you keep beating targets and slows down (with smaller weight steps) when you stall, entirely from your logged reps — no effort ratings to enter
- **Per-exercise rep ranges** — every exercise has an editable target rep range that drives its progression; seeded by movement type
- **Workout plans** — create named plans with configurable training days and exercises; run multiple plans (one active at a time)
- **Calendar view** — see every workout in a grid across weeks; navigate to any past or future session
- **Per-session logging** — log weight and reps per set; skip individual sets or entire sessions
- **Actual-vs-target feedback** — a per-set ▲ / = / ▼ glyph shows whether you beat, met, or missed each target
- **Exercise history** — per-exercise weight progression chart
- **Plan cycling** — when you finish the last session of a plan, the app prompts you to clone it into a new cycle with optional seed weights from any past week
- **Offline-first PWA** — installs to your home screen and works with no connection; the whole app, including its SQLite database, runs on the phone
- **Backups you own** — export the database to a file any time (Files, iCloud Drive, Google Drive…) and restore it on any device
- **Equipment filter** — select your available equipment; the exercise picker only shows relevant exercises
- **Custom exercises** — create exercises not in the built-in library
- **Weight units** — switch between kg and lbs; conversions are display-only, data is always stored in kg
- **Dark theme** — designed for gym lighting

FitnessTrack is an alternative to apps like Hevy, Strong, and JEFIT for lifters who want full control over their data. No account, no server, no paywalled features, no ads.

---

## Contents

- [How the algorithm works](#how-the-algorithm-works)
- [Tech stack](#tech-stack)
- [Installing on your phone](#installing-on-your-phone)
- [Hosting](#hosting)
- [Development](#development)
- [Updating](#updating)
- [Data](#data)

---

## How the algorithm works

FitnessTrack uses **dynamic double progression**. Every exercise has a target rep range — e.g. 8–12 — and each set is its own progression track. There are no subjective check-ins: the next session's targets are derived purely from the reps you actually logged.

### Per-set rules

Comparing your **actual** logged reps against the **target** you were given:

| Situation | Next session |
|---|---|
| Hit the top of the rep range | **Add weight** by one increment; reps reset to the bottom of the range |
| Hit the target, still below the ceiling | **+1 rep**, same weight (**+2** when you're on a hot streak — see [Adaptive tempo](#adaptive-tempo)) |
| Fell short of the target but stayed in range | **Hold at the reps you actually logged** — same weight; you have to beat that number before the target moves up |
| Couldn't reach the bottom of the range | **Hold and re-attempt** at the same weight; only if you miss the bottom a **second session in a row** does the weight ease off one increment |
| Skipped | Unchanged |

Because each set advances independently, your first (freshest) set tends to climb fastest and earn a weight bump before the others — the "dynamic" in dynamic double progression. A **descending-weight rule** keeps the profile sensible: no set is ever prescribed heavier than the set before it, so a later set that earns a bump waits at the top of its range until the earlier sets catch up, then they move together.

Weight increments are the exercise's configured step (scaled by the current [tempo](#adaptive-tempo)), capped at 10% of the working weight and rounded to the nearest 0.5 kg.

### Rep ranges

Each exercise carries its own rep range, seeded by movement type and editable any time — tap the ✎ on an exercise card or plan row:

| Movement type | Typical range |
|---|---|
| Heavy barbell compounds (deadlift, squat) | 4–8 |
| Moderate compounds (rows, presses) | 8–10 |
| Isolation (curls, extensions) | 8–12 |
| Small isolation (lateral raises, kickbacks) | 12–20 |
| Bodyweight | 12–20 |

### Worked example (Incline Curl, range 8–12, +1 kg increment)

| Session | You log | Next target |
|---|---|---|
| 1 | 20 × 9, 20 × 9, 20 × 8 | 20 × 10, 20 × 10, 20 × 9 |
| 2 | 20 × 12, 20 × 11, 20 × 10 | **21 × 8**, 20 × 12, 20 × 11 |

In session 2 the first set reached the ceiling (12) → it adds weight and resets to the floor (21 × 8), while sets 2 and 3 keep climbing reps at 20 kg. The sets are now on slightly different weights — each progressing on its own.

### Adaptive tempo

Progression speed self-tunes from your recent results — no input from you, no RIR sliders. Beat an exercise's targets **two sessions running** and it shifts to a **faster** tempo: reps climb +2 at a time and weight bumps take a bigger step. Fall short **two sessions running** and it shifts **slower**: weight changes shrink to the smallest step, so you thread through a sticking point instead of bouncing off it. Otherwise it runs at the normal +1 pace. The signal is purely objective — your logged volume (weight × reps) versus the target you were given.

### Feedback

While an exercise is in progress its card shows a progressive-overload hint — how this session's target compares to your last performance, including a weight change when the algorithm deloads a set (shown in amber, since easing off isn't progress). Once logged, each set shows a **▲ / = / ▼** glyph for beat / met / missed versus its target.

### Bodyweight exercises

Bodyweight exercises (pull-ups, dips, etc.) have no weight axis — reps simply climb toward the ceiling, and (like the weighted path) a set you fall short on holds at the reps you logged. Once every set reaches the ceiling, a set is added (up to six).

---

## Tech stack

| Layer | Technology |
|---|---|
| Client | React 18, Vite, react-router-dom 6 (hash routing) |
| Database | SQLite compiled to WebAssembly ([sql.js](https://github.com/sql-js/sql.js)), persisted in IndexedDB |
| Offline | Service worker that precaches the whole app; web app manifest |
| Charts | Recharts |

**How it works:** there is no server. The app is a static bundle; the "backend" (`client/src/backend/`) is the same route logic the old Express server ran, executed in the browser against an in-memory SQLite database. After every change the database file is saved to IndexedDB on the device. The progression algorithm (`shared/algorithm.js`) is unchanged.

---

## Installing on your phone

The app must be served once over HTTPS so the phone can install it (see [Hosting](#hosting) — GitHub Pages is free and takes two minutes). After that it runs entirely from the device.

- **iPhone / iPad (Safari):** open the app URL → Share → **Add to Home Screen**.
- **Android (Chrome):** open the app URL → ⋮ menu → **Install app** (or accept the install banner).

Launch it from the home screen. Everything — logging, plans, stats, the recap — works in airplane mode.

### First run

1. Enter your name and pick an avatar glyph (or **Restore from a backup file**)
2. **Setup** → select the equipment you have access to
3. **Plans** → create a plan and choose training days (or activate the Sample Workout)
4. Open the plan → add exercises to each day → **Activate**
5. **Workout** — your first session is ready to log

### Moving over from the self-hosted server

If you ran an earlier (server-based) version, bring your history with you:

1. Stop the server so SQLite folds its write-ahead log into the main file (`docker compose stop`, or stop the systemd service)
2. Copy out `fitness.db` — with Docker: `docker compose cp app:/data/fitness.db ./fitness.db` (or `docker cp <container>:/data/fitness.db .`)
3. Get the file onto your phone (AirDrop, email, iCloud Drive, Google Drive…)
4. In the app: **Restore from a backup file** on the welcome screen, or **Setup → Data → Import backup**

If the database had several accounts you'll be asked which profile is yours. Passwords are no longer used.

---

## Hosting

`npm run build` produces a fully static site in `client/dist/` with relative paths, so it can be served from any static host, at any path. It only has to be reachable when you install the app or want to pick up an update.

**GitHub Pages (included):** the workflow in `.github/workflows/pages.yml` runs the tests, builds, and deploys on every push to `master`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The app is then at `https://<user>.github.io/<repo>/`.

**Anything else that serves static files over HTTPS** works too — Netlify, Cloudflare Pages, Vercel, an S3 bucket, or an existing nginx/Caddy box (no SPA rewrite rules needed; routing is hash-based).

Service workers require HTTPS (plain `http://localhost` is the only exception), so a LAN-only `http://` address can't be installed as an offline app.

---

## Development

Requires Node.js 20.19+.

```bash
npm run install:all      # installs client dependencies
npm run dev              # Vite dev server on http://localhost:5173 with hot reload
npm test                 # algorithm, recap, stats, hint and end-to-end backend tests
npm run build            # production bundle → client/dist (includes the service worker)
npm run preview          # serve the production build locally to test install/offline
```

The service worker is only registered in production builds, so use `npm run build && npm run preview` to test offline behaviour.

---

## Updating

Deploy a new build (with GitHub Pages: push to `master`). Installed copies check for a new version whenever they're opened while online, download it in the background, and show **"A new version is ready — tap to reload"**. You can also check manually from **Setup → App**. Database migrations run automatically on launch; your data is preserved.

---

## Data

All data lives in a SQLite database on your device (in the browser's IndexedDB storage for the app). It is **not** synced anywhere.

- **Back up:** Setup → Data → **Export backup** saves a `.db` file through the share sheet (phones) or as a download (desktop). Do this regularly — deleting the app or clearing the browser's site data deletes the database.
- **Restore / move devices:** Setup → Data → **Import backup** (replaces everything on the device).
- **Reset:** Stats → Reset all training data keeps a copy of the pre-reset database on the device, restorable from Setup → Data.
- **CSV exports** of history, sessions, personal bests and weekly volume are on the Stats page.

The exported file is a standard SQLite database — open it with any SQLite tool.
