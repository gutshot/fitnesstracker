import { useEffect, useState } from 'react';

// Service-worker registration + update flow. The worker (generated at build
// time, see vite-plugin-sw.js) precaches the whole app so it runs offline.
// A new deploy installs alongside the running version and waits; the UI
// offers a reload, which tells the waiting worker to take over.

let registration = null;
const listeners  = new Set();
let state        = 'idle';   // idle | checking | latest | ready | unsupported

function setState(s) { state = s; listeners.forEach(fn => fn(s)); }

function watch(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) setState('ready');
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    sw?.addEventListener('statechange', () => {
      // "installed" with an existing controller = an update is waiting.
      if (sw.state === 'installed' && navigator.serviceWorker.controller) setState('ready');
    });
  });
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) { setState('unsupported'); return; }
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('./sw.js');
      watch(registration);
      // Check for a new deploy whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      setState('unsupported');
    }
  });
}

export async function checkForUpdate() {
  if (!registration) return;
  setState('checking');
  try {
    await registration.update();
    // A found update reports 'ready' via the statechange listener once it has
    // finished installing; give it a moment before declaring "latest".
    if (registration.installing) {
      await new Promise(resolve => {
        const sw = registration.installing;
        sw.addEventListener('statechange', () => { if (sw.state !== 'installing') resolve(); });
      });
    }
    setState(registration.waiting ? 'ready' : 'latest');
  } catch {
    setState('latest');   // offline — nothing to fetch
  }
}

export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) { window.location.reload(); return; }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage('SKIP_WAITING');
}

export function useAppUpdate() {
  const [s, set] = useState(state);
  useEffect(() => { listeners.add(set); return () => listeners.delete(set); }, []);
  return s;
}
