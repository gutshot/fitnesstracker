// better-sqlite3-compatible facade over sql.js (SQLite compiled to WASM).
//
// The backend modules were written against better-sqlite3's synchronous API
// (prepare().get/all/run, transaction(), pragma()). This facade exposes that
// same surface on top of an in-memory sql.js Database so they run in the
// browser unchanged. The underlying database can be swapped at runtime
// (attach) — e.g. when the user imports a backup — so prepared statements are
// resolved lazily per call from a cache keyed by SQL text and keyed to the
// currently attached database.

function bindable(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

// better-sqlite3 binds named parameters from a plain object whose keys omit
// the sigil (`{ ex: 1 }` for `@ex`); sql.js wants the sigil in the key.
function toParams(args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])
      && !(args[0] instanceof Uint8Array)) {
    const out = {};
    for (const [k, v] of Object.entries(args[0])) {
      const b = bindable(v);
      out[`@${k}`] = b; out[`:${k}`] = b; out[`$${k}`] = b;
    }
    return out;
  }
  return args.map(bindable);
}

class Statement {
  constructor(facade, sql) {
    this.facade = facade;
    this.sql    = sql;
  }

  _stmt() { return this.facade._statement(this.sql); }

  get(...args) {
    const st = this._stmt();
    try {
      st.bind(toParams(args));
      return st.step() ? st.getAsObject() : undefined;
    } finally {
      st.reset();
    }
  }

  all(...args) {
    const st = this._stmt();
    const rows = [];
    try {
      st.bind(toParams(args));
      while (st.step()) rows.push(st.getAsObject());
    } finally {
      st.reset();
    }
    return rows;
  }

  run(...args) {
    this.facade.dirty = true;
    const st = this._stmt();
    try {
      st.bind(toParams(args));
      st.step();
    } finally {
      st.reset();
    }
    const raw = this.facade.raw;
    return {
      changes:         raw.getRowsModified(),
      lastInsertRowid: raw.exec('SELECT last_insert_rowid()')[0].values[0][0],
    };
  }
}

export class Database {
  constructor() {
    this.raw    = null;
    this.cache  = new Map();
    this.depth  = 0;          // transaction nesting depth
    this.dirty  = false;      // set by any write; cleared by the persistence layer
  }

  // Point the facade at a (new) sql.js Database instance.
  attach(rawDb) {
    this.close();
    this.raw = rawDb;
    this.raw.exec('PRAGMA foreign_keys = ON');
  }

  close() {
    for (const st of this.cache.values()) { try { st.free(); } catch { /* already freed */ } }
    this.cache.clear();
    if (this.raw) { try { this.raw.close(); } catch { /* ignore */ } }
    this.raw = null;
  }

  _statement(sql) {
    if (!this.raw) throw new Error('Database not open');
    let st = this.cache.get(sql);
    if (!st) { st = this.raw.prepare(sql); this.cache.set(sql, st); }
    return st;
  }

  prepare(sql) { return new Statement(this, sql); }

  exec(sql) { this.dirty = true; this.raw.exec(sql); return this; }

  pragma(str) {
    const res = this.raw.exec(`PRAGMA ${str}`);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
  }

  // Same contract as better-sqlite3: returns a function that runs `fn` inside
  // a transaction, committing on return and rolling back on throw. Nested
  // calls use savepoints.
  transaction(fn) {
    return (...args) => {
      const sp = `sp${this.depth}`;
      this.raw.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      this.depth++;
      try {
        const result = fn(...args);
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        return result;
      } catch (err) {
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw err;
      }
    };
  }

  // Serialize the database to a SQLite file image. sql.js closes and reopens
  // the connection to do this, which frees every prepared statement and resets
  // pragmas — so the cache is dropped and foreign keys re-enabled afterwards.
  export() {
    const bytes = this.raw.export();
    this.cache.clear();
    this.raw.exec('PRAGMA foreign_keys = ON');
    return bytes;
  }
}

// A database file written by a server running in WAL mode carries format
// bytes 18–19 = 2, which an in-memory SQLite can't open. Rewriting them to 1
// (legacy rollback journal) is the standard, lossless way to load it — the
// caller must have checkpointed the WAL first (stopping the server does).
export function normalizeDbImage(bytes) {
  const header = new TextDecoder().decode(bytes.subarray(0, 15));
  if (header !== 'SQLite format 3') throw new Error('Not a SQLite database file');
  const out = new Uint8Array(bytes);
  if (out[18] === 2) out[18] = 1;
  if (out[19] === 2) out[19] = 1;
  return out;
}
