import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/* ── Animated CivicFlow logo ─────────────────────────────────── */
function CivicFlowLogo() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="cf-logo-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="CivicFlow"
    >
      {/* SVG icon – city-skyline / civic mark */}
      <svg
        className={`cf-logo-svg${hovered ? ' cf-logo-svg--hovered' : ''}`}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Glow ring */}
        <circle
          cx="32" cy="32" r="30"
          stroke="url(#ringGrad)"
          strokeWidth="2"
          className="cf-ring"
        />
        {/* City buildings */}
        <rect x="10" y="30" width="8"  height="20" rx="1" fill="url(#bldgGrad)" />
        <rect x="20" y="22" width="8"  height="28" rx="1" fill="url(#bldgGrad2)" />
        <rect x="30" y="26" width="6"  height="24" rx="1" fill="url(#bldgGrad)" />
        <rect x="38" y="18" width="10" height="32" rx="1" fill="url(#bldgGrad2)" />
        <rect x="50" y="28" width="6"  height="22" rx="1" fill="url(#bldgGrad)" />
        {/* Windows */}
        <rect x="12" y="33" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="15" y="33" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="22" y="25" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="25" y="25" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="22" y="30" width="2" height="2" rx=".5" fill="#fff" opacity=".9" className="cf-win-pulse" />
        <rect x="40" y="22" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="44" y="22" width="2" height="2" rx=".5" fill="#fff" opacity=".7" />
        <rect x="40" y="27" width="2" height="2" rx=".5" fill="#fff" opacity=".9" className="cf-win-pulse" />
        {/* Ground line */}
        <line x1="6" y1="50" x2="58" y2="50" stroke="#0fa36c" strokeWidth="2" strokeLinecap="round" />
        {/* Signal arc (wifi-like civic connectivity) */}
        <path d="M28 14 Q32 10 36 14" stroke="#1d6fe8" strokeWidth="2" strokeLinecap="round" fill="none" className="cf-arc1" />
        <path d="M24 11 Q32 5  40 11" stroke="#1d6fe8" strokeWidth="1.5" strokeLinecap="round" fill="none" className="cf-arc2" opacity=".6" />
        <defs>
          <linearGradient id="bldgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d6fe8" />
            <stop offset="100%" stopColor="#1557c0" />
          </linearGradient>
          <linearGradient id="bldgGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0fa36c" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1d6fe8" />
            <stop offset="100%" stopColor="#0fa36c" />
          </linearGradient>
        </defs>
      </svg>

      {/* Word-mark */}
      <div className="cf-wordmark">
        Civic<span className="cf-wm-flow">Flow</span><span className="cf-wm-dot">.</span>
      </div>
    </div>
  );
}

/* ── Google icon SVG ─────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.4 30.2 0 24 0 14.7 0 6.7 5.4 2.9 13.3l7.9 6.1C12.6 13.1 17.9 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
      <path fill="#FBBC05" d="M10.8 28.6A14.4 14.4 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.3-6.2z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.3-7.7 2.3-6.1 0-11.3-4.1-13.2-9.6l-8.3 6.2C6.7 42.6 14.7 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

/* ── Divider ─────────────────────────────────────────────────── */
function Divider({ text }) {
  return (
    <div className="auth-divider">
      <span className="auth-divider-line" />
      <span className="auth-divider-text">{text}</span>
      <span className="auth-divider-line" />
    </div>
  );
}

/* ── Main AuthPage ───────────────────────────────────────────── */
export default function AuthPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err.message ?? 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message ?? 'Google sign-in failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Interactive logo */}
        <CivicFlowLogo />

        <p className="auth-subtitle">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── Google sign-in button ── */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <GoogleIcon />
          {googleLoading ? 'Connecting…' : 'Continue with Google'}
        </button>

        <Divider text="or" />

        {/* ── Email / password form ── */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-control"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '11px' }}
            disabled={loading || googleLoading}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('register'); setError(''); }}>Sign up</button></>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
