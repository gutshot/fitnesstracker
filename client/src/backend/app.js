// In-browser backend. Replaces the old Express server: the same route modules
// run against SQLite (sql.js/WASM) held in memory, and the database file image
// is written to IndexedDB after every request that changed anything.

import db, { migrate } from './db.js';
import { seed } from './seed.js';
import { dispatch } from './router.js';
import { normalizeDbImage } from './sqlite.js';
import { loadFile, saveFile } from './storage.js';
import authRouter, { currentUserId } from './routes/auth.js';
import exercisesRouter from './routes/exercises.js';
import scheduleRouter  from './routes/schedule.js';
import sessionsRouter  from './routes/sessions.js';
import plansRouter     from './routes/plans.js';
import statsRouter     from './routes/stats.js';

const DB_KEY = 'fitness.db';

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No profile' });
  next();
}

const mounts = [
  { prefix: '/auth',      router: authRouter },
  { prefix: '/exercises', router: exercisesRouter, middleware: [requireUser] },
  { prefix: '/schedule',  router: scheduleRouter,  middleware: [requireUser] },
  { prefix: '/sessions',  router: sessionsRouter,  middleware: [requireUser] },
  { prefix: '/plans',     router: plansRouter,     middleware: [requireUser] },
  { prefix: '/stats',     router: statsRouter,     middleware: [requireUser] },
];

let SQL = null;

function openImage(bytes) {
  db.attach(bytes ? new SQL.Database(bytes) : new SQL.Database());
  migrate();
  seed();
}

// Writes are chained so they land in order; a failed write doesn't block the
// next one (which carries the full, newer image anyway).
let writing = Promise.resolve();
function persist() {
  const bytes = db.export();
  db.dirty = false;
  writing = writing.catch(() => {}).then(() => saveFile(DB_KEY, bytes));
  return writing;
}

// Requests run one at a time, like the single-threaded server they replace —
// a handler that awaits (e.g. stats reset) can't interleave with another.
let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

export async function start(sqlJs) {
  SQL = sqlJs;
  const bytes = await loadFile(DB_KEY);
  openImage(bytes ?? null);
  await persist();
}

export function handle(method, path, body) {
  return serialized(async () => {
    db.dirty = false;
    const userId = currentUserId();
    let res;
    try {
      res = await dispatch(mounts, { method, path, body, user: userId ? { id: userId } : null });
    } catch (err) {
      console.error(`${method} ${path} failed:`, err);
      res = { statusCode: 500, headers: {}, body: { error: err.message } };
    }
    if (db.dirty) await persist();
    return res;
  });
}

// ── Backup / restore ──────────────────────────────────────────────────────────

export function exportDatabase() {
  return serialized(() => db.export());
}

// Replace the device database with an uploaded SQLite file — a backup from
// this app, or the fitness.db from the old self-hosted server. Migrations run
// on it, so any earlier schema version is brought up to date. On failure the
// current database is left untouched.
export function importDatabase(bytes) {
  return serialized(async () => {
    const image   = normalizeDbImage(bytes);
    const current = db.export();
    try {
      const probe = new SQL.Database(image);
      probe.exec('SELECT count(*) FROM sqlite_master');
      probe.close();
      openImage(image);
    } catch (err) {
      openImage(current);
      throw new Error(`Could not open that file: ${err.message}`);
    }
    // A single-user server database: adopt its only user automatically.
    if (!currentUserId()) {
      const users = db.prepare('SELECT id FROM users').all();
      if (users.length === 1)
        db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('local_user_id', ?)").run(String(users[0].id));
    }
    await persist();
  });
}

export async function getPreResetBackup() {
  const b = await loadFile('pre-reset-backup');
  return b ? { name: b.name } : null;
}

export async function restorePreResetBackup() {
  const b = await loadFile('pre-reset-backup');
  if (!b) throw new Error('No backup stored');
  await importDatabase(b.bytes);
}
