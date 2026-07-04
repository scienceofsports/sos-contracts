/* =========================================================================
   Client-side contract PDF generator (jsPDF).
   Produces a clean, readable A4 PDF of the contract for the signer to
   download, read, keep, or forward. This is the human-readable agreement —
   the tamper-evident Certificate of Completion (with signature evidence) is
   generated server-side after signing.
   ========================================================================= */
import { jsPDF } from 'jspdf';
import { fmtDate, fmtMoney } from './format.js';

export function generateContractPdf({ contract, client, company }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const maxW = W - M * 2;
  let y = M;

  const ensure = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
  const text = (str, opts = {}) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? 'normal';
    const color = opts.color ?? [30, 34, 45];
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(str ?? '', opts.width ?? maxW);
    for (const ln of lines) {
      ensure(size + 4);
      doc.text(ln, opts.x ?? M, y);
      y += size + 4;
    }
    if (opts.gap) y += opts.gap;
  };
  const rule = () => { ensure(12); doc.setDrawColor(220, 224, 230); doc.line(M, y, W - M, y); y += 12; };

  // Header band
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 60, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SCIENCE OF SPORTS', M, 38);
  y = 90;

  text(contract.title || 'Service Agreement', { size: 15, style: 'bold', color: [10, 22, 40], gap: 2 });
  text(`${contract.contractNumber || ''}`, { size: 9, color: [120, 130, 140], gap: 6 });
  rule();

  // Parties
  text('PARTIES', { size: 10, style: 'bold', color: [37, 99, 235], gap: 2 });
  text(`Service Provider: ${company?.name || '—'}`, { size: 10 });
  if (company?.registrationNumber || company?.vatNumber) {
    text(`Reg. No: ${company?.registrationNumber || '—'}   VAT: ${company?.vatNumber || '—'}`, { size: 9, color: [120, 130, 140] });
  }
  if (company?.registeredAddress) text(`Address: ${company.registeredAddress}`, { size: 9, color: [120, 130, 140] });
  text(`Client: ${client?.companyName || '—'}`, { size: 10 });
  if (client?.registrationNumber || client?.vatNumber) {
    text(`Reg. No: ${client?.registrationNumber || '—'}   VAT: ${client?.vatNumber || '—'}`, { size: 9, color: [120, 130, 140] });
  }
  if (client?.address) text(`Address: ${client.address}`, { size: 9, color: [120, 130, 140], gap: 4 });
  rule();

  // Key terms
  text('KEY TERMS', { size: 10, style: 'bold', color: [37, 99, 235], gap: 2 });
  text(`Contract Value: ${fmtMoney(contract.value, contract.currency)}  (${(contract.paymentType || '').replace('_', ' ')}, net ${contract.paymentTermsDays || 30} days)`, { size: 10 });
  text(`Term: ${fmtDate(contract.startDate)} to ${fmtDate(contract.endDate)}`, { size: 10 });
  if (contract.latePaymentPenalty != null) text(`Late Payment: ${contract.latePaymentPenalty}% per month on overdue amounts`, { size: 10 });
  text(`Governing Law: ${contract.governingLaw || '—'}${contract.jurisdiction ? ` (jurisdiction: ${contract.jurisdiction})` : ''}`, { size: 10, gap: 4 });
  rule();

  // Scope / description
  if (contract.description) {
    text('SCOPE OF SERVICES', { size: 10, style: 'bold', color: [37, 99, 235], gap: 2 });
    text(contract.description, { size: 10, gap: 4 });
    rule();
  }

  // Special terms
  if (contract.specialTerms && contract.specialTerms.trim()) {
    text('SPECIAL TERMS', { size: 10, style: 'bold', color: [37, 99, 235], gap: 2 });
    text(contract.specialTerms, { size: 10, gap: 4 });
    rule();
  }

  // Standard clauses
  text('GENERAL TERMS', { size: 10, style: 'bold', color: [37, 99, 235], gap: 2 });
  text('Confidentiality & Data Protection: Both parties agree to keep confidential all data shared under this agreement and to use analytical outputs solely for internal performance purposes unless otherwise agreed in writing, in compliance with the GDPR (Reg. (EU) 2016/679) and Cyprus Law 125(I)/2018.', { size: 10 });
  text('Duration & Termination: This agreement runs for the term stated above and may be terminated by either party with 30 days’ written notice. Outstanding invoices remain payable regardless of termination.', { size: 10 });
  text('Governing Law & Jurisdiction: This agreement is governed by the law stated above, and the parties submit to the exclusive jurisdiction of its courts.', { size: 10, gap: 6 });
  rule();

  // Signature note
  text('This document is provided for review. To execute it, the Client signs electronically through the secure signing link. Upon signing, a Certificate of Completion containing the full signature evidence is issued to both parties.', { size: 9, color: [120, 130, 140] });

  return doc;
}

// Convenience: trigger a browser download of the contract PDF.
export function downloadContractPdf({ contract, client, company }) {
  const doc = generateContractPdf({ contract, client, company });
  doc.save(`${contract.contractNumber || 'contract'}.pdf`);
}
