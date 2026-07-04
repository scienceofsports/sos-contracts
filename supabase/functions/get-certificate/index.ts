// ============================================================================
// get-certificate  (PUBLIC signer)
//
// Lets a signer re-download the Certificate of Completion for a contract they
// have already signed. Token-scoped (the signing_requests.token IS the scope):
// no login. Returns a short-lived signed URL to the private certificate PDF.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const body = await req.json();
    const { token } = body;
    if (!token) throw new Error('token is required');

    const admin = getAdminClient();

    // 1. Load the request by token.
    const { data: request, error: loadErr } = await admin
      .from('signing_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!request) throw new Error('Invalid link');

    // 2. The certificate only exists once the contract is signed.
    if (request.status !== 'signed') {
      throw new Error('This contract has not been signed yet.');
    }

    // 3. Look up the most recent certificate for this signing request.
    const { data: cert, error: certErr } = await admin
      .from('certificates')
      .select('*')
      .eq('signing_request_id', request.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (certErr) throw new Error(certErr.message);
    if (!cert) throw new Error('Certificate not available yet.');

    // 4. pdf_url is a bucket-prefixed path like "certificates/<contract>/<id>.pdf".
    //    Strip the leading bucket segment and mint a short-lived signed URL.
    const path = (cert.pdf_url || '').replace(/^certificates\//, '');
    const { data, error: urlErr } = await admin.storage
      .from('certificates')
      .createSignedUrl(path, 300);
    if (urlErr) throw new Error(urlErr.message);

    return json({ ok: true, downloadUrl: data.signedUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
