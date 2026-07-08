/* =========================================================================
   MAPPERS — pure DB <-> app object converters (Supabase-backed layer)
   -------------------------------------------------------------------------
   The database uses snake_case column names; the React UI expects the exact
   camelCase field names the old localStorage service produced. These small
   pure functions translate in both directions.

   IMPORTANT NUANCES (Stage 2):
   - Logos: the UI uses `logoBase64` on clients and `logo` on company, but the
     DB has a single `logo_url` text column on each table. For now we keep
     storing base64 in that text column (Storage migration is a later stage),
     so we map logoBase64 <-> logo_url and logo <-> logo_url directly, while
     preserving the app-side field NAMES the UI expects.
   - Contracts: the old app object carried nested `payments`/`auditLog` arrays
     and signer/consent/evidence fields. In the new schema payments live in the
     payments table and signer/evidence live in signature_events. To keep the UI
     unchanged, `contractFromRow` still returns the OLD contract shape: it maps
     the columns that exist on the contracts table and DEFAULTS the fields that
     no longer live there (signer_*, signed_at, signer_ip, consent_*,
     document_hash_after) to null/false. `payments` defaults to [] (the service
     fills it via a join/second query) and `auditLog` defaults to [] (real audit
     is signature_events, wired in a later stage).
   ========================================================================= */

/* ---------------------------------- COMPANY ---------------------------------- */
export function companyFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? null,
    registeredAddress: row.registered_address ?? null,
    vatNumber: row.vat_number ?? null,
    registrationNumber: row.registration_number ?? null,
    contactEmail: row.contact_email ?? null,
    website: row.website ?? null,
    bankName: row.bank_name ?? null,
    bankIBAN: row.bank_iban ?? null,
    bankSWIFT: row.bank_swift ?? null,
    logo: row.logo_url ?? null,
    signatoryName: row.signatory_name ?? null,
    signatoryTitle: row.signatory_title ?? null,
    signatorySignature: row.signatory_signature ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function companyToRow(obj) {
  if (!obj) return {};
  const row = {};
  if ('name' in obj) row.name = obj.name;
  if ('registeredAddress' in obj) row.registered_address = obj.registeredAddress;
  if ('vatNumber' in obj) row.vat_number = obj.vatNumber;
  if ('registrationNumber' in obj) row.registration_number = obj.registrationNumber;
  if ('contactEmail' in obj) row.contact_email = obj.contactEmail;
  if ('website' in obj) row.website = obj.website;
  if ('bankName' in obj) row.bank_name = obj.bankName;
  if ('bankIBAN' in obj) row.bank_iban = obj.bankIBAN;
  if ('bankSWIFT' in obj) row.bank_swift = obj.bankSWIFT;
  if ('logo' in obj) row.logo_url = obj.logo;
  if ('signatoryName' in obj) row.signatory_name = obj.signatoryName;
  if ('signatoryTitle' in obj) row.signatory_title = obj.signatoryTitle;
  if ('signatorySignature' in obj) row.signatory_signature = obj.signatorySignature;
  return row;
}

/* --------------------------------- APP_USERS --------------------------------- */
export function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null,
    role: row.role ?? null,
    createdAt: row.created_at ?? null,
  };
}

/* ---------------------------------- CLIENTS ---------------------------------- */
export function clientFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.company_name ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    address: row.address ?? null,
    country: row.country ?? null,
    vatNumber: row.vat_number ?? null,
    registrationNumber: row.registration_number ?? null,
    currency: row.currency ?? null,
    logoBase64: row.logo_url ?? null,
    ccEmails: row.cc_emails ?? [],
    createdAt: row.created_at ?? null,
  };
}

export function clientToRow(obj) {
  if (!obj) return {};
  const row = {};
  if ('companyName' in obj) row.company_name = obj.companyName;
  if ('contactName' in obj) row.contact_name = obj.contactName;
  if ('contactEmail' in obj) row.contact_email = obj.contactEmail;
  if ('contactPhone' in obj) row.contact_phone = obj.contactPhone;
  if ('address' in obj) row.address = obj.address;
  if ('country' in obj) row.country = obj.country;
  if ('vatNumber' in obj) row.vat_number = obj.vatNumber;
  if ('registrationNumber' in obj) row.registration_number = obj.registrationNumber;
  if ('currency' in obj) row.currency = obj.currency;
  if ('logoBase64' in obj) row.logo_url = obj.logoBase64;
  if ('ccEmails' in obj) row.cc_emails = obj.ccEmails;
  return row;
}

/* --------------------------------- CONTRACTS --------------------------------- */
// Columns that actually exist on the contracts table (snake_case). Any app
// field not represented here is dropped on write.
export function contractFromRow(row, payments = [], events = []) {
  if (!row) return null;
  // Derive signer/consent/audit fields from the tamper-evident signature_events
  // ledger (the authoritative source), so the admin UI reflects real signings.
  const signedEvent = (events || []).find((e) => e.event_type === 'signed') || null;
  const sentEvent = (events || []).find((e) => e.event_type === 'sent') || null;
  const auditLog = (events || [])
    .slice()
    .sort((a, b) => new Date(a.server_timestamp || a.created_at) - new Date(b.server_timestamp || b.created_at))
    .map((e) => ({
      id: e.id,
      type: e.event_type,
      message: e.message || e.event_type,
      at: e.server_timestamp || e.created_at,
      by: e.actor_id || null,
    }));
  return {
    id: row.id,
    contractNumber: row.contract_number ?? null,
    clientId: row.client_id ?? null,
    title: row.title ?? null,
    type: row.type ?? null,
    status: row.status ?? null,
    value: row.value ?? null,
    // Display-only reporting override for the annualised run-rate (see
    // migration 0019). NULL => automatic value ÷ term. Not a legal term.
    annualValueOverride: row.annual_value_override ?? null,
    currency: row.currency ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    paymentType: row.payment_type ?? null,
    paymentTermsDays: row.payment_terms_days ?? null,
    latePaymentPenalty: row.late_payment_penalty ?? null,
    governingLaw: row.governing_law ?? null,
    jurisdiction: row.jurisdiction ?? null,
    description: row.description ?? null,
    specialTerms: row.special_terms ?? null,
    services: row.services ?? null,
    templateId: row.template_id ?? null,
    // Attachment kept as base64 in the text column for now (Storage is later).
    attachmentBase64: row.attachment_url ?? null,
    attachmentName: row.attachment_name ?? null,
    version: row.version ?? 1,
    versionHistory: row.version_history ?? [],
    documentHashBefore: row.document_hash_before ?? null,
    renewalStatus: row.renewal_status ?? null,
    renewalReminderSent: row.renewal_reminder_sent ?? false,
    // Client-provided contact people captured during signing.
    contactName: row.contact_name ?? null,
    contactRole: row.contact_role ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    financeName: row.finance_name ?? null,
    financeEmail: row.finance_email ?? null,
    // ---- Analysis Scope: which teams are covered + opponent-access toggles.
    analysisTeams: row.analysis_teams ?? [],
    oppMatchFootage: row.opp_match_footage ?? false,
    oppTeamAnalysis: row.opp_team_analysis ?? false,
    oppPlayerAnalysis: row.opp_player_analysis ?? false,
    // ---- Commercial Model: billing basis, payment model, kickback inputs.
    billingBasis: row.billing_basis ?? 'services',
    paymentModel: row.payment_model ?? null,
    playerCount: row.player_count ?? null,
    playerMonthlyFee: row.player_monthly_fee ?? null,
    playerMonths: row.player_months ?? null,
    kickbackPct: row.kickback_pct ?? null,
    minPlayers: row.min_players ?? null,
    expectedPlayers: row.expected_players ?? null,
    clubFixedFee: row.club_fixed_fee ?? null,
    vatInclusive: row.vat_inclusive ?? false,
    slaBands: row.sla_bands ?? [],
    slaHours: row.sla_hours ?? 24,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    sentAt: sentEvent?.server_timestamp ?? null,

    // ---- Signer / consent / evidence fields, sourced from the 'signed'
    // ---- signature_events row (the authoritative, tamper-evident record).
    documentHashAfter: signedEvent?.document_hash_after ?? null,
    signerName: signedEvent?.signer_name ?? null,
    signerTitle: signedEvent?.signer_title ?? null,
    signerCompany: signedEvent?.signer_company ?? null,
    signerEmail: signedEvent?.signer_email ?? null,
    signedAt: signedEvent?.server_timestamp ?? null,
    signerIP: signedEvent?.signer_ip ?? null,
    signatureImageUrl: signedEvent?.signature_image_url ?? null,
    consentElectronic: signedEvent?.consent_electronic ?? false,
    consentAuthorized: signedEvent?.consent_authorized ?? false,
    consentRead: signedEvent?.consent_read ?? false,

    // ---- Audit trail from the ledger; payments from the payments table.
    auditLog,
    payments: payments.map(paymentFromRow),
  };
}

// Map an app-side contract patch to a contracts-table row, INCLUDING ONLY
// columns that exist on the table. Fields with no column (signer_*, payments,
// auditLog, consent_*, documentHashAfter, signedAt, signerIP, etc.) are ignored.
// Postgres date columns reject '' — coerce empty strings to null.
const nd = (v) => (v === '' || v === undefined ? null : v);

export function contractToRow(obj) {
  if (!obj) return {};
  const row = {};
  if ('contractNumber' in obj) row.contract_number = obj.contractNumber;
  if ('clientId' in obj) row.client_id = obj.clientId;
  if ('title' in obj) row.title = obj.title;
  if ('type' in obj) row.type = obj.type;
  if ('status' in obj) row.status = obj.status;
  if ('value' in obj) row.value = obj.value;
  // Reporting-only override; '' clears it back to automatic value ÷ term.
  if ('annualValueOverride' in obj) row.annual_value_override = obj.annualValueOverride === '' || obj.annualValueOverride == null ? null : Number(obj.annualValueOverride);
  if ('currency' in obj) row.currency = obj.currency;
  if ('startDate' in obj) row.start_date = nd(obj.startDate);
  if ('endDate' in obj) row.end_date = nd(obj.endDate);
  if ('paymentType' in obj) row.payment_type = obj.paymentType;
  if ('paymentTermsDays' in obj) row.payment_terms_days = obj.paymentTermsDays;
  if ('latePaymentPenalty' in obj) row.late_payment_penalty = obj.latePaymentPenalty;
  if ('governingLaw' in obj) row.governing_law = obj.governingLaw;
  if ('jurisdiction' in obj) row.jurisdiction = obj.jurisdiction;
  if ('description' in obj) row.description = obj.description;
  if ('specialTerms' in obj) row.special_terms = obj.specialTerms;
  if ('services' in obj) row.services = obj.services;
  if ('templateId' in obj) row.template_id = obj.templateId;
  if ('attachmentBase64' in obj) row.attachment_url = obj.attachmentBase64;
  if ('attachmentName' in obj) row.attachment_name = obj.attachmentName;
  if ('version' in obj) row.version = obj.version;
  if ('versionHistory' in obj) row.version_history = obj.versionHistory;
  if ('documentHashBefore' in obj) row.document_hash_before = obj.documentHashBefore;
  if ('renewalStatus' in obj) row.renewal_status = obj.renewalStatus;
  if ('renewalReminderSent' in obj) row.renewal_reminder_sent = obj.renewalReminderSent;
  if ('contactName' in obj) row.contact_name = obj.contactName;
  if ('contactRole' in obj) row.contact_role = obj.contactRole;
  if ('contactEmail' in obj) row.contact_email = obj.contactEmail;
  if ('contactPhone' in obj) row.contact_phone = obj.contactPhone;
  if ('financeName' in obj) row.finance_name = obj.financeName;
  if ('financeEmail' in obj) row.finance_email = obj.financeEmail;
  if ('analysisTeams' in obj) row.analysis_teams = obj.analysisTeams;
  if ('oppMatchFootage' in obj) row.opp_match_footage = obj.oppMatchFootage;
  if ('oppTeamAnalysis' in obj) row.opp_team_analysis = obj.oppTeamAnalysis;
  if ('oppPlayerAnalysis' in obj) row.opp_player_analysis = obj.oppPlayerAnalysis;
  if ('billingBasis' in obj) row.billing_basis = obj.billingBasis || 'services';
  if ('paymentModel' in obj) row.payment_model = obj.paymentModel || null;
  if ('playerCount' in obj) row.player_count = obj.playerCount === '' ? null : obj.playerCount;
  if ('playerMonthlyFee' in obj) row.player_monthly_fee = obj.playerMonthlyFee === '' ? null : obj.playerMonthlyFee;
  if ('playerMonths' in obj) row.player_months = obj.playerMonths === '' ? null : obj.playerMonths;
  if ('kickbackPct' in obj) row.kickback_pct = obj.kickbackPct === '' ? null : obj.kickbackPct;
  if ('minPlayers' in obj) row.min_players = obj.minPlayers === '' ? null : obj.minPlayers;
  if ('expectedPlayers' in obj) row.expected_players = obj.expectedPlayers === '' ? null : obj.expectedPlayers;
  if ('clubFixedFee' in obj) row.club_fixed_fee = obj.clubFixedFee === '' ? null : obj.clubFixedFee;
  if ('vatInclusive' in obj) row.vat_inclusive = !!obj.vatInclusive;
  if ('slaBands' in obj) row.sla_bands = Array.isArray(obj.slaBands) ? obj.slaBands : [];
  if ('slaHours' in obj) row.sla_hours = obj.slaHours === '' || obj.slaHours == null ? 24 : obj.slaHours;
  if ('createdBy' in obj) row.created_by = obj.createdBy;
  return row;
}

/* --------------------------------- PAYMENTS ---------------------------------- */
export function paymentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    contractId: row.contract_id ?? null,
    accountingRef: row.accounting_ref ?? null,
    description: row.description ?? null,
    dueDate: row.due_date ?? null,
    amount: row.amount ?? null,
    vatRate: row.vat_rate ?? null,
    vatAmount: row.vat_amount ?? null,
    totalAmount: row.total_amount ?? null,
    currency: row.currency ?? null,
    status: row.status ?? null,
    paidAt: row.paid_at ?? null,
    paidAmount: row.paid_amount ?? null,
    markedPaidBy: row.marked_paid_by ?? null,
    remindersSent: row.reminders_sent ?? [],
    notes: row.notes ?? '',
    createdAt: row.created_at ?? null,
  };
}

export function paymentToRow(obj) {
  if (!obj) return {};
  const row = {};
  if ('contractId' in obj) row.contract_id = obj.contractId;
  if ('accountingRef' in obj) row.accounting_ref = obj.accountingRef;
  if ('description' in obj) row.description = obj.description;
  if ('dueDate' in obj) row.due_date = nd(obj.dueDate);
  if ('amount' in obj) row.amount = obj.amount;
  if ('vatRate' in obj) row.vat_rate = obj.vatRate;
  if ('vatAmount' in obj) row.vat_amount = obj.vatAmount;
  if ('totalAmount' in obj) row.total_amount = obj.totalAmount;
  if ('currency' in obj) row.currency = obj.currency;
  if ('status' in obj) row.status = obj.status;
  if ('paidAt' in obj) row.paid_at = nd(obj.paidAt);
  if ('paidAmount' in obj) row.paid_amount = obj.paidAmount;
  if ('markedPaidBy' in obj) row.marked_paid_by = obj.markedPaidBy;
  if ('remindersSent' in obj) row.reminders_sent = obj.remindersSent;
  if ('notes' in obj) row.notes = obj.notes;
  return row;
}
