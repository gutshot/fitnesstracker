# FitnessTrack — Claude context

Progressive overload fitness tracker. **Offline-first PWA with no server**: React 18 + Vite, with the "backend" running in the browser against SQLite compiled to WASM (sql.js), persisted to IndexedDB. One local profile per device (the schema keeps `user_id` columns; a DB imported from the old multi-user server can hold several users).

## Stack

- **App**: React 18, Vite, react-router-dom **HashRouter** (static hosting at any path, no SPA fallback). `base: './'`
- **Backend (in-browser)**: `client/src/backend/` — the former Express routes, unchanged in shape, run in-process via a tiny Express-style router. `api/index.js` calls `handle(method, path, body)` instead of `fetch`
- **Database**: sql.js (SQLite WASM). `backend/sqlite.js` is a **better-sqlite3-compatible facade** (`prepare().get/all/run`, `transaction()`, `pragma()`, named `@params` from plain objects) — write backend code exactly as you would for better-sqlite3. The DB file image is saved to IndexedDB (`backend/storage.js`) after every request that wrote anything
- **Offline**: `client/vite-plugin-sw.js` generates `dist/sw.js` from `client/sw-template.js` with a content-hashed precache list; `src/pwa.js` registers it (prod builds only) and drives the "new version — reload" flow
- **Shared logic**: `shared/algorithm.js` — pure functions, imported by the backend and the UI

## Key commands

```bash
npm run install:all    # client deps (Node 20.19+; locally use ~/.nvm/versions/node/v22.12.0)
npm run dev            # Vite on :5173 (no service worker in dev)
npm test               # all suites incl. client/src/backend/backend.test.js (end-to-end, runs sql.js in Node)
npm run build          # client/dist — static site + sw.js
npm run preview        # serve the build to test install/offline
npm run icons          # regenerate PNG icons from the barbell geometry
```

Deploy: `.github/workflows/pages.yml` builds + publishes `client/dist` to GitHub Pages on push to master.

## Project structure

```
shared/
  algorithm.js               # double-progression logic — edit here for algorithm changes
  recap.js                   # recap verdict helpers
  slotDone.js                # shared slot-completion predicate
client/
  vite.config.js             # base './', __APP_VERSION__ (from root package.json), SW plugin
  vite-plugin-sw.js, sw-template.js   # service worker generation
  scripts/make-icons.mjs     # dependency-free PNG icon renderer
  public/                    # manifest.webmanifest, icons
  src/
    backend/
      index.js               # browser entry: loads WASM, opens DB (exports ready/handle/backup fns)
      app.js                 # mounts routers, serializes requests, persists, import/export/restore
      sqlite.js              # better-sqlite3 facade over sql.js + WAL-header normalisation for imports
      router.js              # Express-style Router/dispatch
      storage.js             # IndexedDB file store (in-memory fallback for Node tests)
      db.js                  # schema + column migrations — migrate() runs on every open/import
      seed.js                # exercise library seed data + sample plan (runs on every open)
      setCounts.js, statsWeeks.js
      routes/
        auth.js              # local profiles: me, users, select, register, PATCH me (no passwords)
        exercises.js, schedule.js, plans.js, sessions.js, stats.js
    api/index.js             # all API wrappers — add new endpoints here first
    files.js                 # saveFile (share sheet on phones / download) + pickFile
    pwa.js                   # SW registration + useAppUpdate/checkForUpdate/applyUpdate
    App.jsx, auth.jsx, units.js, progressionHint.js, ui.jsx
    components/ExerciseEditModal.jsx, WorkoutRecap.jsx
    pages/
      TodayPage.jsx          # main workout logging screen
      PlansPage.jsx, PlanDetailPage.jsx, StatsPage.jsx, ProfilePage.jsx
      AuthPage.jsx           # first-run: create profile / restore backup / pick imported profile
      stubs.jsx              # SetupPage: equipment, units, custom exercises, Data (backup), App (version/update)
```

## Database schema (key tables)

- `users` — local profiles (`password_hash` is '' — legacy column); the active profile id is `config.local_user_id`
- `exercises` — exercise library; `muscle_group`, `equipment`, `default_increment`, `rep_min`/`rep_max` (per-exercise rep range), `is_custom`
- `workout_plans` — named plans per user; `is_active` (one active at a time), `week_count`, `started_at`
- `plan_days` — which days of week (0=Mon…6=Sun) belong to a plan
- `schedule` — exercises per plan per day; `set_count` (a live mirror of the latest `set_counts` value), `position` for ordering
- `set_counts` — date-versioned set count per `(plan_id, day_of_week, exercise_id)`; append-only, `valid_from`. The effective count for a session is the latest row valid as of the session's date. A manual +/− set records `valid_from = today`; an algorithm-appended set records `valid_from = session.date + 1`. Resolve via `effectiveSetCount()` in `client/src/backend/setCounts.js` — never read `schedule.set_count` directly for a session
- `set_targets` — target weight + reps per exercise per set; `valid_from` date + `plan_id`; the algorithm writes a new row per completed exercise. `is_suggestion` is a legacy flag (no longer written)
- `sessions` — identified by `(plan_id, week_num, session_dow, user_id)` UNIQUE; `checked_in` (= "complete"), `unlocked` flags
- `logged_sets` — actual logged weight/reps per set; `skipped` flag; `reps_done` NULL when skipped

## Important conventions

- `day_of_week` is **0=Monday … 6=Sunday** throughout (not JS convention where 0=Sunday)
- Logging a set re-runs progression for that exercise: the backend writes the next-session `set_targets` rows with `valid_from = session.date + 1 day`
- `set_targets` and `set_counts` are append-only — never update, always insert a new row
- Set-count changes propagate forward only: a completed session always resolves to the count it had, never one added later
- Sessions are position-based (week_num, session_dow), not date-based
- `slotDone(s)` — the key predicate used in `sessions.js` and `plans.js`: `s && !s.unlocked && (s.checked_in === 1 || (s.expected_sets > 0 && s.done_sets >= s.expected_sets))`. **All callers must use identical logic** or the current-slot calculation diverges.

## Algorithm (shared/algorithm.js)

**Dynamic double progression** — purely performance-based, no subjective check-ins.

`nextExerciseTargets(setData, { repMin, repMax, increment, equipment, pauseWeight, weightCapKg, tempo })` — takes all sets for one exercise, returns next per-set targets. Each `setData` element may also carry `priorFloorMiss` (set was already sub-floor last session). It is **pure**; all history-derived signals are computed by the caller (`recomputeExercise`).

Each set is its own progression track, comparing the user's actual logged reps to the target they were given:

| Condition | Next target |
|-----------|-------------|
| `actual ≥ repMax` | weight + increment, reps → `repMin` |
| `target ≤ actual < repMax` | reps → `min(repMax, actual + step)`, weight unchanged (`step` = 2 under `fast` tempo, else 1) |
| `repMin ≤ actual < target` | hold: same weight, reps → `actual` (the logged reps — must be beaten before the target advances) |
| `actual < repMin` | ease off **only on the 2nd consecutive** sub-floor session (`priorFloorMiss`); a single bad day holds the weight, reps → `repMin` |
| skipped / unlogged | unchanged |

- Per-set independence gives the "dynamic" pattern, but a **descending-weight clamp** keeps the profile coherent: no set is prescribed heavier than the set before it. A set that earns a bump an earlier (lighter) set hasn't yet parks at `repMax` and waits — the limiting set gates the load increase.
- `increment` is the exercise's `default_increment` **scaled by the tempo factor** (fast ×1.5, slow ×0.5), then capped at 10% of working weight; weights round to 0.5 kg.
- Rep range `[repMin, repMax]` is per exercise (`exercises.rep_min/rep_max`), overridable per user via `user_exercise_settings`.
- **Adaptive tempo** (`opts.tempo`, computed in `recomputeExercise` from the last two completed sessions' volume ratio `logged/target`): two straight beats → `fast` (climb +2, larger increment); two straight shortfalls → `slow` (micro-increment); else `normal`. Bodyweight is always `normal`. Purely objective — no subjective input.
- **Bodyweight**: reps-only axis; reps climb toward `repMax` and hold there — a set short of its target holds at its logged reps (same rule as weighted). When every set reaches `repMax`, `recomputeExercise` adds a set (cap 6).
- **Pause weight increases (weight cap)** — `user_exercise_settings.pause_weight=1` + `pause_cap_kg` (the heaviest set when paused). Weighted progression runs normally but the per-set weight bump is clamped to the cap (`weightCapKg`); a set pinned at the cap holds at `repMax` instead of resetting reps. `recomputeExercise` adds a set only when every set is pinned at the cap *and* the rep ceiling. A legacy paused row with `pause_cap_kg` NULL keeps the old reps-only freeze (bodyweight stays reps-only too). Activation never rewrites existing per-set weights.
- `setPerformance(targetReps, actualReps)` → `'up' | 'met' | 'down'` for the UI's per-set glyph.
- **Weight-deviation re-targeting** — `weightAdjustedTarget(target, actualWeight, {repMin,repMax})`. When the logged/entered weight differs from the target's, the rep target is re-scaled to roughly preserve volume (`round(targetReps × targetWeight / actualWeight)`, clamped to the rep range). Within a ±15% band (`WEIGHT_BAND`) this adjusted target drives the hold-vs-climb decision and the UI glyph; beyond it `{inBand:false}` — the client shows `?` and suppresses the glyph, and progression climbs target-free from the logged performance. The client (`TodayPage` `SetRow`) re-evaluates on weight-cell blur.

## Session lifecycle

1. User navigates to a slot (week_num, session_dow) via the TodayPage calendar.
2. Slot endpoint (`GET /sessions/slot`) finds or creates the session; returns `is_current` + `is_locked`.
3. User logs sets via SetRow components → `POST /sessions/:id/sets` (upserts). `DELETE` un-logs.
4. **On every set change** the backend runs `recomputeExercise`: when an exercise's sets are all logged/skipped it writes the next session's `set_targets`; when no longer complete it deletes them. `updateCompletion` sets `checked_in` when the whole day's schedule is logged/skipped. No modal, no check-in.
5. The client derives `allDone` from set statuses; a completion effect refreshes the calendar and may surface the end-of-plan modal.
6. **Unlock**: a completed session can be unlocked (`POST /sessions/:id/unlock`) — deletes the next-day targets, sets `unlocked=1, checked_in=0`. It re-becomes "current". Re-logging re-runs progression.

## Known subtleties

- `recomputeExercise` and `updateCompletion` run inside the `POST/DELETE /sessions/:id/sets` transaction — set logging and target recomputation commit atomically.
- Backend requests are serialized (one at a time) and the DB is persisted before the API promise resolves. sql.js `export()` reopens the connection — the facade drops its statement cache and re-enables `foreign_keys`; never call it inside a transaction.
- Dates use SQLite `date('now')` / `toISOString()` — UTC, same as the server era.
- Multiple open tabs each hold their own in-memory DB; the last one to write wins.
- The progressive-overload hint (target vs last logged performance) shows only on *in-progress* exercise cards; per-set ▲/=/▼ glyphs show actual vs target on logged sets.
- New exercises start with an empty weight and reps at `rep_min` — there is no starting-weight prompt; the algorithm bootstraps from the first logged session.
- Old `is_suggestion` rows in `set_targets` are still sorted (`ORDER BY is_suggestion ASC`) but nothing writes them anymore.
- App updates are service-worker based: a new deploy installs and waits; `applyUpdate()` posts `SKIP_WAITING` and reloads on `controllerchange`.
