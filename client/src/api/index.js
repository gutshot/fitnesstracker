import {
  ready, handle, exportDatabase, importDatabase, getPreResetBackup, restorePreResetBackup,
} from '../backend/index.js';

// Requests are served in-process by the on-device backend (src/backend) —
// same paths and payloads the old HTTP API used, no network involved.
async function call(method, path, body) {
  await ready;
  const res = await handle(method, path, body);
  if (res.statusCode === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('No profile selected');
  }
  if (res.statusCode >= 400) throw new Error(res.body?.error ?? `${method} ${path} → ${res.statusCode}`);
  return res;
}

const req = async (method, path, body) => (await call(method, path, body)).body;

export const api = {
  // Sessions
  getSessionForSlot:  (planId, week, dow)  => req('GET', `/sessions/slot?plan_id=${planId}&week=${week}&dow=${dow}`),
  skipSession:       (id)       => req('POST',   `/sessions/${id}/skip`),
  unlockSession:     (id)       => req('POST',   `/sessions/${id}/unlock`),
  getSessionSets:    (id)       => req('GET',    `/sessions/${id}/sets`),
  logSet:            (id, body) => req('POST',   `/sessions/${id}/sets`, body),
  unlogSet:          (id, exerciseId, setNum) => req('DELETE', `/sessions/${id}/sets/${exerciseId}/${setNum}`),
  getRecap:          (id)       => req('GET',    `/sessions/${id}/recap`),

  // Schedule
  getScheduleToday:   ()              => req('GET', '/schedule/today'),
  getScheduleForDay:  (dow, week)     => req('GET', `/schedule/today?dow=${dow}${week != null ? `&week=${week}` : ''}`),
  getSchedule:        ()         => req('GET',    '/schedule'),
  addToSchedule:      (body)     => req('POST',   '/schedule', body),
  updateScheduleSlot: (id, body) => req('PATCH',  `/schedule/${id}`, body),
  removeFromSchedule: (id)       => req('DELETE', `/schedule/${id}`),

  // History
  getLoggedExercises: ()   => req('GET', '/sessions/history'),
  getExerciseHistory: (id) => req('GET', `/sessions/history?exercise_id=${id}`),

  // Plans
  getActivePlan:     ()              => req('GET',    '/plans/active'),
  getPlans:          ()              => req('GET',    '/plans'),
  createPlan:        (body)          => req('POST',   '/plans', body),
  getPlan:           (id)            => req('GET',    `/plans/${id}`),
  updatePlan:        (id, body)      => req('PATCH',  `/plans/${id}`, body),
  deletePlan:        (id)            => req('DELETE', `/plans/${id}`),
  activatePlan:      (id)            => req('POST',   `/plans/${id}/activate`),
  clonePlan:         (id, body)      => req('POST',   `/plans/${id}/clone`, body),
  updatePlanDays:    (id, days)      => req('PATCH',  `/plans/${id}/days`, { days }),
  getPlanCalendar:   (id)            => req('GET',    `/plans/${id}/calendar`),
  addToPlanSchedule: (id, body)      => req('POST',   `/plans/${id}/schedule`, body),
  updatePlanSlot:    (id, sid, body) => req('PATCH',  `/plans/${id}/schedule/${sid}`, body),
  removePlanSlot:    (id, sid)       => req('DELETE', `/plans/${id}/schedule/${sid}`),

  // Stats
  getStats:   (scope = 'all') => req('GET',  `/stats?scope=${scope}`),
  resetStats: ()              => req('POST', '/stats/reset'),
  // Returns { filename, csv }
  exportStats: async (type, scope) => {
    const res = await call('GET', `/stats/export?type=${type}&scope=${scope}`);
    const filename = res.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] ?? `${type}.csv`;
    return { filename, csv: res.body };
  },

  // Profile
  getMe:         ()       => req('GET',   '/auth/me'),
  getUsers:      ()       => req('GET',   '/auth/users'),
  selectUser:    (id)     => req('POST',  '/auth/select', { id }),
  register:      (body)   => req('POST',  '/auth/register', body),
  updateProfile: (body)   => req('PATCH', '/auth/me',       body),

  // Exercises
  getExercises:    (params = {}) => req('GET', `/exercises${params.user_equipment ? '?user_equipment=true' : ''}`),
  getCustomExercises: ()         => req('GET',    '/exercises?custom_only=true'),
  createExercise:  (body)        => req('POST',   '/exercises', body),
  updateExercise:  (id, body)    => req('PATCH',  `/exercises/${id}`, body),
  deleteExercise:  (id)          => req('DELETE', `/exercises/${id}`),
  getEquipment:    ()            => req('GET',    '/exercises/equipment'),
  addEquipment:    (equipment)   => req('POST',   '/exercises/equipment', { equipment }),
  removeEquipment: (name)        => req('DELETE', `/exercises/equipment/${encodeURIComponent(name)}`),

  // Device database backup / restore
  exportDatabase:        async () => { await ready; return exportDatabase(); },
  importDatabase:        async (bytes) => { await ready; return importDatabase(bytes); },
  getPreResetBackup:     async () => { await ready; return getPreResetBackup(); },
  restorePreResetBackup: async () => { await ready; return restorePreResetBackup(); },
};
