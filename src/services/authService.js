/* =========================================================================
   AUTH + USERS (Supabase) — Stage 3
   -------------------------------------------------------------------------
   Replaces the old localStorage userService/getSession. Login and sessions
   are handled by Supabase Auth (real JWT sessions, secure password storage).
   The app_users table holds the staff profile (name, role) linked 1:1 to the
   Supabase auth user by id.

   Method-name parity with the old userService is preserved where the UI calls
   it (getAll, getById, getCurrentUser, login, logout, create, delete). The old
   setup-token flow is gone: password reset and first-time setup now go through
   Supabase recovery emails (requestPasswordReset -> setPassword).
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
    const { error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim(),
      password,
    });
    if (error) throw new Error('Invalid email or password.');
    // Load the profile to return the same shape the UI expects.
    const profile = await userService.getCurrentUser();
    if (!profile || !profile.role) {
      // Authenticated with no staff profile — deny access.
      await supabase.auth.signOut();
      throw new Error('This account is not authorised for SCIOS Contracts.');
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
    // Create the teammate via the invite-user Edge Function (runs with the
    // service role server-side; verifies the caller is an admin). Returns a
    // temporary password the admin can share if the email doesn't arrive.
    const { data: result, error } = await supabase.functions.invoke('invite-user', {
      body: {
        name: data.name,
        email: data.email,
        role: data.role,
        appOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      let msg = error.message || 'Could not add the user.';
      try { const parsed = await error.context?.json?.(); if (parsed?.error) msg = parsed.error; } catch (_) {}
      throw new Error(msg);
    }
    if (result && result.error) throw new Error(result.error);
    return result; // { id, email, role, tempPassword }
  },

  delete: async (id) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Email the user a password-reset link. Supabase sends a recovery email whose
  // link carries a one-time token; `detectSessionInUrl` on our client exchanges
  // it for a real (short-lived) session, which is what lets setPassword() below
  // work without the old password. The redirect must be an allow-listed URL in
  // Authentication -> URL Configuration.
  requestPasswordReset: async (email) => {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#/reset`
      : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      (email || '').trim().toLowerCase(),
      { redirectTo },
    );
    // Deliberately do NOT surface "no such user" — that would let anyone probe
    // which staff emails exist. The UI shows the same confirmation either way.
    if (error && !/user not found/i.test(error.message)) throw new Error(error.message);
  },

  // Set a new password for the CURRENTLY authenticated user. Used both by the
  // recovery flow (session came from the emailed link) and by a signed-in user
  // changing their own password.
  setPassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

};

// Subscribe to Supabase auth state changes (login/logout/refresh). Returns an
// unsubscribe function. Used by AuthContext.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return () => data.subscription.unsubscribe();
}
