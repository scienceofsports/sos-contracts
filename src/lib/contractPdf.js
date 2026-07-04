/* =========================================================================
   Client-side contract PDF generator (jsPDF).
   Produces a clean, readable A4 PDF of the contract for the signer to
   download, read, keep, or forward. This is the human-readable agreement —
   the tamper-evident Certificate of Completion (with signature evidence) is
   generated server-side after signing.

   IMPORTANT: The clause wording below is kept in sync with the canonical
   ContractDocumentBody component in App.jsx. Both must read the same to a
   human. If you change a clause here, change it there too (and vice versa).
   ========================================================================= */
import { jsPDF } from 'jspdf';
import { fmtDate, fmtMoney, daysBetween } from './format.js';
import { computeServiceLineItems, platformSeatsSummary } from './constants.js';

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
  // SCIOS brand colours (RGB)
  const NAVY = [10, 26, 63];
  const CYAN = [34, 199, 230];
  const rule = () => { ensure(12); doc.setDrawColor(220, 224, 230); doc.line(M, y, W - M, y); y += 12; };
  // Numbered clause heading (navy) + one or more body paragraphs.
  const clause = (heading, ...paras) => {
    text(heading, { size: 11, style: 'bold', color: NAVY, gap: 2 });
    paras.forEach((p, i) => text(p, { size: 10, gap: i === paras.length - 1 ? 8 : 4 }));
  };

  const lineItems = contract.services ? computeServiceLineItems(contract.services) : [];
  const termYears = contract.startDate && contract.endDate
    ? Math.max(1, Math.round(daysBetween(contract.startDate, contract.endDate) / 365)) : null;

  // Navy header band + signature rainbow hairline
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 62, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SCIENCE OF SPORTS', M, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CYAN);
  doc.text(contract.contractNumber || '', W - M, 34, { align: 'right' });
  // Rainbow strip (approximated with four coloured segments)
  const segs = [[34,199,230],[37,99,235],[139,92,246],[236,72,153]];
  const segW = W / segs.length;
  segs.forEach((c, i) => { doc.setFillColor(...c); doc.rect(i * segW, 62, segW, 3, 'F'); });
  y = 92;

  text((contract.title || 'Service Agreement').toUpperCase(), { size: 15, style: 'bold', color: NAVY, gap: 6 });
  rule();

  // Preamble — both parties, full details (mirrors ContractDocumentBody).
  text(`This Agreement is made on ${fmtDate(contract.createdAt)} between:`, { size: 10, gap: 4 });
  text(`${company?.name || '—'}, a company registered under the laws of the Republic of Cyprus with registration number ${company?.registrationNumber || '—'}, VAT number ${company?.vatNumber || '—'}, having its registered office at ${company?.registeredAddress || '—'} (the "Service Provider"),`, { size: 10, gap: 2 });
  text('and', { size: 10, gap: 2 });
  text(`${client?.companyName || '—'}, ${client?.registrationNumber ? `a company registered with registration number ${client.registrationNumber}, ` : ''}having its registered office at ${client?.address || '[address]'} (the "Client").`, { size: 10, gap: 2 });
  text('The above are hereinafter jointly referred to as the "Parties".', { size: 10, gap: 6 });
  rule();

  // Numbered clauses — same numbering logic as ContractDocumentBody.
  let n = 1;
  const purposeNum = n++;
  const scopeNum = lineItems.length > 0 ? n++ : null;
  const feesNum = n++;
  const confidentialityNum = n++;
  const ipNum = n++;
  const durationNum = n++;
  const terminationNum = n++;
  const liabilityNum = n++;
  const forceMajeureNum = n++;
  const governingLawNum = n++;
  const specialTermsNum = (contract.specialTerms && contract.specialTerms.trim()) ? n++ : null;
  const entireAgreementNum = n++;

  clause(`${purposeNum}. Purpose`,
    contract.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.');

  if (scopeNum) {
    text(`${scopeNum}. Scope of Services`, { size: 11, style: 'bold', color: [15, 23, 42], gap: 4 });
    lineItems.forEach(i => {
      const qty = i.unit === 'flat' ? '—' : (i.unit === 'included' || i.complimentary || i.bundledIncluded) ? 'Included' : String(i.qty);
      let label = `• ${i.label}`;
      if (i.key === 'platform_access' && platformSeatsSummary(contract.services.platform_access)) {
        label += ` — Access: ${platformSeatsSummary(contract.services.platform_access)} (exact users to be confirmed with the client)`;
      }
      text(`${label}   [${qty}]`, { size: 10 });
    });
    text(`Total Contract Value: ${fmtMoney(contract.value, contract.currency)}`, { size: 10, style: 'bold', gap: 8 });
  }

  clause(`${feesNum}. Fees & Payment`,
    `In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of ${fmtMoney(contract.value, contract.currency)}, payable ${(contract.paymentType || '').replace('_', ' ')}, net ${contract.paymentTermsDays} days from the date of a valid invoice.`,
    `All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of ${contract.latePaymentPenalty}% per month applies to overdue amounts.`);

  clause(`${confidentialityNum}. Confidentiality & Data Protection`,
    'The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.',
    "All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.");

  clause(`${ipNum}. Intellectual Property Rights`,
    'All match footage, training footage, video recordings, reports, analytics outputs, player data, databases, clips and any other materials produced, collected or generated by the Service Provider under this Agreement (collectively, the "Deliverables") shall be the exclusive property of the Client. The Client shall have unrestricted, irrevocable and royalty-free rights to use, reproduce, store, modify, distribute and archive the Deliverables for any internal purpose. The Service Provider shall not use, reproduce, disclose, commercialize or share any Deliverables with any third party without the Client\'s prior written consent.');

  clause(`${durationNum}. Duration`,
    `This Agreement shall commence on ${fmtDate(contract.startDate)} and shall remain in force until ${fmtDate(contract.endDate)}${termYears ? ` (approximately ${termYears} year${termYears > 1 ? 's' : ''})` : ''}, unless terminated earlier in accordance with Section ${terminationNum}.`);

  clause(`${terminationNum}. Termination`,
    "Either Party may terminate this Agreement with three (3) months' written notice, or immediately in the event of a material breach not remedied within thirty (30) days.",
    'Upon termination or expiration of this Agreement for any reason, the Service Provider shall promptly deliver to the Client all Deliverables produced under this Agreement.');

  clause(`${liabilityNum}. Limitation of Liability`,
    "The Service Provider shall not be responsible for sporting results, team selection decisions, or competition outcomes. Total liability under this Agreement shall not exceed the fees paid during the preceding twelve (12) months. This limitation shall not apply to breaches of confidentiality, data protection obligations, or unauthorized use of the Client's data or intellectual property.");

  clause(`${forceMajeureNum}. Force Majeure`,
    'Neither Party shall be liable for failure to perform due to events beyond reasonable control.');

  clause(`${governingLawNum}. Governing Law & Jurisdiction`,
    `This Agreement shall be governed by the laws of ${contract.governingLaw}, with exclusive jurisdiction in ${contract.jurisdiction}.`);

  if (specialTermsNum) {
    clause(`${specialTermsNum}. Special Terms`, contract.specialTerms);
  }

  clause(`${entireAgreementNum}. Entire Agreement & Amendments`,
    'This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.');

  rule();

  // Signature block
  text('SIGNATURES', { size: 11, style: 'bold', color: NAVY, gap: 6 });
  ensure(60);
  const colW = (maxW - 30) / 2;
  const sigY = y;
  // Service Provider column
  text(`For ${company?.name || '—'}`, { size: 9, color: [100, 110, 120], x: M, width: colW });
  // Client column
  y = sigY;
  text(`For ${client?.companyName || '—'}`, { size: 9, color: [100, 110, 120], x: M + colW + 30, width: colW });
  y = sigY + 40;
  doc.setDrawColor(180, 188, 196);
  doc.line(M, y, M + colW, y);
  doc.line(M + colW + 30, y, M + colW + 30 + colW, y);
  y += 12;
  const clientSigLine = contract.signedAt
    ? `${contract.signerName || ''}${contract.signerTitle ? ' · ' + contract.signerTitle : ''} · ${fmtDate(contract.signedAt)}`
    : 'Name / Title / Date';
  text('Name / Title / Date', { size: 8, color: [140, 148, 156], x: M, width: colW });
  y -= 12;
  text(clientSigLine, { size: 8, color: [140, 148, 156], x: M + colW + 30, width: colW, gap: 6 });
  rule();

  // Signature note
  text('This document is provided for review. To execute it, the Client signs electronically through the secure signing link. Upon signing, a Certificate of Completion containing the full signature evidence is issued to both parties.', { size: 9, color: [120, 130, 140] });

  // Branded navy footer band on every page.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY);
    doc.rect(0, H - 34, W, 34, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('C.C. Science of Sports Ltd', M, H - 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(169, 182, 204);
    doc.text('info@scienceofsports.net · +357 22 396997 · HE 449875', M, H - 10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...CYAN);
    doc.text('Transforming matches into knowledge.', W - M, H - 14, { align: 'right' });
  }

  return doc;
}

// Convenience: trigger a browser download of the contract PDF.
export function downloadContractPdf({ contract, client, company }) {
  const doc = generateContractPdf({ contract, client, company });
  doc.save(`${contract.contractNumber || 'contract'}.pdf`);
}
