// Append a hash-chained event to the signature_events ledger. Reads the most
// recent event's row_hash (the chain tip), computes this row's row_hash over
// its own material fields + the previous hash, and inserts. Because the table
// is append-only (RLS + trigger), the chain is tamper-evident: altering any
// earlier row invalidates every row_hash after it.
import { computeRowHash } from './evidence.ts';
// deno-lint-ignore no-explicit-any
type Admin = any;

export async function appendEvent(
  admin: Admin,
  event: {
    contract_id: string | null;
    signing_request_id: string | null;
    event_type: string;
    message?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    signer_name?: string | null;
    signer_title?: string | null;
    signer_company?: string | null;
    signer_email?: string | null;
    signer_ip?: string | null;
    user_agent?: string | null;
    signature_image_url?: string | null;
    document_hash_after?: string | null;
    consent_electronic?: boolean | null;
    consent_authorized?: boolean | null;
    consent_read?: boolean | null;
    signer_on_behalf?: boolean | null;
    representative_company?: string | null;
    representative_registration?: string | null;
    signer_authority_basis?: string | null;
  },
): Promise<void> {
  // Fetch the current chain tip (most recent row_hash) for this contract.
  let prevHash: string | null = null;
  if (event.contract_id) {
    const { data: last } = await admin
      .from('signature_events')
      .select('row_hash, created_at')
      .eq('contract_id', event.contract_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    prevHash = last?.row_hash ?? null;
  }

  // The fields that define this event's identity for the hash chain. We include
  // the evidence-bearing fields; server_timestamp is added by the DB default,
  // so we hash over what we control and let the row carry the DB timestamp.
  const material = {
    contract_id: event.contract_id,
    signing_request_id: event.signing_request_id,
    event_type: event.event_type,
    message: event.message ?? null,
    actor_type: event.actor_type ?? null,
    actor_id: event.actor_id ?? null,
    signer_name: event.signer_name ?? null,
    signer_title: event.signer_title ?? null,
    signer_company: event.signer_company ?? null,
    signer_email: event.signer_email ?? null,
    signer_ip: event.signer_ip ?? null,
    user_agent: event.user_agent ?? null,
    signature_image_url: event.signature_image_url ?? null,
    document_hash_after: event.document_hash_after ?? null,
    consent_electronic: event.consent_electronic ?? null,
    consent_authorized: event.consent_authorized ?? null,
    consent_read: event.consent_read ?? null,
    signer_on_behalf: event.signer_on_behalf ?? null,
    representative_company: event.representative_company ?? null,
    representative_registration: event.representative_registration ?? null,
    signer_authority_basis: event.signer_authority_basis ?? null,
  };

  const rowHash = await computeRowHash(material, prevHash);

  const { error } = await admin.from('signature_events').insert({
    ...material,
    prev_hash: prevHash,
    row_hash: rowHash,
  });
  if (error) throw new Error(`appendEvent failed: ${error.message}`);
}
