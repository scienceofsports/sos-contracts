// ============================================================================
// get-signing-request  (PUBLIC signer)
//
// Loads a signing request by its token so the public signing page can render
// the SAME frozen document the admin sent. On first view it flips status
// 'sent' -> 'viewed' and logs a single 'viewed' audit event with the signer's
// IP + user agent. Never returns the OTP hash.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient, getClientIp } from '../_shared/supabaseAdmin.ts';
import { appendEvent } from '../_shared/audit.ts';

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
    if (!request) throw new Error('Invalid or expired link');

    // 2. Expiry check.
    if (new Date(request.expires_at) < new Date()) {
      await admin
        .from('signing_requests')
        .update({ status: 'expired' })
        .eq('id', request.id);
      throw new Error('This signing link has expired.');
    }

    // 3. First-view handling: only append a 'viewed' event once, when the
    //    request was still 'sent' (i.e. never opened before).
    if (request.status === 'sent') {
      await admin
        .from('signing_requests')
        .update({ status: 'viewed' })
        .eq('id', request.id);

      await appendEvent(admin, {
        contract_id: request.contract_id,
        signing_request_id: request.id,
        event_type: 'viewed',
        message: 'Signer opened the contract',
        actor_type: 'signer',
        signer_email: request.signer_email,
        signer_ip: getClientIp(req),
        user_agent: req.headers.get('user-agent'),
      });
    }

    // 4. Return the snapshot so the client renders the same document. The
    //    status we report reflects the just-applied 'viewed' transition.
    const status = request.status === 'sent' ? 'viewed' : request.status;

    return json({
      ok: true,
      request: {
        id: request.id,
        contract_id: request.contract_id,
        signer_email: request.signer_email,
        status,
        document_snapshot: request.document_snapshot,
        expires_at: request.expires_at,
        otp_verified: !!request.otp_verified_at,
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
