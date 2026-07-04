// ============================================================================
// Certificate of Completion — generates a locked PDF evidence document using
// pdf-lib (pure JS, runs in the Edge/Deno runtime). The PDF embeds the parties,
// the signed contract terms, the signature image, the full evidence bundle
// (OTP-verified email, server timestamp, IP, user-agent, consents) and the
// document hash. Returns the PDF bytes + its SHA-256.
// ============================================================================
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { sha256Hex } from './evidence.ts';

const NAVY = rgb(0.039, 0.102, 0.247);   // #0A1A3F
const CYAN = rgb(0.133, 0.780, 0.902);   // #22C7E6
const BLUE = rgb(0.145, 0.388, 0.922);
const GREY = rgb(0.4, 0.45, 0.5);
const BLACK = rgb(0.06, 0.09, 0.16);

// deno-lint-ignore no-explicit-any
type Any = any;

function money(value: Any, currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : (currency ? currency + ' ' : '');
  const n = Number(value || 0);
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildCertificate(input: {
  snapshot: { contract: Any; client: Any; company: Any };
  signer: {
    name: string; title: string; company: string; email: string;
    ip: string | null; userAgent: string | null; signedAt: string;
    consentElectronic: boolean; consentAuthorized: boolean; consentRead: boolean;
  };
  documentHashBefore: string;
  documentHashAfter: string;
  integrityOk: boolean;
  signatureImageBytes: Uint8Array | null;
  contractNumber: string;
}): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { snapshot, signer } = input;
  const c = snapshot.contract || {};
  const cl = snapshot.client || {};
  const co = snapshot.company || {};

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]); // A4 portrait
  const M = 50;
  let y = 792;

  const line = (text: string, opts: { size?: number; f?: Any; color?: Any; gap?: number; x?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    page.drawText(text ?? '', { x: opts.x ?? M, y, size, font: f, color: opts.color ?? BLACK });
    y -= (opts.gap ?? size + 6);
  };
  const gap = (n: number) => { y -= n; };
  const rule = () => { page.drawLine({ start: { x: M, y: y + 4 }, end: { x: 545, y: y + 4 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) }); y -= 8; };
  const ensure = (need: number) => { if (y < need) { page = pdf.addPage([595, 842]); y = 792; } };

  // Navy header band + brand wordmark + signature rainbow hairline
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: NAVY });
  page.drawText('CERTIFICATE OF COMPLETION', { x: M, y: 816, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText('SCIENCE OF SPORTS', { x: 595 - M - 130, y: 816, size: 9, font: bold, color: CYAN });
  // Rainbow strip (four segments)
  const rseg = [rgb(0.133,0.780,0.902), rgb(0.145,0.388,0.922), rgb(0.545,0.361,0.965), rgb(0.925,0.282,0.6)];
  const rsw = 595 / rseg.length;
  rseg.forEach((col, i) => page.drawRectangle({ x: i * rsw, y: 796, width: rsw, height: 4, color: col }));
  y = 770;

  line('Science of Sports — Electronic Signature Record', { size: 11, f: bold, color: NAVY });
  line(`Contract: ${input.contractNumber}  ·  ${c.title ?? ''}`, { size: 10, color: GREY });
  gap(4); rule();

  // Parties
  line('PARTIES', { size: 10, f: bold, color: CYAN });
  line(`Service Provider: ${co.name ?? '—'}`, { size: 10 });
  if (co.registrationNumber ?? co.registration_number) line(`  Reg. No: ${co.registrationNumber ?? co.registration_number}   VAT: ${co.vatNumber ?? co.vat_number ?? '—'}`, { size: 9, color: GREY });
  line(`Client: ${cl.companyName ?? cl.company_name ?? '—'}`, { size: 10 });
  if (cl.registrationNumber ?? cl.registration_number) line(`  Reg. No: ${cl.registrationNumber ?? cl.registration_number}   VAT: ${cl.vatNumber ?? cl.vat_number ?? '—'}`, { size: 9, color: GREY });
  gap(4); rule();

  // Key terms
  line('KEY TERMS', { size: 10, f: bold, color: CYAN });
  line(`Value: ${money(c.value, c.currency || 'EUR')}    Type: ${c.type ?? '—'}`, { size: 10 });
  line(`Term: ${c.startDate ?? c.start_date ?? '—'} to ${c.endDate ?? c.end_date ?? '—'}`, { size: 10 });
  line(`Governing Law: ${c.governingLaw ?? c.governing_law ?? '—'}`, { size: 10 });
  gap(4); rule();

  // Signer / evidence
  line('SIGNATORY & EVIDENCE', { size: 10, f: bold, color: CYAN });
  line(`Signed by: ${signer.name}${signer.title ? ', ' + signer.title : ''}`, { size: 10 });
  line(`On behalf of: ${signer.company || (cl.companyName ?? cl.company_name ?? '')}`, { size: 10 });
  line(`Email (verified by one-time code): ${signer.email}`, { size: 10 });
  line(`Server timestamp (UTC): ${signer.signedAt}`, { size: 10 });
  line(`Signer IP address: ${signer.ip ?? 'not recorded'}`, { size: 10 });
  if (signer.userAgent) {
    const ua = signer.userAgent.length > 90 ? signer.userAgent.slice(0, 90) + '…' : signer.userAgent;
    line(`Device / browser: ${ua}`, { size: 8, color: GREY });
  }
  gap(2);
  line(`Consents: electronic signing [${signer.consentElectronic ? 'YES' : 'no'}]  authorised [${signer.consentAuthorized ? 'YES' : 'no'}]  read & agreed [${signer.consentRead ? 'YES' : 'no'}]`, { size: 9, color: GREY });
  gap(4); rule();

  // Document integrity
  line('DOCUMENT INTEGRITY (SHA-256)', { size: 10, f: bold, color: CYAN });
  line(`At send:  ${input.documentHashBefore}`, { size: 7, f: font, color: GREY });
  line(`At sign:  ${input.documentHashAfter}`, { size: 7, f: font, color: GREY });
  line(input.integrityOk ? 'Integrity verified — the document was not altered between sending and signing.'
                         : 'WARNING — the document hash changed between sending and signing.',
       { size: 9, f: bold, color: input.integrityOk ? rgb(0.06, 0.5, 0.3) : rgb(0.8, 0.1, 0.1) });
  gap(6); rule();

  // Signature image
  ensure(180);
  line('SIGNATURE', { size: 10, f: bold, color: CYAN });
  if (input.signatureImageBytes) {
    try {
      const img = await pdf.embedPng(input.signatureImageBytes);
      const scaled = img.scaleToFit(220, 90);
      page.drawRectangle({ x: M, y: y - 96, width: 240, height: 96, borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 0.5 });
      page.drawImage(img, { x: M + 10, y: y - 92, width: scaled.width, height: scaled.height });
      y -= 106;
    } catch (_) {
      line('[signature image could not be embedded]', { size: 8, color: GREY });
    }
  }
  line(`${signer.name}`, { size: 10, f: bold });
  gap(10); rule();

  // Legal footer
  ensure(90);
  line('LEGAL BASIS', { size: 10, f: bold, color: CYAN });
  const legal = 'This document is an electronic record of a Simple Electronic Signature executed under Regulation (EU) No 910/2014 (eIDAS). The signatory verified control of the email address above via a one-time code, consented to sign electronically, and confirmed authority to bind their organisation. This certificate, together with the tamper-evident audit trail retained by Science of Sports, constitutes evidence of the agreement.';
  const words = legal.split(' ');
  let lineStr = '';
  for (const w of words) {
    if ((lineStr + ' ' + w).length > 95) { line(lineStr, { size: 8, color: GREY, gap: 11 }); lineStr = w; }
    else lineStr = lineStr ? lineStr + ' ' + w : w;
  }
  if (lineStr) line(lineStr, { size: 8, color: GREY, gap: 11 });

  const bytes = await pdf.save();
  const hex = await sha256Hex(Array.from(bytes).map((b) => String.fromCharCode(b)).join(''));
  return { bytes, sha256: hex };
}
