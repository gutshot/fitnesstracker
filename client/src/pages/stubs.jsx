import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { useUnit } from '../units.js';
import { ExerciseEditModal } from '../components/ExerciseEditModal.jsx';
import { saveFile, pickFile } from '../files.js';
import { useAppUpdate, checkForUpdate, applyUpdate } from '../pwa.js';

const ALL_EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

// ── Setup Page ────────────────────────────────────────────────────────────────

export function SetupPage() {
  const [saved, setSaved]         = useState(new Set());
  const [customs, setCustoms]     = useState([]);
  const [editTarget, setEdit]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const { unit, toggle }          = useUnit();
  const update                    = useAppUpdate();

  useEffect(() => {
    Promise.all([api.getEquipment(), api.getCustomExercises()])
      .then(([eqList, exList]) => {
        setSaved(new Set(eqList));
        setCustoms(exList);
        setLoading(false);
      });
  }, []);

  async function handleToggle(eq) {
    if (saved.has(eq)) {
      await api.removeEquipment(eq);
      setSaved(s => { const n = new Set(s); n.delete(eq); return n; });
    } else {
      await api.addEquipment(eq);
      setSaved(s => new Set(s).add(eq));
    }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;

  return (
    <div>
      <h2 style={{ marginTop: 0, color: 'var(--text)' }}>Setup</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Your equipment</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
          Only exercises matching your equipment will show in the Schedule picker.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ALL_EQUIPMENT.map(eq => (
            <label key={eq} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.85rem', minHeight: '52px', border: '1px solid var(--border)', borderRadius: '10px', background: saved.has(eq) ? 'var(--checked-bg)' : 'var(--surface)' }}>
              <input
                type="checkbox"
                checked={saved.has(eq)}
                onChange={() => handleToggle(eq)}
                style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--success)', flexShrink: 0 }}
              />
              <span style={{ textTransform: 'capitalize', fontWeight: saved.has(eq) ? '600' : '500', fontSize: '0.95rem', color: 'var(--text)' }}>{eq}</span>
              {saved.has(eq) && <span style={{ marginLeft: 'auto', color: 'var(--success)', fontSize: '0.95rem' }}>✓</span>}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Weight units</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['kg', 'lbs'].map(u => (
            <button key={u} onClick={() => unit !== u && toggle()}
              style={{ padding: '0.7rem 1.5rem', minHeight: '44px', border: '1px solid var(--border)', borderRadius: '8px', background: unit === u ? 'var(--btn)' : 'var(--surface)', color: unit === u ? 'var(--btn-text)' : 'var(--text)', fontSize: '0.95rem', fontWeight: unit === u ? '600' : '500', cursor: 'pointer' }}>
              {u}
            </button>
          ))}
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Custom exercises</h3>
        {customs.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No custom exercises yet. Create one from the Schedule exercise picker.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {customs.map(ex => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.85rem', minHeight: '52px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: '500', fontSize: '0.95rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                  <span style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--dim)' }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: `var(--mc-${ex.muscle_group}, var(--muted))` }}>{ex.muscle_group}</span>
                    <span>·</span>
                    <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{ex.equipment}</span>
                  </span>
                </div>
                <button onClick={() => setEdit(ex)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.82rem', padding: '0.5rem 0.75rem', minHeight: '40px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                <button onClick={async () => { await api.deleteExercise(ex.id); setCustoms(c => c.filter(e => e.id !== ex.id)); }}
                  aria-label="Remove custom exercise"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '1.1rem', cursor: 'pointer', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '6px' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <DataSection />

      <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text)' }}>App</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Version <strong style={{ color: 'var(--text)' }}>{__APP_VERSION__}</strong>
        </p>

        {update === 'ready' ? (
          <button onClick={applyUpdate} style={primaryBtn}>Update available — reload</button>
        ) : update === 'unsupported' ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dim)' }}>Offline install and updates are available in the built app.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <button onClick={checkForUpdate} disabled={update === 'checking'} style={secondaryBtn}>
              {update === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
            {update === 'latest' && <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>You're on the latest version.</span>}
          </div>
        )}
      </section>

      {editTarget && (
        <ExerciseEditModal
          exercise={editTarget}
          onSaved={() => { api.getCustomExercises().then(setCustoms); setEdit(null); }}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}


// ── Data: backup / restore of the on-device database ─────────────────────────

const primaryBtn   = { padding: '0.85rem 1.4rem', minHeight: '46px', background: 'var(--btn)', color: 'var(--btn-text)', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' };
const secondaryBtn = { padding: '0.7rem 1.1rem', minHeight: '44px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' };

function DataSection() {
  const [busy, setBusy]           = useState(null);   // 'export' | 'import' | 'restore'
  const [message, setMessage]     = useState(null);   // { ok, text } — errors only
  const [confirmImport, setConfirm] = useState(null); // bytes awaiting confirmation
  const [preReset, setPreReset]   = useState(null);

  useEffect(() => { api.getPreResetBackup().then(setPreReset); }, []);

  async function handleExport() {
    setBusy('export'); setMessage(null);
    try {
      const bytes = await api.exportDatabase();
      const ts = new Date().toISOString().slice(0, 10);
      await saveFile(bytes, `fitnesstrack-${ts}.db`, 'application/x-sqlite3');
    } catch (e) {
      setMessage({ ok: false, text: e.message });
    } finally { setBusy(null); }
  }

  async function handlePick() {
    setMessage(null);
    const bytes = await pickFile();
    if (bytes) setConfirm(bytes);
  }

  // Import/restore swap the whole database (already persisted when fn
  // resolves), so reload the app rather than patch every page's state.
  async function run(kind, fn) {
    setBusy(kind); setMessage(null);
    try {
      await fn();
      window.location.reload();
    } catch (e) {
      setMessage({ ok: false, text: e.message });
      setBusy(null);
    }
  }

  return (
    <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem', marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Data</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
        Your training data is stored only on this device. Export a backup regularly — it's
        the only copy if the app is removed or the browser's data is cleared. Import also
        accepts the <code>fitness.db</code> from the old self-hosted server.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleExport} disabled={busy !== null} style={secondaryBtn}>
          {busy === 'export' ? 'Exporting…' : 'Export backup'}
        </button>
        <button onClick={handlePick} disabled={busy !== null} style={secondaryBtn}>
          {busy === 'import' ? 'Importing…' : 'Import backup'}
        </button>
        {preReset && (
          <button disabled={busy !== null} style={secondaryBtn}
            onClick={() => run('restore', api.restorePreResetBackup)}>
            {busy === 'restore' ? 'Restoring…' : 'Restore pre-reset backup'}
          </button>
        )}
      </div>

      {confirmImport && (
        <div style={{ marginTop: '1rem', padding: '0.85rem', border: '1px solid #4a1a1a', background: '#2a1010', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.5 }}>
            Replace <strong>all</strong> data on this device with the selected file? Export a backup first if you might need the current data.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setConfirm(null)} style={secondaryBtn}>Cancel</button>
            <button style={{ ...primaryBtn, background: '#c0392b', color: '#fff' }}
              onClick={() => { const b = confirmImport; setConfirm(null); run('import', () => api.importDatabase(b)); }}>
              Replace data
            </button>
          </div>
        </div>
      )}

      {message && (
        <p style={{ margin: '0.85rem 0 0', fontSize: '0.875rem', color: message.ok ? 'var(--success)' : 'var(--danger)' }}>{message.text}</p>
      )}
    </section>
  );
}
