// ============================================================================
// create-signing-request  (ADMIN only)
//
// The logged-in admin app calls this when a user clicks "Send for signature".
// The caller MUST be an authenticated admin — we verify their JWT and check the
// app_users role before doing anything (same pattern as invite-user). The
// signing-link origin is whitelisted, never trusted from the request body.
//
// Freezes a full {contract, client, company} snapshot + its hash into a new
// signing_requests row, marks the contract 'sent', logs a 'sent' audit event,
// and emails the signer a unique signing link.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { hashDocument } from '../_shared/evidence.ts';
import { sendEmail, signRequestEmail } from '../_shared/email.ts';
import { appendEvent } from '../_shared/audit.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for the signing link — the request body is NOT trusted.
const ALLOWED_ORIGINS = [
  'https://contracts.scienceofsports.net',
  'http://localhost:5173',
  'http://localhost:5174',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    // --- Authorise: caller must be an authenticated ADMIN. ------------------
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Not authorised.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authorised.');

    const admin = getAdminClient();
    const { data: profile } = await admin.from('app_users').select('role').eq('id', userData.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') throw new Error('Only admins can send contracts for signature.');

    const body = await req.json();
    const { contractId } = body;
    if (!contractId) throw new Error('contractId is required');
    // Whitelist the signing-link origin; never trust it from the request body.
    const requested = (body.appOrigin || '').replace(/\/$/, '');
    const appOrigin = ALLOWED_ORIGINS.includes(requested) ? requested : ALLOWED_ORIGINS[0];

    // 1/2. Load the contract.
    const { data: contract, error: contractErr } = await admin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .maybeSingle();
    if (contractErr) throw new Error(contractErr.message);
    if (!contract) throw new Error('Contract not found');

    // 3. Load the client + the single company row.
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('*')
      .eq('id', contract.client_id)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!client) throw new Error('Client not found for this contract');

    const { data: company, error: companyErr } = await admin
      .from('company')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (companyErr) throw new Error(companyErr.message);
    if (!company) throw new Error('Company profile not found');

    // Load the payment schedule so it is frozen into the signed document too.
    const { data: payments } = await admin
      .from('payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });

    // 4/5. Build the frozen snapshot AS-IS and hash it.
    const snapshot = { contract: { ...contract, payments: payments || [] }, client, company };
    const document_hash_before = await hashDocument(snapshot);

    // 6. Insert the signing request; DB defaults token, expires_at, status.
    const { data: request, error: insertErr } = await admin
      .from('signing_requests')
      .insert({
        contract_id: contractId,
        signer_email: client.contact_email,
        document_snapshot: snapshot,
        document_hash_before,
        created_by: contract.created_by,
      })
      .select('*')
      .single();
    if (insertErr) throw new Error(insertErr.message);

    const token = request.token;

    // 7. Mark the contract as sent + store the hash it was sent under.
    const { error: updateErr } = await admin
      .from('contracts')
      .update({ status: 'sent', document_hash_before })
      .eq('id', contractId);
    if (updateErr) throw new Error(updateErr.message);

    // 8. Audit event.
    await appendEvent(admin, {
      contract_id: contractId,
      signing_request_id: request.id,
      event_type: 'sent',
      message: `Contract sent to ${client.contact_email}`,
      actor_type: 'admin',
      actor_id: contract.created_by,
    });

    // 9. Email the signer. If it hiccups, keep the request and report emailSent:false.
    const signUrl = `${appOrigin}/?req=${token}`;
    try {
      await sendEmail({
        to: client.contact_email,
        subject: `Please review & sign: ${contract.title}`,
        html: signRequestEmail({
          clientContactName: client.contact_name,
          companyName: company.name,
          contractTitle: contract.title,
          signUrl,
        }),
      });
    } catch (emailErr) {
      console.error('signRequest email failed:', emailErr);
      return json({
        ok: true,
        token,
        signUrl,
        emailSent: false,
        emailError: (emailErr as Error).message,
      });
    }

    // 9b. CC recipients (finance, a director…): send the SAME sign-request email
    //     to each address on the client's cc_emails. Informational only — they
    //     don't sign. Each send is isolated so a CC failure never breaks the flow.
    const ccEmails: string[] = Array.isArray(client.cc_emails) ? client.cc_emails : [];
    for (const cc of ccEmails) {
      if (!cc || typeof cc !== 'string' || cc === client.contact_email) continue;
      try {
        await sendEmail({
          to: cc,
          subject: `Please review & sign: ${contract.title}`,
          html: signRequestEmail({
            clientContactName: client.contact_name,
            companyName: company.name,
            contractTitle: contract.title,
            signUrl,
          }),
        });
      } catch (ccErr) {
        console.error(`CC sign-request email to ${cc} failed:`, ccErr);
      }
    }

    // 10. Success.
    return json({ ok: true, token, signUrl, emailSent: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
