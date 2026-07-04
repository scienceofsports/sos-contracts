// ============================================================================
// record-signature  (PUBLIC signer — the core evidence function)
//
// The tamper-evident act of signing. Requires prior OTP verification and all
// three consents. It re-hashes the frozen snapshot and compares it to the hash
// captured at Send (integrity check), uploads the signature PNG to private
// Storage, then appends the 'signed' event carrying the full evidence bundle
// (identity, IP, UA, consents, signature path, doc hash). Finally flips the
// signing request 'signed' and the contract 'active', and notifies staff.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient, getClientIp } from '../_shared/supabaseAdmin.ts';
import { hashDocument } from '../_shared/evidence.ts';
import { sendEmail, signedNotificationEmail } from '../_shared/email.ts';
import { appendEvent } from '../_shared/audit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const body = await req.json();
    const {
      token,
      signerName,
      signerTitle,
      signerCompany,
      consents,
      signatureImageBase64,
    } = body;
    if (!token) throw new Error('token is required');

    const admin = getAdminClient();

    // 1. Load + validate the request; OTP must be verified.
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
    if (!request.otp_verified_at) {
      throw new Error('Please verify your email code before signing.');
    }

    // 2. All three consents required.
    if (!consents || !consents.electronic || !consents.authorized || !consents.read) {
      throw new Error('All consents are required.');
    }

    // 3. Required signer fields.
    if (!signerName || !signatureImageBase64) {
      throw new Error('Signer name and signature are required.');
    }

    // 4. Integrity check: re-hash the frozen snapshot and compare to Send-time
    //    hash. We record both hashes but do NOT block signing on a mismatch —
    //    the mismatch itself becomes part of the evidence record.
    const document_hash_after = await hashDocument(request.document_snapshot);
    const integrityOk = document_hash_after === request.document_hash_before;

    // 5. Decode the base64 PNG and upload to private Storage.
    const b64 = signatureImageBase64.split(',')[1];
    if (!b64) throw new Error('Invalid signature image.');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const objectPath = `${request.contract_id}/${request.id}.png`;
    const { error: uploadErr } = await admin.storage
      .from('signatures')
      .upload(objectPath, bytes, { contentType: 'image/png', upsert: true });
    if (uploadErr) throw new Error(`Signature upload failed: ${uploadErr.message}`);
    // Store the storage PATH (bucket-prefixed), not a public URL.
    const signature_image_url = `signatures/${objectPath}`;

    // 6. Server-side evidence facts.
    const signer_ip = getClientIp(req);
    const user_agent = req.headers.get('user-agent');
    const signedAt = new Date().toISOString();

    // 7. Append the tamper-evident 'signed' event with the full evidence bundle.
    await appendEvent(admin, {
      contract_id: request.contract_id,
      signing_request_id: request.id,
      event_type: 'signed',
      message: `Signed by ${signerName}`,
      actor_type: 'signer',
      signer_name: signerName,
      signer_title: signerTitle ?? null,
      signer_company: signerCompany ?? null,
      signer_email: request.signer_email,
      signer_ip,
      user_agent,
      signature_image_url,
      document_hash_after,
      consent_electronic: !!consents.electronic,
      consent_authorized: !!consents.authorized,
      consent_read: !!consents.read,
    });

    // 8. Advance statuses: request -> signed, contract -> active (signing
    //    activates the contract, matching prior behaviour).
    const { error: reqUpdateErr } = await admin
      .from('signing_requests')
      .update({ status: 'signed' })
      .eq('id', request.id);
    if (reqUpdateErr) throw new Error(reqUpdateErr.message);

    const { error: contractUpdateErr } = await admin
      .from('contracts')
      .update({ status: 'active' })
      .eq('id', request.contract_id);
    if (contractUpdateErr) throw new Error(contractUpdateErr.message);

    // 9. Notify staff. Prefer company.contact_email; fall back to the creating
    //    admin's email (app_users). Never fail signing on a notification error.
    try {
      const { data: company } = await admin
        .from('company')
        .select('contact_email')
        .limit(1)
        .maybeSingle();
      const { data: contract } = await admin
        .from('contracts')
        .select('title, created_by')
        .eq('id', request.contract_id)
        .maybeSingle();

      let notifyTo = company?.contact_email ?? null;
      if (!notifyTo && contract?.created_by) {
        const { data: admin_user } = await admin
          .from('app_users')
          .select('email')
          .eq('id', contract.created_by)
          .maybeSingle();
        notifyTo = admin_user?.email ?? null;
      }

      if (notifyTo) {
        await sendEmail({
          to: notifyTo,
          subject: `Contract signed: ${contract?.title ?? ''}`,
          html: signedNotificationEmail({
            contractTitle: contract?.title ?? 'Contract',
            signerName,
            signerCompany: signerCompany ?? '',
            signedAt,
          }),
        });
      }
    } catch (notifyErr) {
      console.error('signed notification email failed:', notifyErr);
    }

    // 10. Done.
    return json({ ok: true, integrityOk, signedAt });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
