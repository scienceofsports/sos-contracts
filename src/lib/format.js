import { CURRENCY_SYMBOL } from './constants.js';

/* =========================================================================
   UTILITIES
   ========================================================================= */
export function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

export function nowISO() { return new Date().toISOString(); }

export function fmtDate(iso, fmt) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} UTC`;
}

export function fmtMoney(amount, currency) {
  const sym = CURRENCY_SYMBOL[currency] || '';
  const n = Number(amount || 0);
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
}

export function daysBetween(a, b) {
  const MS = 1000*60*60*24;
  return Math.round((new Date(b) - new Date(a)) / MS);
}

export async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

// --- Company-identifier format checks (used to WARN, never to block a signing).
// Cyprus VAT is CY + 8 digits + 1 trailing letter (e.g. CY60030297Y). For any
// other country we accept a looser "alphanumeric, reasonable length" shape so a
// legitimate foreign entity is never rejected — the ceiling is generous enough
// for the longest national formats (e.g. Saudi Arabia's 15-digit VAT number).
export function looksLikeVatNumber(vat, country) {
  const v = (vat || '').replace(/[\s-]/g, '').toUpperCase();
  if (!v) return false;
  if (isCyprus(country) || v.startsWith('CY')) return /^CY\d{8}[A-Z]$/.test(v);
  return /^[A-Z]{0,3}[0-9A-Z]{6,17}$/.test(v);
}

// Cyprus company registration numbers look like HE449875 (HE + digits).
// Elsewhere we only require digits (optionally with a short letter prefix).
export function looksLikeRegistrationNumber(reg, country) {
  const r = (reg || '').replace(/[\s-]/g, '').toUpperCase();
  if (!r) return false;
  if (isCyprus(country) || /^HE/.test(r)) return /^HE\d{4,9}$/.test(r);
  return /^[A-Z]{0,4}\d{3,12}$/.test(r);
}

function isCyprus(country) {
  const c = (country || '').trim().toLowerCase();
  return !c || c === 'cyprus' || c === 'cy' || c === 'κύπρος';
}

/* VAT logic */
// Compute VAT for a payment amount. When `inclusive` is true, `amount` is
// treated as the VAT-INCLUSIVE (gross) figure the client agreed to pay — the
// net and VAT are back-calculated OUT of it (net = gross ÷ 1.19), so the client
// pays the round number while VAT is still charged and remitted. When false
// (default), `amount` is net and VAT is added on top. The returned `amount` is
// always the NET line amount, and `vatAmount` the tax, so callers can build
// { amount, vatAmount, totalAmount: amount + vatAmount } consistently.
export function computeVAT(client, amount, inclusive = false) {
  const gross = Number(amount) || 0;
  // Resolve the applicable rate + any note from the client's location/status.
  let rate = 0, note = '';
  if (!client) { rate = 0; }
  else {
    const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
    if (client.country === 'CY') rate = 0.19;
    else if (EU_COUNTRIES.includes(client.country) && client.vatNumber) { rate = 0; note = 'VAT reverse charge applies (Article 196, EU VAT Directive).'; }
    else if (EU_COUNTRIES.includes(client.country)) rate = 0.19;
    else { rate = 0; note = 'Outside scope of VAT.'; }
  }

  if (rate === 0) return { vatRate: 0, vatAmount: 0, netAmount: round2(gross), note };

  if (inclusive) {
    // `amount` is the agreed gross; split net + VAT out of it.
    const net = round2(gross / (1 + rate));
    const vat = round2(gross - net);
    return { vatRate: rate, vatAmount: vat, netAmount: net, note };
  }
  // `amount` is net; VAT added on top.
  return { vatRate: rate, vatAmount: round2(gross * rate), netAmount: round2(gross), note };
}
export function round2(n) { return Math.round(n * 100) / 100; }

// Effective payment status, computed live: a pending payment whose due date has
// passed counts as 'overdue' everywhere it's shown or summed — no cron needed.
// Explicit statuses (paid, disputed, overdue) are respected as-is.
export function effectiveStatus(payment) {
  if (!payment) return 'pending';
  const s = payment.status || 'pending';
  // A forecast row (migration 0025) can never be overdue: its date is a
  // projection of when billing is expected, not a due date anyone agreed to.
  // Nothing has been invoiced, so there is nothing for the client to be late on.
  if (payment.isEstimate) return s === 'paid' ? 'paid' : 'pending';
  if (s === 'pending' && payment.dueDate && new Date(payment.dueDate) < new Date()) return 'overdue';
  return s;
}

// Whole days a payment is past due (0 if not overdue). Positive = late.
export function daysOverdue(payment) {
  if (effectiveStatus(payment) !== 'overdue' || !payment?.dueDate) return 0;
  return Math.floor((Date.now() - new Date(payment.dueDate).getTime()) / 86400000);
}

// How many days a signing link stays valid after a contract is sent.
export const SIGNING_LINK_DAYS = 7;

// Effective contract status, computed live: a 'sent' contract whose 7-day
// signing link has lapsed reads as 'expired' everywhere in the admin UI — no
// cron needed. Every other status is respected as-is. The signing page itself
// enforces expiry server-side; this is purely the admin-side view.
export function effectiveContractStatus(contract) {
  if (!contract) return 'draft';
  const s = contract.status || 'draft';
  if (s === 'sent' && contract.sentAt) {
    const expiry = new Date(contract.sentAt).getTime() + SIGNING_LINK_DAYS * 86400000;
    if (Date.now() > expiry) return 'expired';
  }
  return s;
}

/* ---------------------------------------------------------------------------
   Revenue basis — ONE definition of "what a contract is worth per year"
   ---------------------------------------------------------------------------
   These four live here, not in a component, because every revenue panel on the
   board must agree permanently. The dashboard hero card, the Agreements
   Overview tiers and the Client Operations Overview all call netAnnualised, so
   a change to the basis moves all of them together. Previously netAnnualised
   was defined inside Dashboard() and only two of its three consumers used it,
   which is how the ops table drifted onto a gross, non-annualised basis while
   still being labelled "ex-VAT".
--------------------------------------------------------------------------- */

// Term length of a contract in years (>= 1), from its start/end dates. Falls
// back to 1 year when dates are missing, so a value is never divided by 0.
export function contractTermYears(contract) {
  if (!contract?.startDate || !contract?.endDate) return 1;
  const days = daysBetween(contract.startDate, contract.endDate);
  if (!(days > 0)) return 1;
  return Math.max(1, days / 365);
}

// The per-YEAR value of a contract = total contract value ÷ term years. This is
// what "annual revenue" views should sum, so a 3-year €164,500 deal contributes
// ~€54,833/yr rather than distorting the annual figure with its whole lifetime
// total. Rounded to cents.
//
// If a contract carries a manual `annualValueOverride` (a display-only reporting
// figure — see migration 0019), that pinned amount wins. Use it when a clean
// yearly deal's dates don't land on a whole number of 365-day years, so the
// run-rate reads e.g. €47,000 instead of €47,277.56. The override never changes
// the signed value/dates — only what these annualised views report.
export function annualisedValue(contract) {
  const override = Number(contract?.annualValueOverride);
  if (Number.isFinite(override) && override > 0) return round2(override);
  return round2(Number(contract?.value || 0) / contractTermYears(contract));
}

// The NET (ex-VAT) portion of what was actually received for a payment. Revenue
// / income figures use this — VAT collected isn't income, it's passed to the tax
// office. Split by the payment's net:gross ratio so it's correct for partial
// payments and VAT-exempt rows. Money-OWED figures (receivables) stay gross.
export function netReceived(payment) {
  const gross = Number(payment?.totalAmount || 0);
  const net = Number(payment?.amount != null ? payment.amount : gross);
  const received = Number(payment?.paidAmount || 0);
  if (gross > 0 && net >= 0) return round2(received * (net / gross));
  return received;
}

// Annual run-rate of a contract, NET of VAT — the canonical revenue figure.
// For a VAT-inclusive deal VAT is backed out of the gross; a net (ex-VAT) value
// is unchanged. On a player-funded / shared deal only the club fixed fee carries
// VAT, so VAT comes out of the vatable portion only (the player-funded remainder
// is already VAT-free).
//
// `vatSplitFn` is injected rather than imported: format.js sits below
// constants.js in the dependency order, and importing vatSplit here would make
// the two modules circular. Callers pass it in.
export function netAnnualised(contract, client, vatSplitFn) {
  const annual = annualisedValue(contract);
  const split = vatSplitFn ? vatSplitFn(contract) : null;
  if (!split) {
    const v = computeVAT(client, annual, contract?.vatInclusive);
    return round2(v.netAmount != null ? v.netAmount : annual);
  }
  // Scale the split to the annualised figure (annual may be value ÷ term years).
  const factor = Number(contract?.value) > 0 ? annual / Number(contract.value) : 1;
  const vatablePart = round2(split.vatableNet * factor);
  const exemptPart = round2(annual - vatablePart);
  const v = computeVAT(client, vatablePart, contract?.vatInclusive);
  const net = v.netAmount != null ? v.netAmount : vatablePart;
  return round2(net + exemptPart);
}

// AR aging bucket for a payment, by days past due. 'current' = not yet overdue.
// Buckets follow the standard accounts-receivable aging: 1–30 / 31–60 / 61–90 / 90+.
export function agingBucket(payment) {
  const d = daysOverdue(payment);
  if (d <= 0) return 'current';
  if (d <= 30) return 'd1_30';
  if (d <= 60) return 'd31_60';
  if (d <= 90) return 'd61_90';
  return 'd90_plus';
}

export const AGING_LABELS = {
  current: 'Current',
  d1_30: '1–30 days',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: '90+ days',
};

/* ---------------------------------------------------------------------------
   Financial year + receivable horizons

   SCIOS's financial year ends 30 June, so FY2027 = 01/07/2026 → 30/06/2027.
   We label a year by the calendar year it ENDS in, matching how the accounts
   are filed.
   --------------------------------------------------------------------------- */
export const FY_END_MONTH = 6; // June (1-based); the FY closes on the 30th.

// The financial year a date falls in, labelled by its ending calendar year.
export function financialYearOf(date) {
  const d = new Date(date);
  if (isNaN(d)) return null;
  // Jan–Jun belong to the FY ending this calendar year; Jul–Dec to the next.
  return d.getMonth() + 1 <= FY_END_MONTH ? d.getFullYear() : d.getFullYear() + 1;
}

// First instant of a financial year (00:00 on 1 July of the preceding year).
export function financialYearStart(fy) { return new Date(fy - 1, FY_END_MONTH, 1); }
// Exclusive end of a financial year (00:00 on 1 July of the ending year).
export function financialYearEnd(fy) { return new Date(fy, FY_END_MONTH, 1); }

// "FY26/27" — how the year reads on a board pack.
export function financialYearLabel(fy) {
  if (fy == null) return '—';
  return `FY${String(fy - 1).slice(-2)}/${String(fy).slice(-2)}`;
}

// Which collection horizon a payment sits in. This is the distinction that
// keeps a receivable (money you can chase today) apart from contracted backlog
// (signed money that simply isn't due yet):
//   overdue  — past its due date
//   due_30   — falls due within the next 30 days
//   this_fy  — due later, but still inside the current financial year
//   future   — due in a later financial year; NOT a receivable
export function receivableHorizon(payment, now = new Date()) {
  if (effectiveStatus(payment) === 'overdue') return 'overdue';
  if (!payment?.dueDate) return 'this_fy';
  const due = new Date(payment.dueDate);
  if (isNaN(due)) return 'this_fy';
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days <= 30) return 'due_30';
  return financialYearOf(due) > financialYearOf(now) ? 'future' : 'this_fy';
}

export const HORIZON_LABELS = {
  overdue: 'Overdue',
  due_30: 'Due in 30 days',
  this_fy: 'Later this FY',
  future: 'Future years',
};

// Serialize an array of row objects to a CSV string. `columns` is an array of
// { key, label } (or { label, value: row=>… } for computed cells). Values are
// quoted and internal quotes doubled, per RFC 4180.
export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => esc(c.value ? c.value(row) : row[c.key])).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

// Trigger a browser download of `content` as a file named `filename`.
export function downloadFile(content, filename, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
