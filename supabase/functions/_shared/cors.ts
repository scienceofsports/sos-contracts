// Shared CORS headers for all Edge Functions. The signing page is public and
// may be served from the app's own origin; we allow any origin for the
// signer-facing functions since access is gated by the request token, not by
// origin. Tighten `Access-Control-Allow-Origin` to your deployed origin later
// if you prefer.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function handleOptions(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
