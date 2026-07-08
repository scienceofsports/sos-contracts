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
