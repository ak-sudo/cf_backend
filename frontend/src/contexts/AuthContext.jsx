import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { syncUser, getMe } from '../lib/api';

const AuthContext = createContext(null);

// Backend envelope: { success, message, data: { user } }
const extractUser = (res) => res?.data?.data?.user ?? null;

const describeError = (err) =>
  err?.response?.data?.message ??
  (err?.request ? 'Could not reach the CivicFlow server.' : err?.message) ??
  'Could not load your profile.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // Firebase user
  const [profile, setProfile] = useState(null);   // Backend profile (role etc.)
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);   // true until auth + profile resolved
  const currentUid = useRef(null);

  // Sync backend profile for the given Firebase user. Results for a user who
  // is no longer signed in are discarded, so one account never sees another's data.
  const syncProfile = useCallback(async (firebaseUser) => {
    const uid = firebaseUser?.uid ?? null;
    currentUid.current = uid;

    if (!firebaseUser) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    try {
      const res = await syncUser();
      if (currentUid.current !== uid) return;
      const backendUser = extractUser(res);
      if (!backendUser) throw new Error('Server returned no user profile.');
      setProfile(backendUser);
      setProfileError(null);
    } catch (err) {
      if (currentUid.current !== uid) return;
      console.error('Profile sync failed:', err);
      setProfile(null);
      setProfileError(describeError(err));
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Hold routing until the backend profile (and role) is known.
      setLoading(true);
      setProfile(null);
      setProfileError(null);
      setUser(firebaseUser);
      await syncProfile(firebaseUser);
      if (currentUid.current === (firebaseUser?.uid ?? null)) setLoading(false);
    });
    return unsub;
  }, [syncProfile]);

  // Re-read the current user's profile (e.g. after editing it). Manual only,
  // so a failing request never loops.
  const refreshProfile = useCallback(async () => {
    const uid = currentUid.current;
    if (!uid) return null;
    try {
      const res = await getMe();
      if (currentUid.current !== uid) return null;
      const backendUser = extractUser(res);
      if (backendUser) {
        setProfile(backendUser);
        setProfileError(null);
      }
      return backendUser;
    } catch (err) {
      if (currentUid.current === uid) setProfileError(describeError(err));
      throw err;
    }
  }, []);

  const retryProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    await syncProfile(auth.currentUser);
    setLoading(false);
  }, [syncProfile]);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const register = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

  const loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
  };

  const logout = async () => {
    currentUid.current = null;
    setProfile(null);
    setProfileError(null);
    await signOut(auth);
  };

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user, profile, role, loading, profileError,
        login, register, loginWithGoogle, logout, refreshProfile, retryProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
