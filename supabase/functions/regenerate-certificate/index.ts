// ============================================================================
// regenerate-certificate  (ADMIN only)
//
// Rebuilds the Certificate of Completion for a contract that was signed
// successfully but whose certificate PDF failed to render — the case that hit
// SOS-C-2026-005 (Omonoia Aradippou), where Greek text in the document could
// not be encoded by pdf-lib's Latin-1 StandardFonts and generation threw.
//
// WHY THIS IS A FAITHFUL REGENERATION, NOT A RECONSTRUCTION
// Every value is read back out of the evidence that already exists:
//   * the document       -> signing_requests.executed_snapshot (frozen at
//                           signing, written BEFORE certificate generation)
//   * the signer + time  -> the 'signed' row in signature_events (append-only)
//   * the hashes         -> the same ledger row + the request's hash_before
//   * the signature image-> the PNG already in the private signatures bucket
// Nothing is re-derived from live client/contract rows, so a later edit to a
// client record cannot leak into a reissued certificate. The PDF is new; every
// fact printed on it is original.
//
// The rebuilt PDF carries a REGENERATION disclosure so its later build date is
// explicit rather than implied. Backdating a document silently would be worse
// evidence than disclosing the rebuild.
//
// Idempotent-ish by design: it refuses if a certificate row already exists,
// unless { force: true } is passed.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { buildCertificate } from '../_shared/certificate.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Any = any;

const nz = (v: Any) => (v === null || v === undefined || v === '' ? null : v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    // ---- 1. Authorise: admins only -----------------------------------------
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Not authorised.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authorised.');

    const admin = getAdminClient();
    const { data: profile } = await admin
      .from('app_users').select('role').eq('id', userData.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') {
      throw new Error('Only admins can regenerate a certificate.');
    }

    // ---- 2. Resolve the contract -------------------------------------------
    const body = await req.json().catch(() => ({}));
    const contractNumber = (body.contractNumber || '').trim();
    const force = body.force === true;
    if (!contractNumber) throw new Error('contractNumber is required.');

    const { data: contract, error: cErr } = await admin
      .from('contracts').select('*').eq('contract_number', contractNumber).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contract) throw new Error(`Contract ${contractNumber} not found.`);
    if (contract.status !== 'signed' && contract.status !== 'active') {
      throw new Error(`Contract ${contractNumber} is ${contract.status}; only a signed/active contract has a certificate.`);
    }

    // ---- 3. The signing request holding the frozen executed document --------
    const { data: requests, error: rErr } = await admin
      .from('signing_requests').select('*')
      .eq('contract_id', contract.id)
      .order('created_at', { ascending: false });
    if (rErr) throw new Error(rErr.message);

    // Prefer the request that actually completed; fall back to the newest with
    // an executed snapshot. A declined-then-resent contract has several.
    const request = (requests || []).find((r: Any) => r.status === 'signed' && r.executed_snapshot)
      || (requests || []).find((r: Any) => r.executed_snapshot)
      || (requests || []).find((r: Any) => r.status === 'signed');
    if (!request) throw new Error('No signing request found for this contract.');
    if (!request.executed_snapshot) {
      // Refuse rather than silently rebuild from the send-time snapshot: that
      // document may not match what was signed (client-confirmed party details
      // are captured at signing), and a certificate that misstates the signed
      // document is worse than no certificate.
      throw new Error(
        'This signing request has no executed_snapshot, so the signed document cannot be reproduced faithfully. Refusing to generate a certificate from the pre-signature snapshot.',
      );
    }

    // ---- 4. The signature event — the source of every signer fact ----------
    const { data: events, error: eErr } = await admin
      .from('signature_events').select('*')
      .eq('contract_id', contract.id)
      .eq('event_type', 'signed')
      .order('created_at', { ascending: false });
    if (eErr) throw new Error(eErr.message);
    const signedEvent = (events || []).find((e: Any) => e.signing_request_id === request.id)
      || (events || [])[0];
    if (!signedEvent) throw new Error('No signed event in the ledger for this contract.');

    // ---- 5. Guard against duplicates ---------------------------------------
    const { data: existing } = await admin
      .from('certificates').select('id, generated_at')
      .eq('contract_id', contract.id)
      .order('generated_at', { ascending: false });
    if (existing && existing.length > 0 && !force) {
      throw new Error(
        `A certificate already exists for ${contractNumber} (generated ${existing[0].generated_at}). Pass force:true to add a regenerated one.`,
      );
    }

    // ---- 6. The signature image already stored at signing -------------------
    let sigBytes: Uint8Array | null = null;
    if (signedEvent.signature_image_url) {
      try {
        const path = String(signedEvent.signature_image_url).replace(/^signatures\//, '');
        const { data: blob } = await admin.storage.from('signatures').download(path);
        if (blob) sigBytes = new Uint8Array(await blob.arrayBuffer());
      } catch (_) { /* non-fatal — the certificate notes the image is absent */ }
    }

    // ---- 7. Rebuild -------------------------------------------------------
    const snap = request.executed_snapshot;
    const signedAt = signedEvent.server_timestamp;
    // Integrity: the ledger recorded the post-signature hash; it matches when
    // the document was unaltered between send and sign.
    const integrityOk = !!signedEvent.document_hash_after &&
      signedEvent.document_hash_after === request.document_hash_before;

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const regeneratedNote =
      `The Certificate of Completion for this contract could not be produced at the time of signing because the document contained characters the PDF renderer could not encode. The signature itself completed normally and its evidence — the signatory's identity verification, server timestamp, IP address, consents and document hashes — was recorded in the tamper-evident ledger at that moment and is reproduced above unchanged. This PDF was regenerated on ${stamp} from the frozen executed document stored at signing. The signature date shown above (${new Date(signedAt).toUTCString()}) is the original and authoritative one; only this PDF is of a later date.`;

    const { bytes: pdfBytes, sha256: pdfSha } = await buildCertificate({
      snapshot: snap,
      signer: {
        name: signedEvent.signer_name ?? '',
        title: signedEvent.signer_title ?? '',
        company: signedEvent.signer_company ?? '',
        email: signedEvent.signer_email ?? request.signer_email,
        ip: nz(signedEvent.signer_ip),
        userAgent: nz(signedEvent.user_agent),
        signedAt,
        consentElectronic: !!signedEvent.consent_electronic,
        consentAuthorized: !!signedEvent.consent_authorized,
        consentRead: !!signedEvent.consent_read,
        onBehalf: !!signedEvent.signer_on_behalf,
        representativeCompany: nz(signedEvent.representative_company),
        representativeRegistration: nz(signedEvent.representative_registration),
        authorityBasis: nz(signedEvent.signer_authority_basis),
      },
      documentHashBefore: request.document_hash_before,
      documentHashAfter: signedEvent.document_hash_after ?? request.document_hash_before,
      integrityOk,
      signatureImageBytes: sigBytes,
      contractNumber: contract.contract_number,
      regeneratedNote,
    });

    // ---- 8. Store it exactly where record-signature would have --------------
    const certPath = `${contract.id}/${request.id}.pdf`;
    const { error: upErr } = await admin.storage
      .from('certificates')
      .upload(certPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`Certificate upload failed: ${upErr.message}`);

    const { error: insErr } = await admin.from('certificates').insert({
      contract_id: contract.id,
      signing_request_id: request.id,
      pdf_url: `certificates/${certPath}`,
      pdf_sha256: pdfSha,
    });
    if (insErr) throw new Error(`Certificate row insert failed: ${insErr.message}`);

    // Clear the failure flag now that a certificate exists.
    await admin.from('contracts')
      .update({ certificate_status: 'generated' })
      .eq('id', contract.id);

    return json({
      ok: true,
      contractNumber: contract.contract_number,
      signingRequestId: request.id,
      signedAt,
      integrityOk,
      signatureImageEmbedded: !!sigBytes,
      pdfBytes: pdfBytes.length,
      pdfSha256: pdfSha,
      path: `certificates/${certPath}`,
    });
  } catch (e) {
    console.error('regenerate-certificate failed:', e);
    return json({ error: (e as Error).message }, 400);
  }
});
