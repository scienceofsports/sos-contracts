// ============================================================================
// send-otp  (PUBLIC signer)
//
// Emails the signer a fresh 6-digit verification code. Only the SHA-256 hash of
// the code is stored — never the plaintext, and the code is never returned in
// the response. Rate-limited to one code per 30 seconds.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256Hex } from '../_shared/evidence.ts';
import { otpEmail, sendEmail } from '../_shared/email.ts';
import { appendEvent } from '../_shared/audit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const body = await req.json();
    const { token } = body;
    if (!token) throw new Error('token is required');

    const admin = getAdminClient();

    // 1. Load + validate the request.
    const { data: request, error: loadErr } = await admin
      .from('signing_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!request) throw new Error('Invalid or expired link');
    if (new Date(request.expires_at) < new Date()) {
      throw new Error('This signing link has expired.');
    }
    if (request.status === 'signed') {
      throw new Error('This contract has already been signed.');
    }
    // Terminal states can't receive new codes — a declined/cancelled/expired
    // request is dead; staff must issue a fresh link.
    if (['declined', 'cancelled', 'expired'].includes(request.status)) {
      throw new Error('This signing link is no longer active. Please contact the sender for a new one.');
    }

    // 2a. Rate-limit: one code per 30 seconds (anti-spam floor).
    if (request.otp_sent_at) {
      const secsSince = (Date.now() - new Date(request.otp_sent_at).getTime()) / 1000;
      if (secsSince < 30) {
        throw new Error('Please wait before requesting another code.');
      }
    }
    // 2b. Absolute resend cap per request: a leaked/forwarded link can't be used
    //     to email-bomb the signer or burn Resend quota. After this many sends
    //     the signer must ask staff for a fresh link.
    const MAX_OTP_SENDS = 6;
    if ((request.otp_send_count ?? 0) >= MAX_OTP_SENDS) {
      throw new Error('Too many verification codes have been requested for this link. Please contact the sender for a new one.');
    }

    // 3. Generate a 6-digit numeric code and hash it (store only the hash).
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = (buf[0] % 1_000_000).toString().padStart(6, '0');
    const otp_code_hash = await sha256Hex(code);

    // 4. Persist the hash, reset attempts, stamp sent time.
    const { error: updateErr } = await admin
      .from('signing_requests')
      .update({
        otp_code_hash,
        otp_sent_at: new Date().toISOString(),
        otp_attempts: 0,
        otp_send_count: (request.otp_send_count ?? 0) + 1,
        status: 'otp_sent',
      })
      .eq('id', request.id);
    if (updateErr) throw new Error(updateErr.message);

    // 5. Contract title lives in the frozen snapshot.
    const contractTitle = request.document_snapshot?.contract?.title ?? 'your contract';

    // 6. Email the code.
    await sendEmail({
      to: request.signer_email,
      subject: `Your signing verification code`,
      html: otpEmail({ code, contractTitle }),
    });

    // 7. Audit (no PII beyond the signer email).
    await appendEvent(admin, {
      contract_id: request.contract_id,
      signing_request_id: request.id,
      event_type: 'otp_sent',
      message: 'Verification code sent to signer',
      actor_type: 'signer',
      signer_email: request.signer_email,
    });

    // 8. Never return the code.
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
