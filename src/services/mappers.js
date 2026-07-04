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
  return row;
}

/* --------------------------------- CONTRACTS --------------------------------- */
// Columns that actually exist on the contracts table (snake_case). Any app
// field not represented here is dropped on write.
export function contractFromRow(row, payments = []) {
  if (!row) return null;
  return {
    id: row.id,
    contractNumber: row.contract_number ?? null,
    clientId: row.client_id ?? null,
    title: row.title ?? null,
    type: row.type ?? null,
    status: row.status ?? null,
    value: row.value ?? null,
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
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,

    // ---- Fields that no longer live on the contracts table. Defaulted so the
    // ---- UI (which still reads them) never crashes. Real values come from
    // ---- signature_events in a later stage.
    documentHashAfter: null,
    signerName: null,
    signerTitle: null,
    signerCompany: null,
    signerEmail: null,
    signedAt: null,
    signerIP: null,
    consentElectronic: false,
    consentAuthorized: false,
    consentRead: false,

    // ---- Nested collections. payments filled by the service; auditLog is a
    // ---- Stage-2 placeholder (real audit trail = signature_events, later).
    auditLog: [],
    payments: payments.map(paymentFromRow),
  };
}

// Map an app-side contract patch to a contracts-table row, INCLUDING ONLY
// columns that exist on the table. Fields with no column (signer_*, payments,
// auditLog, consent_*, documentHashAfter, signedAt, signerIP, etc.) are ignored.
export function contractToRow(obj) {
  if (!obj) return {};
  const row = {};
  if ('contractNumber' in obj) row.contract_number = obj.contractNumber;
  if ('clientId' in obj) row.client_id = obj.clientId;
  if ('title' in obj) row.title = obj.title;
  if ('type' in obj) row.type = obj.type;
  if ('status' in obj) row.status = obj.status;
  if ('value' in obj) row.value = obj.value;
  if ('currency' in obj) row.currency = obj.currency;
  if ('startDate' in obj) row.start_date = obj.startDate;
  if ('endDate' in obj) row.end_date = obj.endDate;
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
  if ('dueDate' in obj) row.due_date = obj.dueDate;
  if ('amount' in obj) row.amount = obj.amount;
  if ('vatRate' in obj) row.vat_rate = obj.vatRate;
  if ('vatAmount' in obj) row.vat_amount = obj.vatAmount;
  if ('totalAmount' in obj) row.total_amount = obj.totalAmount;
  if ('currency' in obj) row.currency = obj.currency;
  if ('status' in obj) row.status = obj.status;
  if ('paidAt' in obj) row.paid_at = obj.paidAt;
  if ('paidAmount' in obj) row.paid_amount = obj.paidAmount;
  if ('markedPaidBy' in obj) row.marked_paid_by = obj.markedPaidBy;
  if ('remindersSent' in obj) row.reminders_sent = obj.remindersSent;
  if ('notes' in obj) row.notes = obj.notes;
  return row;
}
