// ============================================================================
// verify-otp  (PUBLIC signer)
//
// Verifies the 6-digit code the signer received by email. Compares SHA-256
// hashes only. Locks out after 5 failed attempts. On success, stamps
// otp_verified_at and logs an 'otp_verified' audit event with IP + user agent.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient, getClientIp } from '../_shared/supabaseAdmin.ts';
import { sha256Hex } from '../_shared/evidence.ts';
import { appendEvent } from '../_shared/audit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const body = await req.json();
    const { token, code } = body;
    if (!token) throw new Error('token is required');
    if (!code) throw new Error('code is required');

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

    // 2. Absolute (cross-request) lockout — bounds brute-force even if the
    //    signer keeps re-requesting fresh codes. Requires a new link from staff.
    if ((request.otp_total_attempts ?? 0) >= 25) {
      throw new Error('Too many attempts on this request. Please ask for a new signing link.');
    }
    // Per-code attempt lockout.
    if ((request.otp_attempts ?? 0) >= 5) {
      throw new Error('Too many attempts. Please request a new code.');
    }
    if (!request.otp_code_hash) {
      throw new Error('Please request a verification code first.');
    }
    // Per-code expiry: the code is only valid for 10 minutes after it was sent
    // (matches the wording in the OTP email). After that a fresh code is needed.
    if (request.otp_sent_at) {
      const ageMs = Date.now() - new Date(request.otp_sent_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        throw new Error('This code has expired. Please request a new one.');
      }
    }

    // 3. Compare hashes. On mismatch, increment both counters and reject.
    const candidateHash = await sha256Hex(String(code));
    if (candidateHash !== request.otp_code_hash) {
      await admin
        .from('signing_requests')
        .update({
          otp_attempts: (request.otp_attempts ?? 0) + 1,
          otp_total_attempts: (request.otp_total_attempts ?? 0) + 1,
        })
        .eq('id', request.id);
      throw new Error('Incorrect code.');
    }

    // 4. Match: mark verified + audit.
    const { error: updateErr } = await admin
      .from('signing_requests')
      .update({
        otp_verified_at: new Date().toISOString(),
        status: 'otp_verified',
      })
      .eq('id', request.id);
    if (updateErr) throw new Error(updateErr.message);

    await appendEvent(admin, {
      contract_id: request.contract_id,
      signing_request_id: request.id,
      event_type: 'otp_verified',
      message: 'Signer verified email code',
      actor_type: 'signer',
      signer_email: request.signer_email,
      signer_ip: getClientIp(req),
      user_agent: req.headers.get('user-agent'),
    });

    // 5. Done.
    return json({ ok: true, verified: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
