// ============================================================================
// get-signed-contract  (PUBLIC signer)
//
// Lets a signer re-download the fully-executed (dual-signed) contract PDF for a
// contract they have already signed. Token-scoped (the signing_requests.token
// IS the scope): no login. Returns a short-lived signed URL to the private
// signed-contract PDF stored in the contract-attachments bucket.
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

    // 2. The signed contract only exists once the contract is signed.
    if (request.status !== 'signed') {
      throw new Error('This contract has not been signed yet.');
    }

    // 3. Deterministic storage path written by record-signature.
    const path = `${request.contract_id}/${request.id}-signed-contract.pdf`;
    const { data, error: urlErr } = await admin.storage
      .from('contract-attachments')
      .createSignedUrl(path, 300);
    if (urlErr) throw new Error(urlErr.message);
    if (!data?.signedUrl) throw new Error('Signed contract not available yet.');

    return json({ ok: true, downloadUrl: data.signedUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
