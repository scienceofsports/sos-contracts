// ============================================================================
// Evidence helpers — the integrity core of the signing flow.
//
//  * serializeDocument()  — canonical, byte-stable serialization of the FULL
//    contract so the hash covers everything material (not just 3 fields). The
//    frontend must build its display from the SAME snapshot object so
//    "what you sign" == "what is hashed".
//  * sha256Hex()          — SHA-256 over a string.
//  * computeRowHash()     — hash-chains an audit event to the previous one so
//    the signature_events ledger is tamper-evident.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Recursively sort object keys so JSON.stringify is deterministic regardless of
// key insertion order. Arrays keep their order (order is meaningful there).
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// Build the canonical string that gets hashed. We include every material field
// of the contract plus the identifying details of both parties. Cosmetic /
// volatile fields (ids, timestamps, status, version metadata) are excluded so
// the hash reflects the AGREEMENT, not bookkeeping.
export function serializeDocument(snapshot: {
  contract: Record<string, unknown>;
  client: Record<string, unknown>;
  company: Record<string, unknown>;
}): string {
  const c = snapshot.contract || {};
  const cl = snapshot.client || {};
  const co = snapshot.company || {};

  // Normalize the payment schedule into a byte-stable shape: one canonical line
  // per instalment (amount / VAT / total / due date / description), numbers
  // coerced to a fixed representation, sorted by due date then amount so row
  // order can never change the hash. The schedule is a MATERIAL commercial term
  // (it is rendered into the signed contract), so it MUST be inside the digest.
  const numOrNull = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const rawPayments = Array.isArray((c as Any).payments) ? (c as Any).payments : [];
  const payments = rawPayments
    .map((p: Any) => ({
      amount: numOrNull(p.amount ?? p.total_amount),
      vatAmount: numOrNull(p.vatAmount ?? p.vat_amount) ?? 0,
      vatRate: numOrNull(p.vatRate ?? p.vat_rate) ?? 0,
      totalAmount: numOrNull(p.totalAmount ?? p.total_amount),
      dueDate: p.dueDate ?? p.due_date ?? null,
      description: p.description ?? null,
    }))
    .sort((a: Any, b: Any) =>
      String(a.dueDate).localeCompare(String(b.dueDate)) ||
      (a.amount ?? 0) - (b.amount ?? 0));

  const canonical = {
    contract: {
      title: c.title ?? null,
      type: c.type ?? null,
      value: c.value ?? null,
      currency: c.currency ?? null,
      startDate: c.startDate ?? c.start_date ?? null,
      endDate: c.endDate ?? c.end_date ?? null,
      paymentType: c.paymentType ?? c.payment_type ?? null,
      paymentTermsDays: c.paymentTermsDays ?? c.payment_terms_days ?? null,
      latePaymentPenalty: c.latePaymentPenalty ?? c.late_payment_penalty ?? null,
      governingLaw: c.governingLaw ?? c.governing_law ?? null,
      jurisdiction: c.jurisdiction ?? null,
      description: c.description ?? null,
      specialTerms: c.specialTerms ?? c.special_terms ?? null,
      services: c.services ?? null,
      payments,
    },
    client: {
      companyName: cl.companyName ?? cl.company_name ?? null,
      registrationNumber: cl.registrationNumber ?? cl.registration_number ?? null,
      vatNumber: cl.vatNumber ?? cl.vat_number ?? null,
      address: cl.address ?? null,
      country: cl.country ?? null,
    },
    company: {
      name: co.name ?? null,
      registrationNumber: co.registrationNumber ?? co.registration_number ?? null,
      vatNumber: co.vatNumber ?? co.vat_number ?? null,
      registeredAddress: co.registeredAddress ?? co.registered_address ?? null,
    },
  };

  return JSON.stringify(sortKeysDeep(canonical));
}

export async function hashDocument(snapshot: {
  contract: Record<string, unknown>;
  client: Record<string, unknown>;
  company: Record<string, unknown>;
}): Promise<string> {
  return sha256Hex(serializeDocument(snapshot));
}

// Compute the row_hash for an append-only audit event, chaining it to the
// previous event's row_hash. Any later edit to an earlier row breaks the chain.
export async function computeRowHash(
  fields: Record<string, unknown>,
  prevHash: string | null,
): Promise<string> {
  const canonical = JSON.stringify(sortKeysDeep(fields));
  return sha256Hex(`${prevHash ?? ''}::${canonical}`);
}
