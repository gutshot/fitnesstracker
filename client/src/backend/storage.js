// Durable on-device storage for database file images, backed by IndexedDB.
// Falls back to an in-memory map where IndexedDB doesn't exist (Node tests).

const DB_NAME = 'fitnesstrack';
const STORE   = 'files';

const memory = new Map();
let opening  = null;

function open() {
  if (typeof indexedDB === 'undefined') return null;
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return opening;
}

function tx(mode, fn) {
  return open().then(idb => new Promise((resolve, reject) => {
    const t   = idb.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror    = () => reject(t.error);
    t.onabort    = () => reject(t.error);
  }));
}

export async function loadFile(key) {
  if (!open()) return memory.get(key);
  return tx('readonly', s => s.get(key));
}

export async function saveFile(key, value) {
  if (!open()) { memory.set(key, value); return; }
  await tx('readwrite', s => s.put(value, key));
}

export async function deleteFile(key) {
  if (!open()) { memory.delete(key); return; }
  await tx('readwrite', s => s.delete(key));
}
