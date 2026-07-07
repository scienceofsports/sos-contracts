// ============================================================================
// decline-signing-request  (PUBLIC signer)
//
// Lets a signer decline the contract (or request changes) instead of signing.
// Token-scoped (no login). Flips the signing request and the contract to
// 'declined', appends a 'declined' audit event carrying the signer's reason +
// IP/UA, and notifies the admin by email so they can resend or revise.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient, getClientIp } from '../_shared/supabaseAdmin.ts';
import { appendEvent } from '../_shared/audit.ts';
import { declinedNotificationEmail, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const body = await req.json();
    const { token, reason } = body;
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
    if (request.status === 'declined') {
      // Idempotent: already declined — don't re-flip or re-spam the admin.
      return json({ ok: true, alreadyDeclined: true });
    }
    // In-progress states are 'sent' -> 'otp_sent' -> 'otp_verified'; any of these
    // is declinable. Terminal states (cancelled/expired) are not.
    const IN_PROGRESS = ['sent', 'otp_sent', 'otp_verified'];
    if (!IN_PROGRESS.includes(request.status)) {
      throw new Error('This contract is not in a state that can be declined.');
    }
    // Identity gate: declining is a legally meaningful act (the party says no /
    // asks for changes), so it must be as identity-bound as signing. Require the
    // same email-OTP verification — a forwarded/leaked link cannot kill the deal.
    if (!request.otp_verified_at) {
      throw new Error('Please verify your email code before declining.');
    }

    // 2. Atomically claim the decline: flip ONLY if the request is still in an
    //    in-progress state. Guards against a decline racing a sign and against
    //    double-decline (a concurrent winner leaves 0 rows for the loser).
    const { data: claimedRows, error: reqUpdateErr } = await admin
      .from('signing_requests')
      .update({ status: 'declined' })
      .eq('id', request.id)
      .in('status', IN_PROGRESS)
      .select('id');
    if (reqUpdateErr) throw new Error(reqUpdateErr.message);
    if (!claimedRows || claimedRows.length === 0) {
      // Lost the race (signed/declined in a concurrent request).
      throw new Error('This contract can no longer be declined.');
    }

    const { error: contractUpdateErr } = await admin
      .from('contracts')
      .update({ status: 'declined' })
      .eq('id', request.contract_id);
    if (contractUpdateErr) throw new Error(contractUpdateErr.message);

    // 3. Append the tamper-evident 'declined' event.
    await appendEvent(admin, {
      contract_id: request.contract_id,
      signing_request_id: request.id,
      event_type: 'declined',
      message: `Declined by signer${reason ? ': ' + reason : ''}`,
      actor_type: 'signer',
      signer_email: request.signer_email,
      signer_ip: getClientIp(req),
      user_agent: req.headers.get('user-agent'),
    });

    // 4. Notify the admin (company contact, else the creating admin).
    try {
      const snap = request.document_snapshot || {};
      const contractTitle = snap?.contract?.title ?? 'Contract';
      const { data: company } = await admin.from('company').select('contact_email').limit(1).maybeSingle();
      const { data: contract } = await admin.from('contracts').select('created_by').eq('id', request.contract_id).maybeSingle();
      let notifyTo = company?.contact_email ?? null;
      if (!notifyTo && contract?.created_by) {
        const { data: admin_user } = await admin.from('app_users').select('email').eq('id', contract.created_by).maybeSingle();
        notifyTo = admin_user?.email ?? null;
      }
      if (notifyTo) {
        await sendEmail({
          to: notifyTo,
          subject: `Contract declined: ${contractTitle}`,
          html: declinedNotificationEmail({ contractTitle, signerEmail: request.signer_email, reason: reason || '' }),
        });
      }
    } catch (e) {
      console.error('decline notification email failed:', e);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
