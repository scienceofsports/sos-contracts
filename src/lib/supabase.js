import { createClient } from '@supabase/supabase-js';

// Frontend Supabase client. Uses the publishable ("anon") key, which is safe to
// ship in browser code — all real protection comes from Row Level Security on
// the database and from Edge Functions for the public signing flow.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev if the env file is missing, rather than silently
  // producing a broken client.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check .env.local');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
