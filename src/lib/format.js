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
export function computeVAT(client, amount) {
  if (!client) return { vatRate: 0, vatAmount: 0, note: '' };
  if (client.country === 'CY') {
    return { vatRate: 0.19, vatAmount: round2(amount * 0.19), note: '' };
  }
  const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  if (EU_COUNTRIES.includes(client.country) && client.vatNumber) {
    return { vatRate: 0, vatAmount: 0, note: 'VAT reverse charge applies (Article 196, EU VAT Directive).' };
  }
  if (EU_COUNTRIES.includes(client.country)) {
    return { vatRate: 0.19, vatAmount: round2(amount * 0.19), note: '' };
  }
  return { vatRate: 0, vatAmount: 0, note: 'Outside scope of VAT.' };
}
export function round2(n) { return Math.round(n * 100) / 100; }
