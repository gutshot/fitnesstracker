import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../auth.jsx';
import { pickFile } from '../files.js';
import { BarbellLogo, GlyphPicker, field } from '../ui.jsx';

// First-run screen. Data lives on this device, so there's no login — just
// create a profile, restore a backup, or (for a database imported from the old
// multi-user server) pick which of its profiles is yours.
export default function AuthPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName]     = useState('');
  const [glyph, setGlyph]   = useState('🏋️');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  useEffect(() => { api.getUsers().then(setUsers).catch(() => setUsers([])); }, []);

  async function attempt(fn) {
    setError(''); setBusy(true);
    try { await fn(); }
    catch (err) { setError(err.message || 'Something went wrong — try again'); }
    finally { setBusy(false); }
  }

  function handleCreate(e) {
    e.preventDefault();
    attempt(async () => {
      setUser(await api.register({ name, glyph }));
      navigate('/setup');
    });
  }

  function handleRestore() {
    attempt(async () => {
      const bytes = await pickFile();
      if (!bytes) return;
      await api.importDatabase(bytes);
      const me = await api.getMe();
      if (me) setUser(me);
      else setUsers(await api.getUsers());
    });
  }

  const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const linkBtn    = { background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.9rem', padding: '0.75rem', minHeight: '44px', cursor: 'pointer', textDecoration: 'underline' };
  const showPicker = users?.length > 0 && !creating;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <BarbellLogo size={52} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em' }}>FitnessTrack</h1>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {users === null ? (
            <p style={{ padding: '1.5rem', margin: 0, color: 'var(--muted)' }}>Loading…</p>
          ) : showPicker ? (
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={labelStyle}>Which profile is yours?</span>
              {users.map(u => (
                <button key={u.id} disabled={busy} onClick={() => attempt(async () => setUser(await api.selectUser(u.id)))}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem', minHeight: '52px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.3rem' }}>{u.glyph}</span>
                  <span style={{ fontWeight: '600' }}>{u.name}</span>
                  <span style={{ color: 'var(--dim)', fontSize: '0.82rem' }}>@{u.username}</span>
                </button>
              ))}
              <button type="button" onClick={() => setCreating(true)} style={linkBtn}>Create a new profile instead</button>
            </div>
          ) : (
            <form onSubmit={handleCreate} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" style={field} required />
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Choose a glyph</label>
                <GlyphPicker value={glyph} onChange={setGlyph} />
              </div>

              <button type="submit" disabled={busy} style={{
                padding: '0.95rem', minHeight: '48px',
                background: 'var(--btn)', color: 'var(--btn-text)',
                border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '1rem',
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, marginTop: '0.25rem',
              }}>
                {busy ? '…' : 'Get started'}
              </button>
            </form>
          )}

          {error && (
            <p style={{ margin: '0 1.5rem 1rem', fontSize: '0.875rem', color: 'var(--danger)', background: '#2a1010', border: '1px solid #4a1a1a', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{error}</p>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <button type="button" onClick={handleRestore} disabled={busy} style={linkBtn}>Restore from a backup file</button>
        </div>
        <p style={{ textAlign: 'center', margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--dim)', lineHeight: 1.5 }}>
          Your data is stored only on this device.
        </p>
      </div>
    </div>
  );
}
