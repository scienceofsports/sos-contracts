import React, { useState, useEffect, useCallback } from 'react';
import { userService, getSession } from '../services/index.js';
import { useToast } from './ToastContext.jsx';

/* =========================================================================
   AUTH CONTEXT
   ========================================================================= */
export const AuthContext = React.createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const session = getSession();
    if (!session) { setUser(null); setLoading(false); return; }
    const u = await userService.getCurrentUser();
    setUser(u);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      const session = getSession();
      if (!session && user) {
        setUser(null);
        toast.push('Your session has expired. Please log in again.', 'error');
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user, toast]);

  const login = async (email, password) => {
    const u = await userService.login(email, password);
    setUser(u);
    return u;
  };
  const logout = async () => { await userService.logout(); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user && user.role === 'admin' }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return React.useContext(AuthContext); }
