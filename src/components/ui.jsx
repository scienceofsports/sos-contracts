import React from 'react';
import { STATUS_BADGE } from '../lib/constants.js';

/* =========================================================================
   SHARED UI COMPONENTS
   ========================================================================= */
export function Badge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.draft;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.bg} ${s.text}`}>{status ? status.replace('_',' ') : '—'}</span>;
}

// How many signing links have been issued for a contract. Counts from 1, so a
// blank chip always means "never sent" and the number always means "links
// issued". Stays quiet at 1× (normal) and warms up from the 2nd link on —
// a club on its 3rd link is a different conversation from a fresh send.
export function SendCountChip({ count }) {
  const n = Number(count) || 0;
  if (n < 1) return null;
  const tone = n >= 3 ? 'bg-red-50 text-red-600'
    : n === 2 ? 'bg-amber-50 text-amber-700'
    : 'bg-slate-100 text-slate-500';
  return (
    <span
      title={`${n} signing link${n === 1 ? '' : 's'} issued for this contract`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-data font-medium ${tone}`}
    >{n}×</span>
  );
}

export function Skeleton({ className }) {
  return <div className={`skeleton rounded ${className||'h-4 w-full'}`}></div>;
}

export function EmptyState({ title, subtitle, ctaLabel, onCta, icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-4">{icon || '📄'}</div>
      <div className="font-heading text-slate-700">{title}</div>
      {subtitle && <div className="text-sm text-slate-500 mt-1 max-w-sm">{subtitle}</div>}
      {ctaLabel && <button onClick={onCta} className="mt-5 px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">{ctaLabel}</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose}></div>
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${size || 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="font-heading">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button onClick={onConfirm} className={`px-4 py-2 text-sm rounded-lg text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--blue-primary)] hover:bg-blue-700'}`}>{confirmLabel || 'Confirm'}</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

export function Field({ label, error, warning, children, required }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {!error && warning && <p className="text-xs text-amber-600 mt-1">{warning}</p>}
    </div>
  );
}

export const inputCls = (error) => `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 ${error ? 'border-red-400' : 'border-[var(--border)] focus:border-blue-400'}`;
