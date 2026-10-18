// End-to-end backend test — run with: node client/src/backend/backend.test.js
// Drives the in-browser backend through its request handler against a real
// SQLite (sql.js) database, in Node. IndexedDB is absent here, so storage.js
// falls back to memory — persistence is exercised through that same path.
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { start, handle, exportDatabase, importDatabase, getPreResetBackup, restorePreResetBackup } from './app.js';
import { loadFile } from './storage.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.stack}`); failed++; }
}

async function api(method, path, body, expect = [200, 201]) {
  const res = await handle(method, path, body);
  assert.ok([].concat(expect).includes(res.statusCode),
    `${method} ${path} → ${res.statusCode} ${JSON.stringify(res.body)}`);
  return res.body;
}

const SQL = await initSqlJs();
await start(SQL);

let plan, slot, today;

await test('no profile → /me is null and data routes are 401', async () => {
  assert.equal(await api('GET', '/auth/me'), null);
  await api('GET', '/plans', null, 401);
});

await test('register creates the local profile and claims the seeded plans', async () => {
  const me = await api('POST', '/auth/register', { name: 'Test Lifter', glyph: '💪' });
  assert.equal(me.name, 'Test Lifter');
  assert.equal(me.username, 'testlifter');
  assert.deepEqual(await api('GET', '/auth/me'), me);
  const plans = await api('GET', '/plans');
  plan = plans.find(p => p.name === 'Sample Workout');
  assert.ok(plan, 'sample plan claimed');
  assert.deepEqual(plan.days, [0, 1, 3, 4]);
});

await test('exercise library is seeded and named-parameter upserts work', async () => {
  const all = await api('GET', '/exercises');
  assert.ok(all.length > 70);
  const bench = all.find(e => e.name === 'Bench Press');
  await api('PATCH', `/exercises/${bench.id}`, { rep_min: 5, rep_max: 9, optimal_sets: 4 });
  const after = (await api('GET', '/exercises')).find(e => e.id === bench.id);
  assert.equal(after.rep_min, 5);
  assert.equal(after.rep_max, 9);
  assert.equal(after.optimal_sets, 4);
  await api('PATCH', `/exercises/${bench.id}`, { rep_min: 9, rep_max: 5 }, 400);
});

await test('activating a plan and opening the current slot creates a session', async () => {
  await api('POST', `/plans/${plan.id}/activate`);
  const cal = await api('GET', `/plans/${plan.id}/calendar`);
  assert.equal(cal.weeks.length, 4);
  assert.equal(cal.weeks[0].days[0].is_current, true);
  slot = await api('GET', `/sessions/slot?plan_id=${plan.id}&week=1&dow=0`);
  assert.equal(slot.is_current, true);
  assert.ok(slot.session.id);
  const locked = await api('GET', `/sessions/slot?plan_id=${plan.id}&week=1&dow=1`);
  assert.equal(locked.is_locked, true);
  assert.equal(locked.session, null);
});

await test('logging every set runs progression and completes the session', async () => {
  today = await api('GET', '/schedule/today?dow=0&week=1');
  assert.equal(today.length, 5);
  const fly = today.find(e => e.name === 'Incline Dumbbell Fly');
  assert.equal(fly.sets[0].weight, 36);
  for (const ex of today) {
    for (const s of ex.sets) {
      await api('POST', `/sessions/${slot.session.id}/sets`, {
        exercise_id: ex.exercise_id, set_num: s.set_num,
        weight_used: s.weight ?? 20, reps_done: s.reps,
      });
    }
  }
  const sess = await api('GET', `/sessions/slot?plan_id=${plan.id}&week=1&dow=0`);
  assert.equal(sess.session.checked_in, 1);
  assert.ok(sess.session.date, 'session date stamped');
  // Next instance of the day picks up the algorithm's +1 rep target.
  const next = await api('GET', '/schedule/today?dow=0&week=2');
  const nextFly = next.find(e => e.name === 'Incline Dumbbell Fly');
  assert.equal(nextFly.sets[0].reps, fly.sets[0].reps + 1);
  assert.equal(nextFly.sets[0].weight, 36);
  const cal = await api('GET', `/plans/${plan.id}/calendar`);
  assert.equal(cal.weeks[0].days[1].is_current, true);
});

await test('recap compares against the session', async () => {
  const recap = await api('GET', `/sessions/${slot.session.id}/recap`);
  assert.equal(recap.comparison, 'baseline');
  assert.equal(recap.exercises.length, 5);
});

await test('un-logging a set reopens the session; unlock clears next targets', async () => {
  const ex = today[0];
  await api('DELETE', `/sessions/${slot.session.id}/sets/${ex.exercise_id}/1`);
  let sess = await api('GET', `/sessions/slot?plan_id=${plan.id}&week=1&dow=0`);
  assert.equal(sess.session.checked_in, 0);
  await api('POST', `/sessions/${slot.session.id}/sets`, {
    exercise_id: ex.exercise_id, set_num: 1, weight_used: ex.sets[0].weight ?? 20, reps_done: ex.sets[0].reps,
  });
  await api('POST', `/sessions/${slot.session.id}/unlock`);
  sess = await api('GET', `/sessions/slot?plan_id=${plan.id}&week=1&dow=0`);
  assert.equal(sess.session.unlocked, 1);
  assert.equal(sess.is_current, true);
});

await test('every write is persisted to storage', async () => {
  const stored = await loadFile('fitness.db');
  const probe = new SQL.Database(stored);
  const n = probe.exec('SELECT COUNT(*) FROM logged_sets')[0].values[0][0];
  probe.close();
  assert.ok(n >= 10, `logged_sets persisted (${n})`);
});

await test('stats + CSV export', async () => {
  const stats = await api('GET', '/stats?scope=all');
  assert.equal(stats.overview.total_workouts, 1);
  const res = await handle('GET', '/stats/export?type=sessions&scope=all');
  assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
  assert.match(res.headers['content-disposition'], /sessions\.csv/);
  assert.match(res.body, /^date,plan,week,day/);
});

await test('backup export → import round-trips, including a WAL-mode server file', async () => {
  const bytes = await exportDatabase();
  const wal = new Uint8Array(bytes); wal[18] = 2; wal[19] = 2;
  await importDatabase(wal);
  assert.equal((await api('GET', '/auth/me')).name, 'Test Lifter');
  assert.equal((await api('GET', '/stats?scope=all')).overview.total_workouts, 1);
  await assert.rejects(importDatabase(new Uint8Array(100)), /Not a SQLite database/);
  assert.equal((await api('GET', '/auth/me')).name, 'Test Lifter', 'failed import leaves data intact');
});

await test('imported multi-user server database lets the owner pick a profile', async () => {
  const bytes = await exportDatabase();
  const db = new SQL.Database(bytes);
  db.exec("INSERT INTO users (username, name, password_hash) VALUES ('other', 'Other', 'x')");
  db.exec("DELETE FROM config WHERE key = 'local_user_id'");
  const image = db.export(); db.close();
  await importDatabase(image);
  assert.equal(await api('GET', '/auth/me'), null);
  const users = await api('GET', '/auth/users');
  assert.equal(users.length, 2);
  await api('POST', '/auth/select', { id: users[0].id });
  assert.equal((await api('GET', '/auth/me')).name, 'Test Lifter');
});

await test('reset keeps a restorable pre-reset backup', async () => {
  await api('POST', '/stats/reset');
  assert.equal((await api('GET', '/stats?scope=all')).overview.total_workouts, 0);
  assert.match((await getPreResetBackup()).name, /^fitness-backup-.*\.db$/);
  await restorePreResetBackup();
  assert.equal((await api('GET', '/stats?scope=all')).overview.total_workouts, 1);
});

await test('reopening from storage restores the same data', async () => {
  await start(SQL);
  assert.equal((await api('GET', '/auth/me')).name, 'Test Lifter');
  assert.equal((await api('GET', '/stats?scope=all')).overview.total_workouts, 1);
});

console.log('');
if (failed === 0) console.log(`All ${passed} tests passed.`);
else { console.log(`${passed} passed, ${failed} FAILED.`); process.exit(1); }
