// ============================================================================
// Signed Contract PDF — server-side (pdf-lib / Deno) reproduction of the
// human-readable contract, generated AFTER signing so it carries BOTH parties'
// signatures (SOS authorised signatory + the client's actual drawn signature).
//
// This mirrors the canonical ContractDocumentBody in App.jsx — same clause
// wording, same structure, and now the same PREMIUM LOOK: navy header band with
// the two-logo lockup, a rainbow hairline, navy "pill" section headers with
// cyan clause numbers, cyan service-group subheadings, "Included" chips, a
// tinted bank-details box, a two-column signature block with real signature
// IMAGES, and a navy footer with the cyan italic tagline.
//
// The snapshot is the FROZEN document_snapshot: raw DB rows (snake_case). A
// small `pick()` helper reads snake OR camel so this stays robust.
// ============================================================================
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { sha256Hex } from './evidence.ts';

const NAVY = rgb(0.039, 0.102, 0.247);   // #0A1A3F
const CYAN = rgb(0.133, 0.780, 0.902);   // #22C7E6
const CYAN_DEEP = rgb(0.059, 0.710, 0.839); // #0FB5D6 (chip text / subheadings)
const GREY = rgb(0.4, 0.45, 0.5);
const BLACK = rgb(0.118, 0.133, 0.176);  // #1E222D (matches jsPDF body colour)
const SOFT_GREY = rgb(0.31, 0.35, 0.39);
const WHITE = rgb(1, 1, 1);
const CHIP_BG = rgb(0.906, 0.973, 0.988);   // light-cyan chip fill (approx rgba(34,199,230,.15) on white)
const BOX_BG = rgb(0.96, 0.968, 0.976);     // subtle navy tint for boxes
const BOX_BORDER = rgb(0.82, 0.85, 0.89);
const FOOTER_GREY = rgb(0.663, 0.714, 0.8); // #A9B6CC

// Rainbow strip segments (cyan #22C7E6, blue #2563EB, purple #8B5CF6, pink #EC4899)
const RAINBOW = [rgb(0.133, 0.780, 0.902), rgb(0.145, 0.388, 0.922), rgb(0.545, 0.361, 0.965), rgb(0.925, 0.282, 0.6)];

// deno-lint-ignore no-explicit-any
type Any = any;

// Read a value by any of the given keys (snake or camel), first non-empty wins.
function pick(obj: Any, ...keys: string[]): Any {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', AED: 'AED ', USD: '$' };
function fmtMoney(amount: Any, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] || '';
  const n = Number(amount || 0);
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Local DD/MM/YYYY formatter from an ISO string.
function fmtDate(iso: Any): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function daysBetween(a: Any, b: Any): number {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS);
}

// ---------------------------------------------------------------------------
// Minimal port of the SERVICE_CATALOG + grouping logic from src/lib/constants.js
// (only the data the PDF needs: key, label, group, unit, defaultRate, detail).
// ---------------------------------------------------------------------------
const SERVICE_CATALOG: Array<{ key: string; label: string; group: string; unit: string; defaultRate: number; detail: string }> = [
  { key: 'platform_access', label: 'Access to Football Platform', group: 'Core Services', unit: 'flat', defaultRate: 11500,
    detail: 'Video + data combined, match events & clips, player comparisons, team & player rankings — everything accessible in one place.' },
  { key: 'camera_installation', label: 'Installation of Fixed Camera', group: 'Recording Services', unit: 'per_unit', defaultRate: 500,
    detail: 'One-off installation of fixed/robotic camera(s) at the club\'s venue, priced per camera.' },
  { key: 'physical_data', label: 'Match Physical Performance Data', group: 'Recording Services', unit: 'per_match', defaultRate: 100,
    detail: 'Match physical data, player load tracking and performance benchmarks to protect players and reduce injury risk.' },
  { key: 'live_broadcasting', label: 'Live Match Broadcasting', group: 'Recording Services', unit: 'per_match', defaultRate: 100,
    detail: 'Matches streamed live for parents, coaches and club management — increasing visibility for the academy.' },
  { key: 'match_recording', label: 'Match Recording (Robotic camera)', group: 'Recording Services', unit: 'per_match', defaultRate: 100,
    detail: 'Fixed/robotic camera recording for home and away matches — professional, high-quality coverage with no club equipment or staff needed.' },
  { key: 'own_team_analysis', label: 'Own Team Tactical Analysis', group: 'Analysis Services', unit: 'per_match', defaultRate: 120,
    detail: 'Team structure analysis, phases of play, and key moments with video clips, prepared by professional performance analysts.' },
  { key: 'opponent_analysis', label: 'Opponent Tactical Analysis', group: 'Analysis Services', unit: 'per_match', defaultRate: 120,
    detail: 'Opponent playing style, key players, and strengths & weaknesses ahead of each fixture.' },
  { key: 'match_reports', label: 'Match Team & Player Reports', group: 'Reporting Services', unit: 'included', defaultRate: 0,
    detail: 'Possession, passes, xG, player performance metrics and visual dashboards, delivered within 24 hours of each match.' },
  { key: 'academy_reports', label: 'Academy Performance Reports', group: 'Reporting Services', unit: 'per_unit', defaultRate: 100,
    detail: 'Quarterly and full-season academy performance overviews — team progress, tactical evolution, physical trends and recommendations (1st Quarter, 2nd Quarter, Full Season).' },
  { key: 'player_reports', label: 'Individual Player Reports', group: 'Reporting Services', unit: 'per_unit', defaultRate: 100,
    detail: 'Detailed player analysis, strengths and improvement areas, with video-supported feedback.' },
  { key: 'adhoc_reports', label: 'Ad-Hoc Reports', group: 'Reporting Services', unit: 'included', defaultRate: 0,
    detail: 'On-demand reports tailored to specific needs, for fast support on key decisions whenever required.' },
  { key: 'coach_support', label: 'One-on-One Coach Support', group: 'Coaching Support', unit: 'included', defaultRate: 0,
    detail: 'Platform guidance, analysis-driven solutions, educational support and custom plans tailored to the academy, delivered across the season.' },
];

const SERVICE_GROUPS = ['Core Services', 'Recording Services', 'Analysis Services', 'Reporting Services', 'Coaching Support'];

// Port of computeServiceLineItems: filter to selected services, resolve qty/rate.
function computeServiceLineItems(services: Any): Array<Any> {
  if (!services || typeof services !== 'object') return [];
  return SERVICE_CATALOG
    .filter((s) => services[s.key] && services[s.key].selected)
    .map((s) => {
      const qty = Number(services[s.key].qty) || 0;
      const complimentary = !!services[s.key].complimentary;
      const bundledIncluded = !!services[s.key].bundledIncluded;
      const rate = (complimentary || bundledIncluded)
        ? 0
        : Number(services[s.key].rate != null ? services[s.key].rate : s.defaultRate);
      const amount = s.unit === 'flat' ? rate : (s.unit === 'included' ? 0 : rate * qty);
      return { ...s, qty, rate, complimentary, bundledIncluded, amount };
    });
}

const UNLIMITED_SEATS = -1;
function seatLabel(count: Any, singular: string, plural: string): string {
  if (count === UNLIMITED_SEATS) return `Unlimited ${plural}`;
  if (count > 0) return `${count} ${count > 1 ? plural : singular}`;
  return '';
}
function platformSeatsSummary(svc: Any): string {
  if (!svc) return '';
  const parts = [
    seatLabel(svc.directorSeats, 'Director', 'Directors'),
    seatLabel(svc.coachSeats, 'Coach', 'Coaches'),
    seatLabel(svc.playerSeats, 'Player', 'Players'),
  ].filter(Boolean);
  return parts.join(', ');
}

// Strip a data: URL prefix and decode base64 to bytes. Returns null on failure.
function dataUrlToBytes(dataUrl: Any): Uint8Array | null {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    // Accept full data URLs, bare base64, and tolerate whitespace/newlines.
    let b64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
    b64 = b64.replace(/\s/g, '');
    if (!b64) return null;
    return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  } catch (_) {
    return null;
  }
}

export async function buildContractPdf(input: {
  snapshot: { contract: Any; client: Any; company: Any };
  signer: { name: string; title: string; company: string; email: string; signedAt: string };
  signatureImageBytes: Uint8Array | null;
}): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { snapshot, signer } = input;
  const c = snapshot?.contract || {};
  const cl = snapshot?.client || {};
  const co = snapshot?.company || {};

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const W = 595, H = 842;               // A4 portrait
  const M = 50;
  const HEADER_BAND = 78;               // navy band height on page 1
  const CONTENT_TOP_P1 = 118;           // below the full header band + rainbow (page 1)
  const CONTENT_TOP_REST = 58;          // below the slim running header (pages 2+)
  const BOTTOM = 52;                    // above the footer band
  const maxW = W - M * 2;

  let page = pdf.addPage([W, H]);
  let y = CONTENT_TOP_P1;

  // Embed a base64 data-URL image, trying PNG then JPG. Returns null on failure.
  async function embedImage(dataUrl: Any) {
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) return null;
    try { return await pdf.embedPng(bytes); }
    catch (_) {
      try { return await pdf.embedJpg(bytes); }
      catch (_) { return null; }
    }
  }
  async function embedImageBytes(bytes: Uint8Array | null) {
    if (!bytes) return null;
    try { return await pdf.embedPng(bytes); }
    catch (_) {
      try { return await pdf.embedJpg(bytes); }
      catch (_) { return null; }
    }
  }

  // --- Header images (embedded once, reused on the page-1 lockup). ----------
  const contractNumber = pick(c, 'contractNumber', 'contract_number') || '';
  const companyName0 = co.name || 'C.C. Science of Sports Ltd';
  const clientName0 = pick(cl, 'companyName', 'company_name') || 'Client';
  const sosLogo = await embedImage(pick(co, 'logo', 'logo_url', 'logoBase64'));
  const clientLogo = await embedImage(pick(cl, 'logoBase64', 'logo_url', 'logo'));

  // --- Rainbow strip helper (four coloured segments). -----------------------
  const drawRainbow = (pg: Any, topY: number, h = 3) => {
    const rsw = W / RAINBOW.length;
    RAINBOW.forEach((col, i) => pg.drawRectangle({ x: i * rsw, y: topY - h, width: rsw, height: h, color: col }));
  };

  // --- Full navy header band with two-logo lockup + cyan contract number. ---
  // Drawn on PAGE 1 only. pdf-lib is bottom-up: the band sits at the top edge.
  const drawHeaderP1 = (pg: Any) => {
    const bandTop = H;
    const bandBottom = H - HEADER_BAND;
    pg.drawRectangle({ x: 0, y: bandBottom, width: W, height: HEADER_BAND, color: NAVY });

    // Two-logo lockup, vertically centred in the upper part of the band so the
    // cyan contract number can sit below it.
    const logoH = 30;
    const lockCenterY = H - 34;         // baseline-ish centre for the lockup row
    const gap = 22;
    const crossW = font.widthOfTextAtSize('x', 14);

    // Measure the SOS + client widths (image scaled to h=logoH, else wordmark).
    const sosW = sosLogo ? sosLogo.scaleToFit(150, logoH).width : bold.widthOfTextAtSize('SCIENCE OF SPORTS', 13);
    const cliW = clientLogo ? clientLogo.scaleToFit(150, logoH).width
                            : bold.widthOfTextAtSize(clientName0.toUpperCase(), 12);
    const totalW = sosW + gap + crossW + gap + cliW;
    let cx = (W - totalW) / 2;

    // SOS logo / wordmark.
    if (sosLogo) {
      try {
        const s = sosLogo.scaleToFit(150, logoH);
        pg.drawImage(sosLogo, { x: cx, y: lockCenterY - s.height / 2, width: s.width, height: s.height });
      } catch (_) {
        pg.drawText('SCIENCE OF SPORTS', { x: cx, y: lockCenterY - 5, size: 13, font: bold, color: WHITE });
      }
    } else {
      pg.drawText('SCIENCE OF SPORTS', { x: cx, y: lockCenterY - 5, size: 13, font: bold, color: WHITE });
    }
    cx += sosW + gap;

    // Cyan multiplication cross.
    pg.drawText('x', { x: cx, y: lockCenterY - 5, size: 14, font, color: CYAN });
    cx += crossW + gap;

    // Client logo / name.
    if (clientLogo) {
      try {
        const s = clientLogo.scaleToFit(150, logoH);
        pg.drawImage(clientLogo, { x: cx, y: lockCenterY - s.height / 2, width: s.width, height: s.height });
      } catch (_) {
        pg.drawText(clientName0.toUpperCase(), { x: cx, y: lockCenterY - 5, size: 12, font: bold, color: WHITE });
      }
    } else {
      pg.drawText(clientName0.toUpperCase(), { x: cx, y: lockCenterY - 5, size: 12, font: bold, color: WHITE });
    }

    // Cyan contract number, centred below the lockup.
    if (contractNumber) {
      const tw = bold.widthOfTextAtSize(contractNumber, 9);
      pg.drawText(contractNumber, { x: (W - tw) / 2, y: bandBottom + 12, size: 9, font: bold, color: CYAN });
    }

    // Rainbow hairline directly under the band.
    drawRainbow(pg, bandBottom, 3);
  };

  // --- Slim running header for pages 2+. ------------------------------------
  const drawHeaderRest = (pg: Any) => {
    pg.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: NAVY });
    pg.drawText('SCIENCE OF SPORTS', { x: M, y: H - 20, size: 10, font: bold, color: WHITE });
    if (contractNumber) {
      const tw = font.widthOfTextAtSize(contractNumber, 8);
      pg.drawText(contractNumber, { x: W - M - tw, y: H - 20, size: 8, font, color: CYAN });
    }
    drawRainbow(pg, H - 30, 3);
  };

  // --- Footer band, drawn on every page. -----------------------------------
  const drawFooter = (pg: Any) => {
    pg.drawRectangle({ x: 0, y: 0, width: W, height: 38, color: NAVY });
    pg.drawText(companyName0, { x: M, y: 24, size: 7.5, font: bold, color: WHITE });
    const contactEmail = pick(co, 'contactEmail', 'contact_email') || 'info@scienceofsports.net';
    const reg = pick(co, 'registrationNumber', 'registration_number') || 'HE 449875';
    const vat = pick(co, 'vatNumber', 'vat_number');
    const line2 = `${contactEmail} · +357 22 396997 · Reg. No. ${reg}${vat ? ' · VAT ' + vat : ''}`;
    pg.drawText(line2, { x: M, y: 13, size: 7, font, color: FOOTER_GREY });
    const tag = 'Transforming matches into knowledge.';
    const tw = italic.widthOfTextAtSize(tag, 8.5);
    pg.drawText(tag, { x: W - M - tw, y: 16, size: 8.5, font: italic, color: CYAN });
  };

  drawHeaderP1(page);

  // The layout cursor `y` grows DOWNWARD from CONTENT_TOP (intuitive top-down).
  // pdf-lib's coordinate system is bottom-up, so every draw converts via py().
  const py = (yy: number) => H - yy;

  // Move to a fresh page when the cursor would collide with the footer.
  const newPage = () => {
    drawFooter(page);
    page = pdf.addPage([W, H]);
    drawHeaderRest(page);
    y = CONTENT_TOP_REST;
  };
  const ensure = (need: number) => { if (y + need > H - BOTTOM) newPage(); };

  // Word-wrapped text writer. Advances y downward.
  const text = (str: Any, opts: { size?: number; f?: Any; color?: Any; gap?: number; x?: number; width?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const color = opts.color ?? BLACK;
    const x = opts.x ?? M;
    const width = opts.width ?? maxW;
    const words = String(str ?? '').split(/\s+/);
    let lineStr = '';
    const flush = () => {
      ensure(size + 4);
      y += size;                       // advance to this line's baseline first
      page.drawText(lineStr, { x, y: py(y), size, font: f, color });
      y += 4;
      lineStr = '';
    };
    for (const w of words) {
      const test = lineStr ? lineStr + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > width && lineStr) { flush(); lineStr = w; }
      else lineStr = test;
    }
    if (lineStr) flush();
    if (opts.gap) y += opts.gap;
  };

  const rule = () => { ensure(12); page.drawLine({ start: { x: M, y: py(y) }, end: { x: W - M, y: py(y) }, thickness: 0.5, color: rgb(0.862, 0.878, 0.902) }); y += 12; };

  // --- Navy PILL section header. THE key visual change. ---------------------
  // Draws a navy chip containing an optional cyan clause number + white title,
  // then advances y below it. `num` is null for un-numbered headers.
  const PILL_H = 22;
  const PILL_PADX = 14;
  const PILL_TEXT = 11;
  const pillHeader = (num: number | null, title: string) => {
    ensure(PILL_H + 10);
    y += 4;                              // small breathing room above the pill
    const numStr = num != null ? `${num}.` : '';
    const numW = numStr ? bold.widthOfTextAtSize(numStr, PILL_TEXT) : 0;
    const numGap = numStr ? 6 : 0;
    const titleW = bold.widthOfTextAtSize(title, PILL_TEXT);
    const pillW = PILL_PADX * 2 + numW + numGap + titleW;
    const pillTop = y;                   // downward cursor at pill top
    // Navy rounded-ish chip (pdf-lib has no native rounded corners → sharp navy rect).
    page.drawRectangle({ x: M, y: py(pillTop + PILL_H), width: pillW, height: PILL_H, color: NAVY });
    const textY = pillTop + PILL_H - 7;  // downward baseline for centred-ish text
    let tx = M + PILL_PADX;
    if (numStr) {
      page.drawText(numStr, { x: tx, y: py(textY), size: PILL_TEXT, font: bold, color: CYAN });
      tx += numW + numGap;
    }
    page.drawText(title, { x: tx, y: py(textY), size: PILL_TEXT, font: bold, color: WHITE });
    y = pillTop + PILL_H + 8;
  };

  // A numbered clause: navy PILL heading + one or more body paragraphs.
  const clause = (num: number | null, title: string, ...paras: Any[]) => {
    ensure(40);
    pillHeader(num, title);
    paras.forEach((p, i) => text(p, { size: 10, gap: i === paras.length - 1 ? 10 : 4 }));
  };

  // --- Data prep -----------------------------------------------------------
  const services = c.services;
  const lineItems = computeServiceLineItems(services);
  const currency = c.currency || 'EUR';
  const value = c.value;
  const startDate = pick(c, 'startDate', 'start_date');
  const endDate = pick(c, 'endDate', 'end_date');
  const termYears = startDate && endDate ? Math.max(1, Math.round(daysBetween(startDate, endDate) / 365)) : null;
  const paymentType = (pick(c, 'paymentType', 'payment_type') || '').replace('_', ' ');
  const paymentTermsDays = pick(c, 'paymentTermsDays', 'payment_terms_days');
  const latePaymentPenalty = pick(c, 'latePaymentPenalty', 'late_payment_penalty');
  const governingLaw = pick(c, 'governingLaw', 'governing_law');
  const jurisdiction = c.jurisdiction;
  const specialTerms = pick(c, 'specialTerms', 'special_terms');
  const madeOn = pick(c, 'createdAt', 'created_at', 'sentAt', 'sent_at') || new Date().toISOString();

  const companyName = co.name || '—';
  const companyReg = pick(co, 'registrationNumber', 'registration_number') || '—';
  const companyVat = pick(co, 'vatNumber', 'vat_number') || '—';
  const companyAddr = pick(co, 'registeredAddress', 'registered_address') || '—';
  const clientName = pick(cl, 'companyName', 'company_name') || '—';
  const clientReg = pick(cl, 'registrationNumber', 'registration_number');
  const clientAddr = cl.address || '[address]';

  // --- Title (split on the dash like the client PDF), centred navy bold. ----
  {
    const parts = String(c.title || 'Service Agreement').split(/\s+[—–-]\s+/);
    const centered = (str: string, size: number, gap: number) => {
      const tw = bold.widthOfTextAtSize(str, size);
      ensure(size + 6);
      y += size;
      page.drawText(str, { x: (W - tw) / 2, y: py(y), size, font: bold, color: NAVY });
      y += gap;
    };
    centered((parts[0] || '').toUpperCase(), 18, parts.length > 1 ? 4 : 8);
    if (parts.length > 1) centered(parts.slice(1).join(' - ').toUpperCase(), 13, 8);
  }
  rule();

  // --- Preamble ------------------------------------------------------------
  text(`This Agreement is made on ${fmtDate(madeOn)} between:`, { size: 10, gap: 4 });
  text(`${companyName}, a company registered under the laws of the Republic of Cyprus with registration number ${companyReg}, VAT number ${companyVat}, having its registered office at ${companyAddr} (the "Service Provider"),`, { size: 10, gap: 2 });
  text('and', { size: 10, gap: 2 });
  text(`${clientName}, ${clientReg ? `a company registered with registration number ${clientReg}, ` : ''}having its registered office at ${clientAddr} (the "Client").`, { size: 10, gap: 2 });
  text('The above are hereinafter jointly referred to as the "Parties".', { size: 10, gap: 10 });

  // --- About the Service Provider — navy pill header + intro + bullets. -----
  {
    const aboutIntro = "Science of Sports (C.C. Science of Sports Ltd, HE 449875) is Cyprus's leading football intelligence company. Built by UEFA-qualified analysts and engineers, it operates the first fully integrated football analytics platform originating from Cyprus, serving federations, academies, coaches, scouts and players.";
    const aboutBullets = [
      'Official Performance Analysis Partner of the Cyprus Football Association — the platform trusted by all Cyprus National Teams.',
      '15 countries analysed · 150+ teams served · 3,000+ players profiled.',
      '1,000+ youth and national-team matches analysed annually.',
      'Official partner of the Cyprus Coaches Association (creators of the "Coach of the Month" awards).',
      'Founders of the Annual Youth Football Player & Coach Awards.',
      'Creators of "Youth Zone" with Cablenet — Cyprus\'s first TV show dedicated to youth football.',
    ];
    pillHeader(null, 'About the Service Provider');
    text(aboutIntro, { size: 9.5, color: SOFT_GREY, gap: 4 });
    for (const b of aboutBullets) {
      text(`•  ${b}`, { size: 9.5, color: SOFT_GREY, gap: 2, x: M + 6, width: maxW - 6 });
    }
    y += 10;
  }

  // --- Clause numbering (identical logic to the client PDF). ---------------
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
  const specialTermsNum = (specialTerms && String(specialTerms).trim()) ? n++ : null;
  const entireAgreementNum = n++;

  // Draw a small cyan "Included"/"Complimentary" chip inline; returns advanced x.
  const chip = (label: string, x: number, baselineY: number) => {
    const size = 8;
    const padX = 6;
    const w = font.widthOfTextAtSize(label, size) + padX * 2;
    const chipH = 13;
    // baselineY is the downward baseline of the text line the chip sits on.
    page.drawRectangle({ x, y: py(baselineY + 3), width: w, height: chipH, color: CHIP_BG });
    page.drawText(label, { x: x + padX, y: py(baselineY - 1.5), size, font: bold, color: CYAN_DEEP });
    return x + w;
  };

  // --- Purpose — STRUCTURED by service group when services exist. ----------
  pillHeader(purposeNum, 'Purpose');
  if (lineItems.length > 0) {
    text('The purpose of this Agreement is to define the terms of cooperation between the Parties, under which the Service Provider shall provide the Client with the following services:', { size: 10, gap: 6 });
    SERVICE_GROUPS.forEach((group) => {
      const groupItems = lineItems.filter((i) => i.group === group);
      if (!groupItems.length) return;
      ensure(30);
      // Cyan bold service-group subheading.
      text(group, { size: 10, f: bold, color: CYAN_DEEP, gap: 4 });
      groupItems.forEach((i) => {
        const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
        const chipLabel = i.bundledIncluded ? 'Included' : i.complimentary ? 'Complimentary' : i.unit === 'included' ? 'Included' : null;
        const itemX = M + 12;
        const itemW = maxW - 12;
        // Label line: navy bold label + qty note + inline chip.
        ensure(16);
        y += 10;                         // baseline for the label line
        const labelBaseline = y;
        let lx = itemX;
        page.drawText(i.label, { x: lx, y: py(labelBaseline), size: 9.5, font: bold, color: NAVY });
        lx += bold.widthOfTextAtSize(i.label, 9.5);
        if (qtyNote) {
          page.drawText(qtyNote, { x: lx, y: py(labelBaseline), size: 9.5, font, color: GREY });
          lx += font.widthOfTextAtSize(qtyNote, 9.5);
        }
        if (chipLabel) { lx += 6; chip(chipLabel, lx, labelBaseline); }
        y += 3;
        // Detail line(s) in grey, indented.
        text(i.detail, { size: 9.5, color: SOFT_GREY, gap: 2, x: itemX, width: itemW });
        if (i.key === 'platform_access') {
          const seats = platformSeatsSummary(services?.platform_access);
          if (seats) text(`Access: ${seats} (exact users to be confirmed with the client).`, { size: 9, color: GREY, gap: 2, x: itemX + 10, width: itemW - 10 });
        }
      });
      y += 6;
    });
    text(`${c.slaHours || 24}-hour SLA on delivery of key analytical outputs after each match.`, { size: 10, gap: 10 });
  } else {
    text(c.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.', { size: 10, gap: 10 });
  }

  // --- Scope of Services (only when there are line items). ------------------
  if (scopeNum) {
    pillHeader(scopeNum, 'Scope of Services');
    lineItems.forEach((i) => {
      const qty = i.unit === 'flat' ? '—' : (i.unit === 'included' || i.complimentary || i.bundledIncluded) ? 'Included' : String(i.qty);
      let label = `• ${i.label}`;
      if (i.key === 'platform_access' && platformSeatsSummary(services?.platform_access)) {
        label += ` — Access: ${platformSeatsSummary(services.platform_access)} (exact users to be confirmed with the client)`;
      }
      text(`${label}   [${qty}]`, { size: 10, x: M + 10, width: maxW - 10 });
    });
    text(`Total Contract Value: ${fmtMoney(value, currency)}`, { size: 10, f: bold, color: NAVY, gap: 10 });
  }

  // --- Fees & Payment ------------------------------------------------------
  clause(feesNum, 'Fees & Payment',
    `In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of ${fmtMoney(value, currency)}, payable ${paymentType}, net ${paymentTermsDays} days from the date of a valid invoice.`,
    `All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of ${latePaymentPenalty}% per month applies to overdue amounts.`);
  {
    const bankName = pick(co, 'bankName', 'bank_name');
    const bankIBAN = pick(co, 'bankIBAN', 'bank_iban');
    const bankSWIFT = pick(co, 'bankSWIFT', 'bank_swift');
    if (bankName || bankIBAN || bankSWIFT) {
      // Tinted, bordered bank-details box. Measure the content span, then paint
      // the box behind it on the same page (kept together to avoid a page split).
      const bankLines = [
        bankName ? `Bank: ${bankName}` : null,
        bankIBAN ? `IBAN: ${bankIBAN}` : null,
        bankSWIFT ? `SWIFT/BIC: ${bankSWIFT}` : null,
      ].filter(Boolean) as string[];
      const boxNeed = 16 + 14 + bankLines.length * 13 + 12;
      ensure(boxNeed);
      const boxTop = y;
      const innerX = M + 12;
      // Paint the box first (behind), sized to the known content height.
      const boxH = boxNeed;
      page.drawRectangle({ x: M, y: py(boxTop + boxH), width: maxW, height: boxH, color: BOX_BG, borderColor: BOX_BORDER, borderWidth: 0.75 });
      y = boxTop + 14;
      text('BANK DETAILS (SERVICE PROVIDER)', { x: innerX, size: 8, f: bold, color: NAVY, gap: 4 });
      for (const bl of bankLines) text(bl, { x: innerX, size: 9, color: SOFT_GREY, gap: 1 });
      y = boxTop + boxH + 10;
    }
  }

  // --- Confidentiality & Data Protection -----------------------------------
  clause(confidentialityNum, 'Confidentiality & Data Protection',
    'The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.',
    "All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.");

  // --- Intellectual Property Rights ----------------------------------------
  clause(ipNum, 'Intellectual Property Rights',
    'All match footage, training footage, video recordings, reports, analytics outputs, player data, databases, clips and any other materials produced, collected or generated by the Service Provider under this Agreement (collectively, the "Deliverables") shall be the exclusive property of the Client. The Client shall have unrestricted, irrevocable and royalty-free rights to use, reproduce, store, modify, distribute and archive the Deliverables for any internal purpose. The Service Provider shall not use, reproduce, disclose, commercialize or share any Deliverables with any third party without the Client\'s prior written consent.');

  // --- Duration ------------------------------------------------------------
  clause(durationNum, 'Duration',
    `This Agreement shall commence on ${fmtDate(startDate)} and shall remain in force until ${fmtDate(endDate)}${termYears ? ` (approximately ${termYears} year${termYears > 1 ? 's' : ''})` : ''}, unless terminated earlier in accordance with Section ${terminationNum}.`);

  // --- Termination ---------------------------------------------------------
  clause(terminationNum, 'Termination',
    "Either Party may terminate this Agreement with three (3) months' written notice, or immediately in the event of a material breach not remedied within thirty (30) days.",
    'Upon termination or expiration of this Agreement for any reason, the Service Provider shall promptly deliver to the Client all Deliverables produced under this Agreement.');

  // --- Limitation of Liability ---------------------------------------------
  clause(liabilityNum, 'Limitation of Liability',
    "The Service Provider shall not be responsible for sporting results, team selection decisions, or competition outcomes. Total liability under this Agreement shall not exceed the fees paid during the preceding twelve (12) months. This limitation shall not apply to breaches of confidentiality, data protection obligations, or unauthorized use of the Client's data or intellectual property.");

  // --- Force Majeure -------------------------------------------------------
  clause(forceMajeureNum, 'Force Majeure',
    'Neither Party shall be liable for failure to perform due to events beyond reasonable control.');

  // --- Governing Law & Jurisdiction ----------------------------------------
  clause(governingLawNum, 'Governing Law & Jurisdiction',
    `This Agreement shall be governed by the laws of ${governingLaw}, with exclusive jurisdiction in ${jurisdiction}.`);

  // --- Special Terms (optional) --------------------------------------------
  if (specialTermsNum) {
    clause(specialTermsNum, 'Special Terms', specialTerms);
  }

  // --- Entire Agreement ----------------------------------------------------
  clause(entireAgreementNum, 'Entire Agreement & Amendments',
    'This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.');

  // --- Designated Contact block (if present on the snapshot contract). ------
  {
    const contactName = pick(c, 'contactName', 'contact_name');
    if (contactName) {
      const contactRole = pick(c, 'contactRole', 'contact_role');
      const contactEmail = pick(c, 'contactEmail', 'contact_email');
      const contactPhone = pick(c, 'contactPhone', 'contact_phone');
      const financeName = pick(c, 'financeName', 'finance_name');
      const financeEmail = pick(c, 'financeEmail', 'finance_email');
      pillHeader(null, 'Designated Contact');
      const opsBits = [contactName, contactRole].filter(Boolean).join(', ');
      const opsTail = [contactEmail, contactPhone].filter(Boolean).join(' · ');
      text(`Client's designated contact for operations & communication: ${opsBits}${opsTail ? ' · ' + opsTail : ''}.`, { size: 10, gap: 2 });
      if (financeName || financeEmail) {
        text(`Finance contact: ${[financeName, financeEmail].filter(Boolean).join(' · ')}.`, { size: 10, gap: 2 });
      }
      y += 6;
    }
  }

  // --- SIGNATURES — two columns with real signature IMAGES. ----------------
  // The whole block must fit; if not, push it to a fresh page so a signature
  // never straddles the footer or a page break.
  ensure(210);
  pillHeader(null, 'Signatures');
  text('Executed by the duly authorised representatives of the Parties as of the dates set out below.', { size: 8, color: GREY, gap: 12 });

  const colW = (maxW - 30) / 2;
  const colX = [M, M + colW + 30];
  const heads = [`For and on behalf of ${companyName}`, `For and on behalf of ${clientName}`];
  const signedAtFmt = fmtDate(signer.signedAt);

  // Provider column: SOS authorised signatory image (accept snake OR camel) +
  // name/title/date. This is the field that was previously blank.
  const providerSig = await embedImage(pick(co, 'signatorySignature', 'signatory_signature'));
  const providerName = pick(co, 'signatoryName', 'signatory_name') || '';
  const providerTitle = pick(co, 'signatoryTitle', 'signatory_title') || '';

  // Client column: the actual drawn signature PNG passed in (post-sign).
  const clientSig = await embedImageBytes(input.signatureImageBytes);

  const cols = [
    { sig: providerSig, sigFallback: providerName, name: providerName, title: providerTitle, date: signedAtFmt },
    { sig: clientSig, sigFallback: signer.name, name: signer.name, title: signer.title || '', date: signedAtFmt },
  ];

  ensure(190);
  const blockTop = y;                   // downward cursor at block top
  let maxColBottom = y;
  cols.forEach((col, idx) => {
    const x = colX[idx];
    let yy = blockTop;
    // Column header (downward baseline), navy uppercase.
    yy += 9;
    page.drawText(heads[idx].toUpperCase().slice(0, 60), { x, y: py(yy), size: 8.5, font: bold, color: NAVY });
    yy += 16;

    // Signature area: reserve a tall band; draw a LARGE image (scaleToFit
    // ~180x64) sitting just above the signature line, else the italic name.
    const sigLineY = yy + 64;           // downward position of the signature line
    if (col.sig) {
      try {
        const scaled = col.sig.scaleToFit(180, 62);
        // Image bottom sits ~5pt above the ruled line; grows upward.
        page.drawImage(col.sig, { x: x + 2, y: py(sigLineY - 5), width: scaled.width, height: scaled.height });
      } catch (_) {
        if (col.sigFallback) page.drawText(col.sigFallback, { x: x + 2, y: py(sigLineY - 6), size: 15, font: italic, color: BLACK });
      }
    } else if (col.sigFallback) {
      page.drawText(col.sigFallback, { x: x + 2, y: py(sigLineY - 6), size: 15, font: italic, color: BLACK });
    }
    // Signature line + label.
    page.drawLine({ start: { x, y: py(sigLineY) }, end: { x: x + colW, y: py(sigLineY) }, thickness: 0.75, color: rgb(0.588, 0.627, 0.667) });
    page.drawText('SIGNATURE', { x, y: py(sigLineY + 10), size: 7, font, color: rgb(0.549, 0.58, 0.612) });
    yy = sigLineY + 26;

    const field = (label: string, val: string) => {
      if (val) page.drawText(String(val), { x: x + 2, y: py(yy - 3), size: 9, font, color: BLACK });
      page.drawLine({ start: { x, y: py(yy + 2) }, end: { x: x + colW, y: py(yy + 2) }, thickness: 0.5, color: rgb(0.588, 0.627, 0.667) });
      page.drawText(label.toUpperCase(), { x, y: py(yy + 12), size: 7, font, color: rgb(0.549, 0.58, 0.612) });
      yy += 28;
    };
    field('Name', col.name);
    field('Title', col.title);
    field('Date', col.date);
    if (yy > maxColBottom) maxColBottom = yy;
  });
  y = maxColBottom + 8;
  rule();

  // --- Closing note. -------------------------------------------------------
  text('This is the executed agreement. A Certificate of Completion containing the full electronic-signature evidence (identity verification, timestamps, IP and document integrity hash) has been issued separately to both parties.', { size: 9, color: GREY });

  // Footer on the final page.
  drawFooter(page);

  const bytes = await pdf.save();
  const hex = await sha256Hex(Array.from(bytes).map((b) => String.fromCharCode(b)).join(''));
  return { bytes, sha256: hex };
}
