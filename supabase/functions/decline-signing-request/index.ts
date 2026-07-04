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

    // 2. Flip the request and the contract to 'declined'.
    const { error: reqUpdateErr } = await admin
      .from('signing_requests')
      .update({ status: 'declined' })
      .eq('id', request.id);
    if (reqUpdateErr) throw new Error(reqUpdateErr.message);

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
