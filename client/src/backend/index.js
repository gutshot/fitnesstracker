// Browser entry for the backend: loads the SQLite WASM build, opens the
// on-device database, and exposes the request handler to the API layer.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { start } from './app.js';

export { handle, exportDatabase, importDatabase, getPreResetBackup, restorePreResetBackup } from './app.js';

// Ask the browser not to evict our storage under pressure (best effort).
navigator.storage?.persist?.().catch(() => {});

export const ready = initSqlJs({ locateFile: () => wasmUrl }).then(start);
