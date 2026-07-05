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
import { sendEmail, signedNotificationEmail, signerConfirmationEmail } from '../_shared/email.ts';
import { appendEvent } from '../_shared/audit.ts';
import { buildCertificate } from '../_shared/certificate.ts';
import { buildContractPdf } from '../_shared/contractPdf.ts';

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
      // Client-provided designated contact + finance contact (all optional).
      contactName,
      contactRole,
      contactEmail,
      contactPhone,
      financeName,
      financeEmail,
      // Client's confirmed company details (address, VAT, reg) from signing.
      clientDetails,
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

    // Persist the client-provided contact people alongside activation. Only set
    // fields that were actually provided; leave the rest null.
    const nz = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const { error: contractUpdateErr } = await admin
      .from('contracts')
      .update({
        status: 'active',
        contact_name: nz(contactName),
        contact_role: nz(contactRole),
        contact_email: nz(contactEmail),
        contact_phone: nz(contactPhone),
        finance_name: nz(financeName),
        finance_email: nz(financeEmail),
      })
      .eq('id', request.contract_id);
    if (contractUpdateErr) throw new Error(contractUpdateErr.message);

    // 9. Generate the Certificate of Completion PDF, store it, and email it to
    //    BOTH the signer (confirmation) and staff (notification). Wrapped so a
    //    certificate/email hiccup never fails the signing itself.
    const snap = request.document_snapshot || {};
    // Apply the client's confirmed company details (address/VAT/reg/name) onto
    // the snapshot's client block so the executed document reflects what the
    // signer confirmed at signing (fixes a lingering "[address]" placeholder).
    if (clientDetails && snap.client) {
      if (clientDetails.companyName) { snap.client.company_name = clientDetails.companyName; snap.client.companyName = clientDetails.companyName; }
      if (clientDetails.address) { snap.client.address = clientDetails.address; }
      if (clientDetails.vatNumber) { snap.client.vat_number = clientDetails.vatNumber; snap.client.vatNumber = clientDetails.vatNumber; }
      if (clientDetails.registrationNumber) { snap.client.registration_number = clientDetails.registrationNumber; snap.client.registrationNumber = clientDetails.registrationNumber; }
      // Persist the confirmed details back onto the client record + the request
      // snapshot so the admin view and re-downloads stay consistent.
      try {
        await admin.from('clients').update({
          address: clientDetails.address ?? undefined,
          vat_number: clientDetails.vatNumber ?? undefined,
          registration_number: clientDetails.registrationNumber ?? undefined,
        }).eq('id', snap.client.id);
        await admin.from('signing_requests').update({ document_snapshot: snap }).eq('id', request.id);
      } catch (_) { /* non-fatal */ }
    }
    const contractTitle = snap?.contract?.title ?? 'Contract';
    const contractNumber = snap?.contract?.contractNumber ?? snap?.contract?.contract_number ?? '';
    try {
      // Re-download the signature PNG we just uploaded, to embed in the PDF.
      let sigBytes: Uint8Array | null = null;
      try {
        const { data: sigBlob } = await admin.storage.from('signatures').download(objectPath);
        if (sigBlob) sigBytes = new Uint8Array(await sigBlob.arrayBuffer());
      } catch (_) { sigBytes = bytes; /* fall back to the bytes we just uploaded */ }

      const { bytes: pdfBytes, sha256: pdfSha } = await buildCertificate({
        snapshot: snap,
        signer: {
          name: signerName, title: signerTitle ?? '', company: signerCompany ?? '',
          email: request.signer_email, ip: signer_ip, userAgent: user_agent, signedAt,
          consentElectronic: !!consents.electronic, consentAuthorized: !!consents.authorized, consentRead: !!consents.read,
        },
        documentHashBefore: request.document_hash_before,
        documentHashAfter: document_hash_after,
        integrityOk,
        signatureImageBytes: sigBytes,
        contractNumber,
      });

      // Store the certificate PDF privately + record it.
      const certPath = `${request.contract_id}/${request.id}.pdf`;
      await admin.storage.from('certificates').upload(certPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
      await admin.from('certificates').insert({
        contract_id: request.contract_id,
        signing_request_id: request.id,
        pdf_url: `certificates/${certPath}`,
        pdf_sha256: pdfSha,
      });

      // Base64 the PDF for email attachments.
      const pdfB64 = btoa(Array.from(pdfBytes).map((b) => String.fromCharCode(b)).join(''));
      const attachments = [{ filename: `Certificate - ${contractNumber || contractTitle}.pdf`, content: pdfB64 }];

      // Also build the fully-executed (dual-signed) contract PDF, store it at a
      // deterministic path in the contract-attachments bucket (so it can be
      // re-downloaded via get-signed-contract), and attach it to every email.
      try {
        const { bytes: contractPdfBytes } = await buildContractPdf({
          snapshot: snap,
          signer: {
            name: signerName, title: signerTitle ?? '', company: signerCompany ?? '',
            email: request.signer_email, signedAt,
          },
          signatureImageBytes: sigBytes,
        });
        const signedContractPath = `${request.contract_id}/${request.id}-signed-contract.pdf`;
        await admin.storage.from('contract-attachments').upload(
          signedContractPath, contractPdfBytes, { contentType: 'application/pdf', upsert: true },
        );
        const contractB64 = btoa(Array.from(contractPdfBytes).map((b) => String.fromCharCode(b)).join(''));
        attachments.push({ filename: `Signed Contract - ${contractNumber || contractTitle}.pdf`, content: contractB64 });
      } catch (contractPdfErr) {
        console.error('signed contract PDF generation failed:', contractPdfErr);
      }

      // (a) Confirmation to the SIGNER.
      try {
        await sendEmail({
          to: request.signer_email,
          subject: `Your signed contract: ${contractTitle}`,
          html: signerConfirmationEmail({
            signerName, companyName: snap?.company?.name ?? 'Science of Sports', contractTitle, signedAt,
          }),
          attachments,
        });
      } catch (e) { console.error('signer confirmation email failed:', e); }

      // (b) Notification to STAFF (company contact, else creating admin).
      try {
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
            subject: `Contract signed: ${contractTitle}`,
            html: signedNotificationEmail({ contractTitle, signerName, signerCompany: signerCompany ?? '', signedAt }),
            attachments,
          });
        }
      } catch (e) { console.error('staff notification email failed:', e); }

      // (c) CC recipients on the client (finance, a director…): send them the same
      //     signed certificate. Read from the frozen snapshot (snake or camel).
      const ccEmails: string[] = Array.isArray(snap?.client?.cc_emails)
        ? snap.client.cc_emails
        : (Array.isArray(snap?.client?.ccEmails) ? snap.client.ccEmails : []);
      for (const cc of ccEmails) {
        if (!cc || typeof cc !== 'string' || cc === request.signer_email) continue;
        try {
          await sendEmail({
            to: cc,
            subject: `Signed contract: ${contractTitle}`,
            html: signerConfirmationEmail({
              signerName, companyName: snap?.company?.name ?? 'Science of Sports', contractTitle, signedAt,
            }),
            attachments,
          });
        } catch (e) { console.error(`CC certificate email to ${cc} failed:`, e); }
      }
    } catch (certErr) {
      console.error('certificate generation failed:', certErr);
    }

    // 10. Done.
    return json({ ok: true, integrityOk, signedAt });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
