import React, { useEffect, useState } from 'react';
import { updateMe } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ displayName: '', phoneNumber: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? '',
        phoneNumber: profile.phoneNumber ?? '',
      });
    }
  }, [profile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      // Backend field is `phoneNumber`; displayName must be 2+ chars, so omit it when blank.
      const payload = { phoneNumber: form.phoneNumber.trim() };
      if (form.displayName.trim()) payload.displayName = form.displayName.trim();
      await updateMe(payload);
      // The save succeeded; a failed re-read only leaves the old values on screen.
      await refreshProfile().catch((e) => console.warn('Profile refresh failed:', e?.message));
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message ?? 'Update failed.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Update your display name and contact information.</p>
      </div>

      {msg.text && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`}>{msg.text}</div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" value={profile?.email ?? ''} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-control"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-control"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="+91 XXXXXXXXXX"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <input className="form-control" value={profile?.role ?? '—'} disabled />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
