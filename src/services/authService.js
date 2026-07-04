/* =========================================================================
   AUTH + USERS (Supabase) — Stage 3
   -------------------------------------------------------------------------
   Replaces the old localStorage userService/getSession. Login and sessions
   are handled by Supabase Auth (real JWT sessions, secure password storage).
   The app_users table holds the staff profile (name, role) linked 1:1 to the
   Supabase auth user by id.

   Method-name parity with the old userService is preserved where the UI calls
   it (getAll, getById, getCurrentUser, login, logout, create, delete). The old
   setup-token flow (getBySetupToken/completeSetup) is replaced by Supabase's
   invite/recovery emails; those methods remain but delegate to Supabase.
   ========================================================================= */

import { supabase } from '../lib/supabase.js';
import { userFromRow } from './mappers.js';

export const userService = {
  // All staff profiles (admins + viewers). RLS lets admins read all.
  getAll: async () => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(userFromRow);
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? userFromRow(data) : null;
  },

  // The currently logged-in staff member (auth user joined to their app_users
  // profile). Returns null if not logged in or no profile row exists yet.
  getCurrentUser: async () => {
    const { data: sessionData } = await supabase.auth.getUser();
    const authUser = sessionData?.user;
    if (!authUser) return null;
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Authenticated but no profile row — surface a minimal user so the app
      // can show a helpful message rather than silently logging out.
      return { id: authUser.id, email: authUser.email, name: authUser.email, role: null };
    }
    return userFromRow(data);
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim(),
      password,
    });
    if (error) throw new Error('Invalid email or password.');
    // Load the profile to return the same shape the UI expects.
    const profile = await userService.getCurrentUser();
    if (!profile || !profile.role) {
      // Authenticated with no staff profile — deny access.
      await supabase.auth.signOut();
      throw new Error('This account is not authorised for SOS Contracts.');
    }
    return profile;
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  // Invite a new staff member. Supabase sends them an email to set a password.
  // NOTE: inviteUserByEmail requires the service role, so from the browser we
  // instead create the app_users profile row and trigger a password-setup email
  // via the standard sign-up / magic-link flow. For Stage 3 we use a simple
  // approach: an admin creates the auth user via a Supabase invite (handled in
  // the dashboard or an Edge Function later). Here we insert the profile row so
  // the person appears in Users & Roles; wiring the automated invite email is
  // finished alongside the Edge Functions stage.
  create: async (data) => {
    // Guard against duplicate profile.
    const { data: existing } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', (data.email || '').toLowerCase())
      .maybeSingle();
    if (existing) throw new Error('A user with this email already exists.');

    // We cannot create an auth user from the browser with the anon key, so this
    // path is completed by an Edge Function (invite-user) in a later step. For
    // now, throw a clear message if called without that function present.
    throw new Error('Adding users requires the invite function (set up in a later step). For now, only your own admin account exists.');
  },

  delete: async (id) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Legacy setup-token flow — replaced by Supabase invite/recovery. Kept as
  // safe no-ops so any lingering references don't crash.
  getBySetupToken: async () => null,
  completeSetup: async () => {
    throw new Error('Account setup is now handled via the email link Supabase sends you.');
  },
};

// Subscribe to Supabase auth state changes (login/logout/refresh). Returns an
// unsubscribe function. Used by AuthContext.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
