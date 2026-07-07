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

// Resolve the best staff email to alert: company contact, else the admin who
// created the contract. Returns null if neither is available.
async function resolveStaffEmail(admin: any, contractId: string): Promise<string | null> {
  try {
    const { data: company } = await admin.from('company').select('contact_email').limit(1).maybeSingle();
    if (company?.contact_email) return company.contact_email;
    const { data: contract } = await admin.from('contracts').select('created_by').eq('id', contractId).maybeSingle();
    if (contract?.created_by) {
      const { data: adminUser } = await admin.from('app_users').select('email').eq('id', contract.created_by).maybeSingle();
      return adminUser?.email ?? null;
    }
  } catch (_) { /* fall through */ }
  return null;
}

// Best-effort append to the operational (non-evidence) contract_events log.
async function appendContractEventSafe(admin: any, contractId: string, message: string): Promise<void> {
  await admin.from('contract_events').insert({
    contract_id: contractId,
    event_type: 'system',
    actor_type: 'system',
    message,
  });
}

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
    // A decline (or a cancelled/expired request) is TERMINAL for this token: the
    // party said no or the link lapsed. Never let the same link silently flip a
    // 'declined' contract back to 'active'. A resend must mint a NEW token.
    // (In-progress states are 'sent' -> 'otp_sent' -> 'otp_verified'; those are
    // fine — only these terminal states block signing.)
    if (['declined', 'cancelled', 'expired'].includes(request.status)) {
      throw new Error('This contract can no longer be signed. Please contact the sender for a new link.');
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

    // 4. Build the snapshot that will ACTUALLY be rendered into the executed
    //    document, applying the client's confirmed company details FIRST, then
    //    hash THAT. This guarantees document_hash_after covers exactly what the
    //    signer signs (party identity fields the signer confirmed on-screen).
    //    The frozen request.document_snapshot is left immutable — we render and
    //    hash from a working copy `snap` and never overwrite the original.
    const snap = structuredClone(request.document_snapshot || {});
    if (clientDetails && snap.client) {
      if (clientDetails.companyName) { snap.client.company_name = clientDetails.companyName; snap.client.companyName = clientDetails.companyName; }
      if (clientDetails.address) { snap.client.address = clientDetails.address; }
      if (clientDetails.vatNumber) { snap.client.vat_number = clientDetails.vatNumber; snap.client.vatNumber = clientDetails.vatNumber; }
      if (clientDetails.registrationNumber) { snap.client.registration_number = clientDetails.registrationNumber; snap.client.registrationNumber = clientDetails.registrationNumber; }
    }

    // Integrity check: hash the to-be-executed document and compare to the
    // Send-time hash. We record both hashes but do NOT block signing on a
    // mismatch — the mismatch itself becomes part of the evidence record. (A
    // mismatch is expected & benign when the signer fills previously-blank party
    // details; it is flagged on the certificate + a staff alert either way.)
    const document_hash_after = await hashDocument(snap);
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

    // 7. ATOMICALLY CLAIM the signing before recording anything immutable.
    //    claim_signing_request flips 'sent' -> 'signed' under a row lock and
    //    returns true ONLY for the single caller that wins. If two record-
    //    signature calls race (double-submit) or one retries after a partial
    //    failure, exactly one claim succeeds — so the append-only 'signed' event
    //    below can never be written twice. (A DB partial-unique index on
    //    signature_events(contract_id) WHERE event_type='signed' is the final
    //    backstop — see migration 0016.)
    const { data: claimed, error: claimErr } = await admin
      .rpc('claim_signing_request', { p_request_id: request.id });
    if (claimErr) throw new Error(`Could not claim signing request: ${claimErr.message}`);
    if (claimed !== true) {
      // Someone else already signed (or the request is no longer signable).
      // Idempotent response: do NOT append a second signature.
      throw new Error('This contract has already been signed.');
    }

    // 8. Append the tamper-evident 'signed' event with the full evidence bundle.
    //    We are past the atomic claim, so this runs at most once per contract.
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

    // Advance the contract to 'active' (signing activates it) and persist the
    // client-provided contact people. Only set fields that were provided.
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

    // 9. Persist the client's confirmed company details onto the CLIENT RECORD
    //    (so the admin view + future contracts benefit). The confirmed values
    //    are already applied to `snap` (before the hash) and are covered by
    //    document_hash_after, so no separate snapshot rewrite is needed — the
    //    frozen request.document_snapshot stays immutable as the send-time
    //    anchor. Record a note in the operational log for traceability.
    if (clientDetails && snap.client?.id) {
      try {
        await admin.from('clients').update({
          address: clientDetails.address ?? undefined,
          vat_number: clientDetails.vatNumber ?? undefined,
          registration_number: clientDetails.registrationNumber ?? undefined,
        }).eq('id', snap.client.id);
      } catch (_) { /* non-fatal — the executed PDF already carries the values */ }
    }

    // 10. Generate the Certificate of Completion PDF, store it, and email it to
    //     BOTH the signer (confirmation) and staff (notification). Wrapped so a
    //     certificate/email hiccup never fails the signing itself.
    // Refresh the header logos from the LIVE client + company rows before we
    // render the executed PDF. The frozen snapshot may pre-date the logo being
    // uploaded (or hold a WEBP that pdf-lib cannot embed). logo_url is a cosmetic
    // field EXCLUDED from serializeDocument, so refreshing it changes no hash;
    // we mutate only the in-memory working copy `snap`, never the frozen row.
    try {
      const clientId = snap?.client?.id;
      if (clientId) {
        const { data: liveClient } = await admin
          .from('clients').select('logo_url').eq('id', clientId).maybeSingle();
        if (liveClient?.logo_url && snap.client) snap.client.logo_url = liveClient.logo_url;
      }
      const { data: liveCompany } = await admin
        .from('company').select('logo_url').limit(1).maybeSingle();
      if (liveCompany?.logo_url && snap.company) snap.company.logo_url = liveCompany.logo_url;
    } catch (_) { /* non-fatal — fall back to whatever the snapshot holds */ }

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
      // EVIDENCE-CRITICAL failure: the signature is recorded but the Certificate
      // of Completion / signed-contract PDF was NOT durably produced. Never let
      // this pass silently — flag the contract for staff follow-up and alert.
      try {
        await admin.from('contracts')
          .update({ certificate_status: 'failed' })
          .eq('id', request.contract_id);
      } catch (_) { /* flag is best-effort; the alert below is the real signal */ }
      try {
        await appendContractEventSafe(admin, request.contract_id,
          `Certificate of Completion generation FAILED after signing — evidence PDF missing, needs regeneration. ${(certErr as Error).message}`);
      } catch (_) { /* non-fatal */ }
      try {
        const alertTo = await resolveStaffEmail(admin, request.contract_id);
        if (alertTo) {
          await sendEmail({
            to: alertTo,
            subject: `⚠ ACTION NEEDED — certificate failed for signed contract ${contractNumber || contractTitle}`,
            html: `<p>The contract <strong>${contractTitle}</strong> was signed successfully, but generating its Certificate of Completion / signed PDF failed.</p>
                   <p>The signature evidence is safely recorded in the ledger, but the certificate PDF must be regenerated. Please review this contract in the admin app.</p>
                   <p style="color:#666">Error: ${(certErr as Error).message}</p>`,
          });
        }
      } catch (_) { /* alerting is best-effort */ }
    }

    // The document hash changes between send and sign whenever the signer
    // completes their own party details (company / address / VAT / registration).
    // That is the NORMAL case and must NOT alarm staff. We only email when the
    // change is SUSPICIOUS: a party field that was ALREADY populated at send time
    // was altered during signing (i.e. not just a blank being filled in). Either
    // way the mismatch is recorded on the certificate + in the ledger; the email
    // is reserved for the genuine anomaly so it stays meaningful.
    if (!integrityOk) {
      const origClient = (request.document_snapshot?.client ?? {}) as Record<string, unknown>;
      const pick = (o: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) { const v = o?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
        return '';
      };
      // For each party field: was it non-empty at send AND changed at sign?
      const suspicious = (
        [
          [['company_name', 'companyName'], clientDetails?.companyName],
          [['address'], clientDetails?.address],
          [['vat_number', 'vatNumber'], clientDetails?.vatNumber],
          [['registration_number', 'registrationNumber'], clientDetails?.registrationNumber],
        ] as [string[], string | undefined][]
      ).some(([keys, confirmed]) => {
        const before = pick(origClient, ...keys);
        const after = (confirmed ?? '').trim();
        return before !== '' && after !== '' && before !== after; // pre-set value overwritten
      });

      if (suspicious) {
        try {
          const alertTo = await resolveStaffEmail(admin, request.contract_id);
          if (alertTo) {
            await sendEmail({
              to: alertTo,
              subject: `⚠ Review needed — party details CHANGED on signing: ${contractNumber || contractTitle}`,
              html: `<p>The contract <strong>${contractTitle}</strong> was signed, but a party detail that was <strong>already filled in</strong> when you sent it (company name / address / VAT / registration) was <strong>changed</strong> by the signer during signing.</p>
                     <p>This is unusual — please review the executed document and confirm the change is legitimate. The full evidence (both hashes) is recorded on the Certificate of Completion.</p>`,
            });
          }
        } catch (_) { /* best-effort */ }
      }
      // Benign case (signer filled previously-blank fields): no email — the
      // mismatch is still captured on the certificate and in the ledger.
    }

    // 11. Done.
    return json({ ok: true, integrityOk, signedAt });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
