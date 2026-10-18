import { Router } from '../router.js';
import db from '../db.js';

// Local profiles. The database lives on the device, so there are no passwords
// or sessions — the active profile is simply recorded in `config`. A database
// imported from the old multi-user server may hold several users; the
// /users + /select pair lets the device owner pick which one is theirs.

const router = Router();

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, glyph: u.glyph };
}

export function currentUserId() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'local_user_id'").get();
  if (!row) return null;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(row.value));
  return user?.id ?? null;
}

function setCurrentUser(id) {
  db.prepare("INSERT INTO config (key, value) VALUES ('local_user_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(String(id));
}

// Returns the active profile, or null when none is chosen yet
router.get('/me', (req, res) => {
  const id = currentUserId();
  res.json(id ? publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) : null);
});

router.get('/users', (_req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser));
});

router.post('/select', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.body.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  setCurrentUser(user.id);
  res.json(publicUser(user));
});

router.post('/register', (req, res) => {
  const { name, glyph } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'me';
  let username = base;
  for (let n = 2; db.prepare('SELECT 1 FROM users WHERE username = ?').get(username); n++)
    username = `${base}${n}`;

  const userId = db.transaction(() => {
    const { lastInsertRowid: id } = db.prepare(
      "INSERT INTO users (username, name, glyph, password_hash) VALUES (?, ?, ?, '')"
    ).run(username, name.trim(), glyph || '🏋️');
    // Claim any pre-existing unclaimed plans and sessions (sample plan, migrations)
    db.prepare('UPDATE workout_plans SET user_id = ? WHERE user_id IS NULL').run(id);
    db.prepare('UPDATE sessions SET user_id = ? WHERE user_id IS NULL').run(id);
    setCurrentUser(id);
    return id;
  })();

  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)));
});

router.patch('/me', (req, res) => {
  const id = currentUserId();
  if (!id) return res.status(401).json({ error: 'No profile' });
  const { name, glyph } = req.body;
  const updates = {};
  if (name?.trim()) updates.name  = name.trim();
  if (glyph)        updates.glyph = glyph;
  if (Object.keys(updates).length) {
    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

export default router;
