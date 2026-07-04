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
    loadProfile();
    const unsubscribe = onAuthChange(() => { loadProfile(); });
    return unsubscribe;
  }, [loadProfile]);

  const login = async (email, password) => {
    const u = await userService.login(email, password);
    setUser(u);
    return u;
  };
  const logout = async () => { await userService.logout(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user && user.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return React.useContext(AuthContext); }
