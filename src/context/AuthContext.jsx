import React, { useState, useEffect, useCallback } from 'react';
import { userService, onAuthChange } from '../services/authService.js';

/* =========================================================================
   AUTH CONTEXT (Supabase)
   -------------------------------------------------------------------------
   Backed by Supabase Auth. Keeps the SAME context shape the UI expects:
   { user, loading, login, logout, isAdmin }. Session persistence + refresh
   are handled by Supabase; we listen to auth state changes and load the
   matching app_users profile.
   ========================================================================= */
export const AuthContext = React.createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True once Supabase reports PASSWORD_RECOVERY — i.e. the session we hold came
  // from a reset link, not a normal sign-in. App() uses this to force the
  // set-password screen instead of dropping the user into the dashboard.
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const u = await userService.getCurrentUser();
      setUser(u);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load + subscribe to future auth changes (login/logout/refresh).
    // A recovery link is consumed by detectSessionInUrl before React mounts, so
    // the event can fire before we subscribe. Supabase leaves `type=recovery` in
    // the URL hash, so check that too rather than relying on the event alone.
    if (typeof window !== 'undefined' && /[#&?]type=recovery/.test(window.location.hash)) {
      setRecovery(true);
    }
    loadProfile();
    const unsubscribe = onAuthChange((_session, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      loadProfile();
    });
    return unsubscribe;
  }, [loadProfile]);

  const login = async (email, password) => {
    const u = await userService.login(email, password);
    setUser(u);
    return u;
  };
  const logout = async () => { await userService.logout(); setUser(null); setRecovery(false); };
  // Called once the user has actually chosen a new password.
  const clearRecovery = () => setRecovery(false);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, recovery, clearRecovery, isAdmin: user && user.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return React.useContext(AuthContext); }
