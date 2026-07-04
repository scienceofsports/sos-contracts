// Service-role Supabase client for Edge Functions. This key BYPASSES Row Level
// Security, so it must ONLY ever run server-side (inside Edge Functions) — never
// in the browser. It is read from the SUPABASE_SERVICE_ROLE_KEY env var, which
// Supabase injects into functions automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Extract the real client IP from edge headers (best-effort). Supabase runs
// behind Cloudflare/Fly, so cf-connecting-ip / x-forwarded-for carry the true
// visitor IP rather than the edge's own address.
export function getClientIp(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}
