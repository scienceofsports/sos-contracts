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

// A best-effort IPv4/IPv6 sanity check. signer_ip is stored in a Postgres `inet`
// column, which REJECTS anything that isn't a valid address — and on the signing
// path that rejection would throw on the evidence insert. So we validate here and
// return null for anything unparseable (a spoofed/garbled X-Forwarded-For, or a
// proxy that appends a :port or IPv6 zone id), degrading IP to "not recorded"
// rather than ever breaking the signature write.
function looksLikeIp(v: string): boolean {
  // IPv4: four 0–255 octets.
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(v)) {
    return v.split('.').every((o) => Number(o) <= 255);
  }
  // IPv6: only hex + colons allowed (so no ports, zone ids, or other junk).
  // Validate structurally by counting groups around an optional "::" compressor
  // rather than with one brittle mega-regex.
  if (v.includes(':') && /^[0-9a-fA-F:]+$/.test(v)) {
    const dbl = v.split('::');
    if (dbl.length > 2) return false;                       // at most one "::"
    const groupsOk = (part: string) =>
      part === '' ? true : part.split(':').every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
    if (dbl.length === 2) {
      // "::" present — each side can be empty; total groups must be < 8.
      const left = dbl[0] ? dbl[0].split(':') : [];
      const right = dbl[1] ? dbl[1].split(':') : [];
      return groupsOk(dbl[0]) && groupsOk(dbl[1]) && left.length + right.length <= 7;
    }
    // No "::" — must be exactly 8 well-formed groups.
    const groups = v.split(':');
    return groups.length === 8 && groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
  }
  return false;
}

// Extract the real client IP from edge headers (best-effort). Supabase runs
// behind Cloudflare/Fly, so cf-connecting-ip / x-forwarded-for carry the true
// visitor IP rather than the edge's own address. Returns null if no header
// yields a syntactically valid IP — a bad header must never break the caller.
export function getClientIp(req: Request): string | null {
  const candidate = (
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    ''
  ).trim();
  return candidate && looksLikeIp(candidate) ? candidate : null;
}
