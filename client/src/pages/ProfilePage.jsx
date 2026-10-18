import { useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../auth.jsx';
import { GlyphPicker, field } from '../ui.jsx';

const label = {
  display: 'block', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem',
  fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em',
};

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name,      setName]      = useState(user?.name  ?? '');
  const [glyph,     setGlyph]     = useState(user?.glyph ?? '🏋️');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setSuccess('');

    const body = {};
    if (name.trim() !== user.name) body.name  = name.trim();
    if (glyph !== user.glyph)      body.glyph = glyph;

    if (!Object.keys(body).length) { setSuccess('Nothing to update.'); return; }

    setSaving(true);
    try {
      const updated = await api.updateProfile(body);
      setUser(updated);
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.message || 'Something went wrong — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text)' }}>Profile</h2>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '420px' }}>

        {/* Avatar */}
        <div>
          <span style={label}>Avatar</span>
          <GlyphPicker value={glyph} onChange={setGlyph} />
        </div>

        {/* Display name */}
        <div>
          <label style={label}>Display name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={field} required />
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--danger)', background: '#2a1010', border: '1px solid #4a1a1a', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{error}</p>
        )}
        {success && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--success)', background: '#0e2a0e', border: '1px solid #1a4a1a', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{success}</p>
        )}

        <button type="submit" disabled={saving} style={{
          padding: '0.95rem', minHeight: '48px',
          background: 'var(--btn)', color: 'var(--btn-text)',
          border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '1rem',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
