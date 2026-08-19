/* =========================================================================
   Client-side contract PDF generator (jsPDF).
   Produces a PREMIUM, readable A4 PDF of the contract for the signer to
   download, read, keep, or forward. This is the human-readable agreement —
   the tamper-evident Certificate of Completion (with signature evidence) is
   generated server-side after signing.

   VISUAL PARITY: this file is deliberately styled to match the server-side
   pdf-lib generator (supabase/functions/_shared/contractPdf.ts) so the
   pre-signing preview and the signed PDF look identical — navy header band
   with the two-logo lockup + cyan contract number + rainbow hairline, navy
   PILL section headers (cyan clause number + white title), an About-the-
   Service-Provider section, structured Purpose with cyan service-group
   subheadings + inline Included/Complimentary chips, a tinted bank-details
   box, a two-column signature block with real signature IMAGES, and a navy
   footer band with the cyan italic tagline on every page.

   IMPORTANT: The clause wording below is kept in sync with the canonical
   ContractDocumentBody component in App.jsx AND the server contractPdf.ts.
   All three must read the same to a human. If you change a clause here,
   change it there too (and vice versa).
   ========================================================================= */
import { jsPDF } from 'jspdf';
import { loadPdfFonts, PDF_FONT } from './pdfFont.js';
import { t as contractT, isGreek, elServiceGroup, durationSentence, governingLawSentence, closingNote, clauseName, bankTransferSentence, isShortForm } from './contractText.js';
import { fmtDate, fmtMoney, daysBetween, upper } from './format.js';
import { computeServiceLineItems, platformSeatsSummary, seatsForService, SERVICE_GROUPS, analysisScopeText, seasonLabelFromDates, commercialModelText, parseSpecialTerms, serviceLevelsLines, vatSummary, paymentTimingWording, agreementDate, clientPartyClause, clientVatDisplay, isPlayerFunded, playerFundedScopeRows, isSponsorship, hasMatchServices, computeSponsorshipRights, sponsorshipRightText, feesConsiderationPhrase, SPONSORSHIP_RIGHT_GROUPS, confidentialityParas, ipParas, terminationEffectPara } from './constants.js';

export async function generateContractPdf({ contract, client, company }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Embed Noto Sans so Greek renders (jsPDF's Helvetica is Latin-1 only, and
  // drops Greek SILENTLY rather than throwing). Must happen before any text is
  // measured or drawn: splitTextToSize/getTextWidth read the active font's
  // metrics, so a late switch would leave every line wrapped to the wrong
  // width. Falls back to Helvetica if the fonts can't be fetched — fine for a
  // Latin contract, checked by the caller for a Greek one. See pdfFont.js.
  const FONT = (await loadPdfFonts(doc)) ? PDF_FONT : 'helvetica';

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const maxW = W - M * 2;

  // SCIOS brand colours (RGB 0-255) — matched to the server contractPdf.ts.
  const NAVY = [10, 26, 63];        // #0A1A3F
  const CYAN = [34, 199, 230];      // #22C7E6
  const CYAN_DEEP = [15, 181, 214]; // #0FB5D6 (chip text / group subheadings)
  const WHITE = [255, 255, 255];
  const BLACK = [30, 34, 45];       // #1E222D body colour
  const GREY = [102, 115, 128];     // secondary
  const SOFT_GREY = [79, 89, 99];   // About / detail text
  const CHIP_BG = [231, 248, 252];  // light-cyan chip fill (Included)
  const CYAN_BOX_BG = [227, 247, 251]; // light-cyan highlight fill (Access callout)
  const CHIP_GREEN_BG = [224, 246, 238]; // light-green chip fill (Complimentary)
  const CHIP_GREEN_TX = [5, 150, 105];   // #059669 green chip text
  const BOX_BG = [245, 247, 249];   // subtle navy tint for the bank box
  const LILAC_BG = [238, 240, 251];  // #EEF0FB — callout box fill (Confidentiality)
  const BOX_BORDER = [209, 217, 227];
  const FOOTER_GREY = [169, 182, 204]; // #A9B6CC

  // Layout bands. Page-1 header band is tall (logo lockup); pages 2+ get a slim
  // running header. Content must never sit under a band.
  const HEADER_BAND = 78;        // navy band height on page 1
  const CONTENT_TOP_P1 = 100;    // below the page-1 band + rainbow
  const CONTENT_TOP_REST = 50;   // below the slim running header (pages 2+)
  const FOOTER_BAND = 34;
  const BOTTOM = FOOTER_BAND + 10; // keep content above the footer band

  // Document wording for this contract's language (English fallback per key).
  const T = contractT(contract);
  const contractNumber = contract.contractNumber || '';
  const companyName = company?.name || 'C.C. Science of Sports Ltd';
  const clientName = client?.companyName || 'Client';

  // -------------------------------------------------------------------------
  // Image helper. jsPDF embeds base64 data URLs directly. We infer the format
  // from the data-URL prefix and fall back to PNG. Every call is wrapped in
  // try/catch by the caller so a bad/missing image never breaks the PDF.
  // -------------------------------------------------------------------------
  const imgFormat = (dataUrl) => {
    if (typeof dataUrl === 'string' && /^data:image\/(jpe?g)/i.test(dataUrl)) return 'JPEG';
    return 'PNG';
  };
  // Returns { w, h } scaled to fit within (maxW, maxH) preserving aspect ratio,
  // using jsPDF's image properties. Returns null if properties can't be read.
  const fitImage = (dataUrl, maxImgW, maxImgH) => {
    try {
      const props = doc.getImageProperties(dataUrl);
      if (!props || !props.width || !props.height) return null;
      const scale = Math.min(maxImgW / props.width, maxImgH / props.height);
      return { w: props.width * scale, h: props.height * scale };
    } catch (_) {
      return null;
    }
  };

  // -------------------------------------------------------------------------
  // Header band with the two-logo lockup (Scios × client) + cyan contract number
  // + rainbow hairline. Drawn on PAGE 1 only.
  // -------------------------------------------------------------------------
  const drawHeaderP1 = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, HEADER_BAND, 'F');

    // The Scios wordmark PNG is WIDE (star + "SCIENCE OF SPORTS"); give each logo
    // a generous fit box (200w × 44h) so it renders at full prominence and
    // matches the server-generated (sent/signed) PDFs.
    const logoH = 44;
    const logoMaxW = 200;
    const lockCenterY = 30;   // vertical centre of the lockup row
    const gap = 22;
    const crossSize = 16;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(crossSize);
    const crossW = doc.getTextWidth('×');

    // Resolve Scios + client lockup elements. Images preferred; text fallback.
    const sosLogo = company?.logo || null;
    const clientLogo = client?.logoBase64 || null;
    const sosFit = sosLogo ? fitImage(sosLogo, logoMaxW, logoH) : null;
    const cliFit = clientLogo ? fitImage(clientLogo, logoMaxW, logoH) : null;

    doc.setFont(FONT, 'bold');
    doc.setFontSize(13);
    const sosW = sosFit ? sosFit.w : doc.getTextWidth('SCIENCE OF SPORTS');
    doc.setFontSize(12);
    const cliW = cliFit ? cliFit.w : doc.getTextWidth(upper(clientName));

    const totalW = sosW + gap + crossW + gap + cliW;
    let cx = (W - totalW) / 2;

    // --- Scios logo / wordmark. ---
    let placed = false;
    if (sosLogo && sosFit) {
      try {
        doc.addImage(sosLogo, imgFormat(sosLogo), cx, lockCenterY - sosFit.h / 2, sosFit.w, sosFit.h);
        placed = true;
      } catch (_) { placed = false; }
    }
    if (!placed) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...WHITE);
      doc.text('SCIENCE OF SPORTS', cx, lockCenterY + 4);
    }
    cx += sosW + gap;

    // --- Cyan multiplication cross. ---
    doc.setFont(FONT, 'normal');
    doc.setFontSize(crossSize);
    doc.setTextColor(...CYAN);
    doc.text('×', cx, lockCenterY + 5);
    cx += crossW + gap;

    // --- Client logo / name. ---
    placed = false;
    if (clientLogo && cliFit) {
      try {
        doc.addImage(clientLogo, imgFormat(clientLogo), cx, lockCenterY - cliFit.h / 2, cliFit.w, cliFit.h);
        placed = true;
      } catch (_) { placed = false; }
    }
    if (!placed) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...WHITE);
      doc.text(upper(clientName), cx, lockCenterY + 4);
    }

    // --- Cyan contract number, centred below the lockup. ---
    if (contractNumber) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...CYAN);
      doc.text(contractNumber, W / 2, HEADER_BAND - 14, { align: 'center' });
    }

    // --- Rainbow hairline directly under the band. ---
    drawRainbow(HEADER_BAND);
  };

  // Slim running header for pages 2+.
  const drawHeaderRest = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 26, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text('SCIENCE OF SPORTS', M, 17);
    if (contractNumber) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...CYAN);
      doc.text(contractNumber, W - M, 17, { align: 'right' });
    }
    drawRainbow(26);
  };

  // Full-spectrum rainbow strip (matches the on-screen CSS gradient), drawn as
  // many thin interpolated slices so it reads as a smooth gradient edge-to-edge.
  const drawRainbow = (topY) => {
    // Same 7 stops as --sos-rainbow: cyan→green→yellow→orange→pink→purple→blue.
    const stops = [[34,199,230],[34,230,138],[230,230,34],[245,166,35],[236,72,153],[139,92,246],[37,99,235]];
    const N = 96;                       // slice count → smoothness
    const sliceW = W / N;
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * (stops.length - 1);
      const a = Math.floor(t), b = Math.min(a + 1, stops.length - 1), f = t - a;
      const c = [0,1,2].map(k => Math.round(stops[a][k] + (stops[b][k] - stops[a][k]) * f));
      doc.setFillColor(...c);
      // +1 overlap and last slice to the edge → no seams, no right-side gap.
      const w = (i === N - 1) ? (W - i * sliceW) : sliceW + 1;
      doc.rect(i * sliceW, topY, w, 3, 'F');
    }
  };

  // Footer band, drawn on every page at the end.
  const drawFooter = () => {
    // Signature SCIOS rainbow hairline sitting directly above the footer band.
    drawRainbow(H - FOOTER_BAND - 3);
    doc.setFillColor(...NAVY);
    doc.rect(0, H - FOOTER_BAND, W, FOOTER_BAND, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(companyName, M, H - 20);
    const email = company?.contactEmail || 'info@scienceofsports.net';
    const reg = company?.registrationNumber || 'HE 449875';
    const vat = company?.vatNumber;
    const line2 = `${email} · +357 22 396997 · ${T.regNoShort} ${reg}${vat ? ` · ${T.vatShort} ` + vat : ''}`;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...FOOTER_GREY);
    doc.text(line2, M, H - 10);
    doc.setFont(FONT, 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...CYAN);
    doc.text('Transforming matches into knowledge.', W - M, H - 14, { align: 'right' });
  };

  // -------------------------------------------------------------------------
  // Layout cursor + page management. `y` grows downward (jsPDF native top-down).
  // -------------------------------------------------------------------------
  let y = CONTENT_TOP_P1;
  // Track the y where the current page's body content started, so we can detect
  // and drop a trailing page that ended up with no real content (chrome only).
  let pageContentStart = CONTENT_TOP_P1;
  const newPage = () => {
    doc.addPage();
    drawHeaderRest();
    y = CONTENT_TOP_REST;
    pageContentStart = CONTENT_TOP_REST;
  };
  const ensure = (need) => { if (y + need > H - BOTTOM) newPage(); };

  // Word-wrapped text writer. Advances y downward.
  const text = (str, opts = {}) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? 'normal';
    const color = opts.color ?? BLACK;
    const x = opts.x ?? M;
    const width = opts.width ?? maxW;
    doc.setFont(FONT, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(str ?? ''), width);
    for (const ln of lines) {
      ensure(size + 4);
      y += size;                // advance to this line's baseline
      doc.text(ln, x, y);
      y += 4;
    }
    if (opts.gap) y += opts.gap;
  };

  const rule = () => {
    ensure(12);
    doc.setDrawColor(220, 224, 230);
    doc.line(M, y, W - M, y);
    y += 12;
  };

  // --- Navy PILL section header. THE key visual change. ---------------------
  // Rounded navy chip with an optional cyan clause number + white bold title.
  const PILL_H = 22;
  const PILL_PADX = 14;
  const PILL_TEXT = 11;
  const pillHeader = (num, title) => {
    ensure(PILL_H + 12);
    y += 4;                     // breathing room above the pill
    const numStr = num != null ? `${num}.` : '';
    doc.setFont(FONT, 'bold');
    doc.setFontSize(PILL_TEXT);
    const numW = numStr ? doc.getTextWidth(numStr) : 0;
    const numGap = numStr ? 6 : 0;
    const titleW = doc.getTextWidth(title);
    const pillW = PILL_PADX * 2 + numW + numGap + titleW;
    const pillTop = y;
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, pillTop, pillW, PILL_H, 3, 3, 'F');
    const textBaseline = pillTop + PILL_H - 7;
    let tx = M + PILL_PADX;
    if (numStr) {
      doc.setTextColor(...CYAN);
      doc.text(numStr, tx, textBaseline);
      tx += numW + numGap;
    }
    doc.setTextColor(...WHITE);
    doc.text(title, tx, textBaseline);
    y = pillTop + PILL_H + 8;
  };

  // A numbered clause: navy PILL heading + one or more body paragraphs.
  const clause = (num, title, ...paras) => {
    ensure(40);
    pillHeader(num, title);
    paras.forEach((p, i) => text(p, { size: 10, gap: i === paras.length - 1 ? 10 : 4 }));
  };

  // Callout clause: pill header, then the paragraphs inside a lilac box with a
  // navy left-bar (matches the on-screen Confidentiality callout). `lead` is a
  // bold navy lead-in prepended to the first paragraph.
  const calloutClause = (num, title, lead, ...paras) => {
    ensure(40);
    pillHeader(num, title);
    const padX = 12, padY = 10, barW = 3, textW = maxW - padX * 2;
    // Measure wrapped height first so the box sizes correctly.
    doc.setFontSize(10);
    let lineCount = 0;
    paras.forEach((p, i) => {
      const s = i === 0 ? `${lead} ${p}` : p;
      lineCount += doc.splitTextToSize(s, textW).length;
    });
    const gaps = (paras.length - 1) * 4;
    const boxH = padY * 2 + lineCount * 14 + gaps;
    ensure(boxH + 6);
    const boxTop = y;
    doc.setFillColor(...LILAC_BG);
    doc.roundedRect(M, boxTop, maxW, boxH, 4, 4, 'F');
    doc.setFillColor(...NAVY);
    doc.rect(M, boxTop, barW, boxH, 'F');
    y = boxTop + padY;
    paras.forEach((p, i) => {
      if (i === 0) {
        // Bold navy lead-in on the same first line, then the rest as body.
        text(`${lead} ${p}`, { x: M + padX, width: textW, size: 10, gap: i === paras.length - 1 ? 0 : 4 });
      } else {
        text(p, { x: M + padX, width: textW, size: 10, gap: i === paras.length - 1 ? 0 : 4 });
      }
    });
    y = boxTop + boxH + 10;
  };

  // Small inline "Included" chip: light-green rounded rect with green bold text
  // (matches the on-screen chip). `baselineY` is the line's text baseline.
  const chip = (label, x, baselineY) => {
    const size = 8;
    const padX = 6;
    const chipH = 12;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(size);
    const w = doc.getTextWidth(label) + padX * 2;
    doc.setFillColor(...CHIP_GREEN_BG);
    doc.roundedRect(x, baselineY - chipH + 3, w, chipH, 3, 3, 'F');
    doc.setTextColor(...CHIP_GREEN_TX);
    doc.text(label, x + padX, baselineY - 0.5);
    return x + w;
  };

  // Highlighted "Access:" callout — a light-cyan box with a cyan left accent and
  // navy text so this contractually important seat line stands out. Advances y.
  const accessCallout = (str, x, width) => {
    const size = 9;
    const padX = 6;
    const lineH = size + 3;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(str ?? ''), width - padX * 2);
    const boxH = lines.length * lineH + 8;
    ensure(boxH + 4);
    y += 4;
    const boxTop = y;
    doc.setFillColor(...CYAN_BOX_BG);
    doc.roundedRect(x, boxTop, width, boxH, 2, 2, 'F');
    doc.setFillColor(...CYAN);
    doc.rect(x, boxTop, 2, boxH, 'F');
    doc.setTextColor(...NAVY);
    let ly = boxTop + 4 + size;
    for (const ln of lines) { doc.text(ln, x + padX, ly); ly += lineH; }
    y = boxTop + boxH + 2;
  };

  // --- Data prep -----------------------------------------------------------
  const services = contract.services;
  const lineItems = services ? computeServiceLineItems(services, contract.language) : [];
  const termYears = contract.startDate && contract.endDate
    ? Math.max(1, Math.round(daysBetween(contract.startDate, contract.endDate) / 365)) : null;

  // --- Page 1 header band ---------------------------------------------------
  drawHeaderP1();

  // --- Title split on the dash: client name on top, agreement type below. ---
  {
    const parts = (contract.title || 'Service Agreement').split(/\s+[—–-]\s+/);
    const centered = (str, size, gap) => {
      ensure(size + 6);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(size);
      doc.setTextColor(...NAVY);
      y += size;
      doc.text(str, W / 2, y, { align: 'center' });
      y += gap;
    };
    centered(upper(parts[0] || ''), 18, parts.length > 1 ? 4 : 8);
    if (parts.length > 1) centered(upper(parts.slice(1).join(' - ')), 13, 8);
  }
  rule();

  // --- Preamble — both parties, full details. ------------------------------
  text(`${T.agreementMadeOn} ${fmtDate(agreementDate(contract))} ${T.between}`, { size: 10, gap: 4 });
  text(isGreek(contract)
    ? `${company?.name || '—'}, εταιρεία εγγεγραμμένη κατά τους νόμους της Κυπριακής Δημοκρατίας με αριθμό εγγραφής ${company?.registrationNumber || '—'}, ΑΦΤ ${company?.vatNumber || '—'}, με έδρα ${company?.registeredAddress || '—'} (ο «Πάροχος»),`
    : `${company?.name || '—'}, a company registered under the laws of the Republic of Cyprus with registration number ${company?.registrationNumber || '—'}, VAT number ${company?.vatNumber || '—'}, having its registered office at ${company?.registeredAddress || '—'} (the "Service Provider"),`, { size: 10, gap: 2 });
  text(T.and, { size: 10, gap: 2 });
  // Blank client fields show a bracketed "[ … ]" placeholder so it's obvious
  // what the Client will confirm on signing; a filled value reads as plain text.
  const TBC = isGreek(contract) ? '[ θα επιβεβαιωθεί κατά την υπογραφή ]' : '[ to be confirmed on signing ]';
  // country may be a bare ISO code ("CY") from the admin record — expand to a
  // readable country name for the legal party clause.
  const ISO = { CY: 'Cyprus', GR: 'Greece', GB: 'United Kingdom', SA: 'Saudi Arabia', MT: 'Malta' };
  const rawCountry = (client?.country || '').trim();
  const clientCountry = rawCountry
    ? (/^[A-Za-z]{2}$/.test(rawCountry) ? (ISO[upper(rawCountry)] || upper(rawCountry)) : rawCountry)
    : (isGreek(contract) ? '[ η χώρα θα επιβεβαιωθεί κατά την υπογραφή ]' : '[ country to be confirmed on signing ]');
  const clientReg = client?.registrationNumber || TBC;
  const clientAddr = client?.address || TBC;
  const entityType = client?.entityType || 'company';
  const clientVat = clientVatDisplay(client, TBC);
  text(clientPartyClause({
    name: client?.companyName || '—',
    entityType,
    country: clientCountry,
    registration: clientReg,
    vat: clientVat,
    address: clientAddr,
    language: contract.language,
  }), { size: 10, gap: 2 });
  text(T.partiesJointly, { size: 10, gap: 10 });

  // --- About the Service Provider — navy pill + intro + credential bullets. --
  // Sales credibility copy, not contractual terms. The Greek document is a
  // deliberately short-form agreement and this block is a third of its first
  // page, so it is omitted there — matching ContractDocumentBody.
  if (!isGreek(contract)) {
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

  // --- Clause numbering (identical logic to ContractDocumentBody). ----------
  // SPONSORSHIP vs SERVICES — see ContractDocumentBody for the rationale; this
  // block must stay identical to it so the draft PDF and the screen agree.
  const sponsorship = isSponsorship(contract);
  const sponsorRights = sponsorship ? computeSponsorshipRights(contract.sponsorshipRights) : [];
  let n = 1;
  const purposeNum = n++;
  const rightsNum = sponsorship ? n++ : null;
  const scopeNum = !sponsorship && lineItems.length > 0 ? n++ : null;
  const analysisScope = sponsorship
    ? { teams: '', coverage: '', opponent: '' }
    : analysisScopeText(contract, seasonLabelFromDates(contract.startDate, contract.endDate));
  const analysisNum = analysisScope.teams ? n++ : null;
  const feesNum = n++;
  const commercial = sponsorship
    ? { intro: '', breakdown: '', commission: '' }
    : commercialModelText(contract, (a) => fmtMoney(a, contract.currency));
  const commercialNum = commercial.intro ? n++ : null;
  const brandingNum = sponsorship ? n++ : null;
  const serviceLevelsNum = hasMatchServices(contract) ? n++ : null;
  // SHORT FORM (see isShortForm): the standalone Confidentiality, IP, Liability
  // and Force Majeure sections are replaced by one compact "general terms"
  // clause, and Termination/Governing Law fold into it. Null numbers let the
  // remaining clauses renumber contiguously and skip the render below.
  const shortForm = isShortForm(contract);
  const confidentialityNum = shortForm ? null : n++;
  const ipNum = shortForm ? null : n++;
  const durationNum = n++;
  const terminationNum = shortForm ? null : n++;
  const liabilityNum = shortForm ? null : n++;
  const forceMajeureNum = shortForm ? null : n++;
  const governingLawNum = shortForm ? null : n++;
  const specialTermsParsed = parseSpecialTerms(contract.specialTerms);
  const specialTermsNum = specialTermsParsed.length ? n++ : null;
  // SHORT FORM: no general-terms clause at all — the document ends with the
  // commercial sections. See isShortForm for what this drops.
  const entireAgreementNum = shortForm ? null : n++;

  // --- Purpose — STRUCTURED by service group when services exist. -----------
  pillHeader(purposeNum, T.s_purpose);
  if (sponsorship) {
    // Sponsorship: name the Property, mirroring the executed KFC agreement.
    const propName = contract.sponsorshipProperty || '[the sponsored property to be confirmed]';
    const propDetail = contract.sponsorshipPropertyDetail ? `, ${contract.sponsorshipPropertyDetail}` : '';
    text(`The purpose of this Agreement is to establish the sponsorship collaboration between the Parties in relation to ${propName}${propDetail} (the "Property"), under which the Service Provider shall grant the Client the sponsorship rights set out in this Agreement.`, { size: 10, gap: 10 });
  } else if (lineItems.length > 0) {
    text(T.purposeIntro, { size: 10, gap: 6 });
    SERVICE_GROUPS.forEach((group) => {
      const groupItems = lineItems.filter((i) => i.group === group);
      if (!groupItems.length) return;
      ensure(30);
      // Service-group subheading: cyan accent bar + navy uppercase label
      // (colour lives in the bar; the text stays navy and fully legible).
      y += 10;
      const ghBaseline = y;
      doc.setFillColor(...CYAN);
      doc.rect(M, ghBaseline - 8, 3, 10, 'F');
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(upper(isGreek(contract) ? elServiceGroup(group) : group), M + 8, ghBaseline);
      y += 4;
      groupItems.forEach((i) => {
        const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
        const chipLabel = i.included ? 'Included' : null;
        const itemX = M + 12;
        const itemW = maxW - 12;
        // Label line: navy bold label + grey qty note + inline chip.
        ensure(16);
        y += 10;                  // baseline for the label line
        const labelBaseline = y;
        let lx = itemX;
        doc.setFont(FONT, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...NAVY);
        doc.text(i.label, lx, labelBaseline);
        lx += doc.getTextWidth(i.label);
        if (qtyNote) {
          doc.setFont(FONT, 'normal');
          doc.setTextColor(...GREY);
          doc.text(qtyNote, lx, labelBaseline);
          lx += doc.getTextWidth(qtyNote);
        }
        if (chipLabel) { lx += 6; chip(chipLabel, lx, labelBaseline); }
        y += 3;
        // Detail line(s) in grey, indented.
        text(i.detail, { size: 9.5, color: SOFT_GREY, gap: 2, x: itemX, width: itemW });
        if (i.key === 'platform_access') {
          const seats = seatsForService(services, i.key, contract.language);
          if (seats) accessCallout(`${T.accessLabel} ${seats} ${T.accessConfirm}`, itemX + 10, itemW - 10);
        }
      });
      y += 6;
    });
    // Only when the deal covers matches — see the note in contractPdf.ts.
    if (hasMatchServices(contract)) text('Key analytical outputs are delivered after each match in accordance with the Service Levels set out below.', { size: 10, gap: 10 });
  } else {
    text(contract.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.', { size: 10, gap: 10 });
  }

  // --- Sponsorship Rights (sponsorship only) -------------------------------
  // Grouped exactly like the Purpose service groups (cyan bar + navy uppercase
  // heading) so the two document kinds share one visual language.
  if (rightsNum) {
    pillHeader(rightsNum, 'Sponsorship Rights');
    if (sponsorRights.length > 0) {
      text('In consideration of the fee set out below, the Service Provider shall provide the Client with the following sponsorship rights in relation to the Property:', { size: 10, gap: 6 });
      SPONSORSHIP_RIGHT_GROUPS.forEach((group) => {
        const groupRows = sponsorRights.filter((r) => r.group === group);
        if (!groupRows.length) return;
        ensure(30);
        y += 10;
        const ghBaseline = y;
        doc.setFillColor(...CYAN);
        doc.rect(M, ghBaseline - 8, 3, 10, 'F');
        doc.setFont(FONT, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...NAVY);
        doc.text(upper(group), M + 8, ghBaseline);
        y += 4;
        groupRows.forEach((r) => {
          const itemX = M + 12;
          const itemW = maxW - 12;
          ensure(16);
          y += 10;
          doc.setFont(FONT, 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(...NAVY);
          // The rights phrase can wrap, so lay it out with the wrapping helper
          // rather than a single doc.text call.
          const phrase = sponsorshipRightText(r);
          const lines = doc.splitTextToSize(phrase, itemW);
          lines.forEach((ln, li) => {
            if (li > 0) { ensure(14); y += 12; }
            doc.text(ln, itemX, y);
          });
          y += 3;
          if (r.detail) text(r.detail, { size: 9.5, color: SOFT_GREY, gap: 2, x: itemX, width: itemW });
        });
        y += 6;
      });
      if (contract.sponsorshipActivation) {
        text(`The sponsorship activation shall apply to ${contract.sponsorshipActivation}.`, { size: 10, gap: 10 });
      }
    } else {
      text(contract.description || '[sponsorship rights to be confirmed]', { size: 10, gap: 10 });
    }
  }

  // --- Scope of Services — premium ruled TABLE (SERVICE | AMOUNT). ----------
  // Player-funded / Shared: itemised via playerFundedScopeRows — each PRICED
  // service at its real price (these ARE the club-fee portion) plus a single
  // "Player-funded contribution" row (value − club fee, VAT-free); the rows sum
  // to the value. Services-basis deals show real per-line prices. Mirrors
  // ContractDocumentBody + contractPdf.ts.
  if (scopeNum) {
    pillHeader(scopeNum, T.s_scope);

    const pf = isPlayerFunded(contract);
    const pfRows = playerFundedScopeRows(contract, lineItems, (a) => fmtMoney(a, contract.currency));
    // Net/VAT/gross on the NET basis, so this total block reconciles with the
    // Fees sentence below (see vatSummary). vs.net is the headline value.
    const scopeVs = vatSummary(contract, (a) => fmtMoney(a, contract.currency), client);

    const qtyColW = 90;                       // right column width for QTY
    const svcColW = maxW - qtyColW;
    const cellPadX = 10;
    const qtyX = M + svcColW;                 // left edge of the QTY column

    // Header row: navy band, white "SERVICE" / "QTY".
    const headH = 20;
    ensure(headH + 4);
    y += 4;
    const headTop = y;
    doc.setFillColor(...NAVY);
    doc.rect(M, headTop, maxW, headH, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
    doc.text(upper(T.th_service), M + cellPadX, headTop + 13);
    doc.text(upper(T.th_amount), W - M - cellPadX, headTop + 13, { align: 'right' });
    y = headTop + headH;

    // Body rows: wrapped service label (+ optional seats subline) on the left,
    // qty on the right, thin rule under each row.
    doc.setFont(FONT, 'normal');
    lineItems.forEach((i) => {
      const priceStr = fmtMoney(i.listPrice, contract.currency);
      // Compose the service label; platform access carries a seats subline.
      const seats = seatsForService(services, i.key, contract.language);
      const subline = seats ? `${T.accessLabel} ${seats} ${T.accessConfirmNoStop}` : '';

      // Measure wrapped label height so the row + rule size correctly.
      doc.setFontSize(9.5);
      const labelLines = doc.splitTextToSize(i.label, svcColW - cellPadX * 2);
      const subLines = subline ? doc.splitTextToSize(subline, svcColW - cellPadX * 2 - 8) : [];
      // Highlighted seats box carries extra vertical padding around the text.
      const subBlockH = subLines.length ? subLines.length * 11 + 10 : 0;
      const rowH = 10 + labelLines.length * 12 + subBlockH;
      ensure(rowH + 2);
      const rowTop = y;

      // Service label (navy).
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...BLACK);
      let ly = rowTop + 12;
      labelLines.forEach((ln) => { doc.text(ln, M + cellPadX, ly); ly += 12; });
      // Seats subline — highlighted callout: cyan-tinted box, cyan left accent,
      // navy text so this contractually important line stands out.
      if (subLines.length) {
        const boxX = M + cellPadX;
        const boxW = svcColW - cellPadX * 2;
        const boxTop = ly + 1;
        const boxH = subLines.length * 11 + 6;
        doc.setFillColor(...CYAN_BOX_BG);
        doc.roundedRect(boxX, boxTop, boxW, boxH, 2, 2, 'F');
        doc.setFillColor(...CYAN);
        doc.rect(boxX, boxTop, 2, boxH, 'F');
        doc.setFont(FONT, 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        let sy = boxTop + 9;
        subLines.forEach((ln) => { doc.text(ln, boxX + 6, sy); sy += 11; });
        ly = boxTop + boxH;
      }
      // Amount, right-aligned near the first label line. Included lines show the
      // list price struck through + "Incl." so the value is visible but unbilled.
      const amtBaseline = rowTop + 12;
      const rightX = W - M - cellPadX;
      doc.setFontSize(9.5);
      if (pf) {
        // Player-funded: each PRICED service shows its real price; zero-priced
        // catalogue items remain "Included" deliverables. The player-funded
        // contribution is added as its own row after the loop.
        if (Number(i.listPrice) > 0) {
          doc.setFont(FONT, 'normal'); doc.setTextColor(...BLACK);
          doc.text(fmtMoney(i.listPrice, contract.currency), rightX, amtBaseline, { align: 'right' });
        } else {
          doc.setFont(FONT, 'bold'); doc.setTextColor(16, 150, 105);
          doc.text('Included', rightX, amtBaseline, { align: 'right' });
        }
      } else if (i.included && i.listPrice > 0) {
        // Waived a real value: struck-through list price + "Incl."
        const inclW = doc.getTextWidth('Incl.');
        doc.setFont(FONT, 'bold'); doc.setTextColor(16, 150, 105);
        doc.text('Incl.', rightX, amtBaseline, { align: 'right' });
        const priceX = rightX - inclW - 6;
        doc.setFont(FONT, 'normal'); doc.setTextColor(150, 160, 170);
        doc.text(priceStr, priceX, amtBaseline, { align: 'right' });
        const pw = doc.getTextWidth(priceStr);
        doc.setDrawColor(150, 160, 170); doc.setLineWidth(0.6);
        doc.line(priceX - pw, amtBaseline - 3, priceX, amtBaseline - 3);
      } else if (i.included) {
        // No value to strike — just "Included".
        doc.setFont(FONT, 'bold'); doc.setTextColor(16, 150, 105);
        doc.text('Included', rightX, amtBaseline, { align: 'right' });
      } else {
        doc.setFont(FONT, 'normal'); doc.setTextColor(...BLACK);
        doc.text(priceStr, rightX, amtBaseline, { align: 'right' });
      }

      y = rowTop + rowH;
      // Row separator rule.
      doc.setDrawColor(220, 224, 230);
      doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y);
    });

    // Player-funded contribution — the net player portion as its own VAT-free row.
    if (pf && pfRows?.playerLine) {
      ensure(rowH);
      const baseline = y + 12;
      doc.setFont(FONT, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...BLACK);
      doc.text(pfRows.playerLine.label, M + cellPadX, baseline);
      doc.text(fmtMoney(pfRows.playerLine.amount, contract.currency), W - M - cellPadX, baseline, { align: 'right' });
      y += rowH;
      doc.setDrawColor(220, 224, 230); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
    }

    // Total row(s): heavier top rule + navy bold total. On the NET basis: the
    // headline is NET (ex-VAT); when VAT applies, VAT and the gross total follow
    // as their own rows so the figures reconcile with the Fees sentence.
    ensure(scopeVs.applies ? 52 : 24);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(1);
    doc.line(M, y, W - M, y);
    y += 15;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(scopeVs.applies ? T.totalContractValue : T.totalContractValuePlain, M + cellPadX, y);
    doc.text(fmtMoney(scopeVs.net, contract.currency), W - M - cellPadX, y, { align: 'right' });
    y += 12;
    if (scopeVs.applies) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(90, 100, 110);
      doc.text(`${T.vatLine} (${scopeVs.ratePct}%)`, M + cellPadX, y);
      doc.text(fmtMoney(scopeVs.vat, contract.currency), W - M - cellPadX, y, { align: 'right' });
      y += 13;
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.6);
      doc.line(M, y - 9, W - M, y - 9);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(T.totalInclVat, M + cellPadX, y);
      doc.text(fmtMoney(scopeVs.gross, contract.currency), W - M - cellPadX, y, { align: 'right' });
      y += 12;
    }
  }

  // --- Scope of Analysis ---------------------------------------------------
  if (analysisNum) {
    pillHeader(analysisNum, T.s_analysis);
    text(`The Service Provider shall provide performance analysis for the following teams of the Client: ${analysisScope.teams}. ${analysisScope.coverage}`, { size: 10, gap: analysisScope.opponent ? 6 : 10 });
    // Cyan-bar "Opponent access" subheading + granted items — only if any granted.
    if (analysisScope.opponent) {
      ensure(20);
      y += 10;
      const oaBaseline = y;
      doc.setFillColor(...CYAN);
      doc.rect(M, oaBaseline - 8, 3, 10, 'F');
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text('OPPONENT ACCESS', M + 8, oaBaseline);
      y += 4;
      text(analysisScope.opponent, { size: 10, gap: 10 });
    }
  }

  // --- Fees & Payment ------------------------------------------------------
  {
    // Every known payment type has a translation; an unknown one falls back to
    // the raw value rather than printing nothing.
    const payWord = T[`payWord_${contract.paymentType}`] || (contract.paymentType || '').replace('_', ' ');
    ensure(40);
    pillHeader(feesNum, T.s_fees);
    const vs = vatSummary(contract, (a) => fmtMoney(a, contract.currency), client);
    const pt = paymentTimingWording(contract);
    text(`${feesConsiderationPhrase(contract)}, ${T.feesShallPay} ${fmtMoney(vs.net, contract.currency)}${vs.applies ? ` ${T.feesExclVat}` : ''}, ${T.feesPayable} ${payWord}${pt.timingPhrase}`, { size: 10, gap: vs.sentence ? 3 : 6 });
    if (vs.sentence) text(vs.sentence, { size: 10, gap: 6 });
    // Instalment schedule table (only when more than one payment).
    const pays = Array.isArray(contract.payments) ? contract.payments : [];
    if (pays.length > 1) {
      const amtX = W - M - 12;
      const dateX = M + maxW * 0.5;
      ensure(16);
      y += 12;
      doc.setFont(FONT, 'bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
      doc.text(upper(T.th_payment), M + 6, y);
      doc.text(upper(T.th_dueDate), dateX, y);
      doc.text(upper(vs.amountLabel || 'Amount'), amtX, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
      pays.forEach((p, i) => {
        ensure(16); y += 13;
        doc.setFont(FONT, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...BLACK);
        doc.text(`${T.instalment} ${i + 1}`, M + 6, y);
        doc.text(p.dueDate ? fmtDate(p.dueDate) : '—', dateX, y);
        doc.setFont(FONT, 'bold');
        doc.text(fmtMoney(p.totalAmount != null ? p.totalAmount : p.amount, contract.currency), amtX, y, { align: 'right' });
        y += 3;
        doc.setDrawColor(220, 224, 230); doc.setLineWidth(0.4); doc.line(M, y, W - M, y);
      });
      y += 8;
    }
    if (pt.advanceInvoiceSentence) text(pt.advanceInvoiceSentence, { size: 10, gap: 6 });
    text(bankTransferSentence({ language: contract.language, perInstalment: !!pt.advanceInvoiceSentence, latePaymentPenalty: contract.latePaymentPenalty }), { size: 10, gap: 10 });
  }

  // --- Tinted bank-details box. --------------------------------------------
  if (company?.bankName || company?.bankIBAN || company?.bankSWIFT) {
    const bankLines = [
      company?.name ? `${T.accountName}: ${company.name}` : null,
      company?.bankName ? `${T.bank}: ${company.bankName}` : null,
      company?.bankIBAN ? `${T.iban}: ${company.bankIBAN}` : null,
      company?.bankSWIFT ? `${T.swift}: ${company.bankSWIFT}` : null,
    ].filter(Boolean);
    const boxH = 14 + 12 + bankLines.length * 13 + 10;
    ensure(boxH + 4);
    const boxTop = y;
    const innerX = M + 12;
    doc.setFillColor(...BOX_BG);
    doc.setDrawColor(...BOX_BORDER);
    doc.setLineWidth(0.75);
    doc.roundedRect(M, boxTop, maxW, boxH, 4, 4, 'FD');
    doc.setLineWidth(0.2);
    y = boxTop + 14;
    text(T.bankDetailsHeading, { x: innerX, size: 8, style: 'bold', color: NAVY, gap: 4 });
    for (const bl of bankLines) text(bl, { x: innerX, size: 9, color: SOFT_GREY, gap: 1 });
    y = boxTop + boxH + 10;
  }

  // --- Commercial Terms & Club Commission ----------------------------------
  if (commercialNum) {
    const paras = [`${commercial.intro}. ${commercial.breakdown}`];
    if (commercial.commission) paras.push(commercial.commission);
    clause(commercialNum, 'Commercial Terms & Club Commission', ...paras);
  }

  // --- Branding & Materials (sponsorship only) -----------------------------
  if (brandingNum) {
    clause(brandingNum, 'Branding & Materials',
      'The Client shall provide all required advertising materials and brand assets in a suitable format within the agreed production timelines. The Service Provider shall ensure the placement and visibility of the agreed sponsorship elements in accordance with this Agreement.',
      "The Client grants the Service Provider a non-exclusive, royalty-free licence to use the Client's name, logo and brand assets solely for the purpose of delivering the sponsorship rights set out in this Agreement. Where the Client fails to supply materials within the agreed timelines, the Service Provider shall not be liable for any resulting loss of exposure, and the fee shall remain payable in full.");
  }

  // --- Service Levels ------------------------------------------------------
  if (serviceLevelsNum) {
    const slLines = serviceLevelsLines(contract);
    const excl = " These timeframes exclude weekends, public holidays and any delay caused by the Client, third parties or events beyond the Service Provider's reasonable control.";
    const remedy = "Where the Service Provider fails to meet the applicable service level for a given match, it shall remedy the delay within a reasonable cure period. The Client's sole and exclusive remedy for a service-level failure shall be a proportionate service credit against the fees for the affected deliverables; a service-level failure shall not, of itself, entitle the Client to terminate this Agreement, save in the case of repeated and material failures not remedied following written notice.";
    clause(serviceLevelsNum, 'Service Levels', slLines[0] + excl, remedy);
  }

  // --- Confidentiality & Data Protection (lilac callout) -------------------
  // Sponsorship uses an independent-controllers variant (SCIOS is not the
  // sponsor's data processor) — see confidentialityParas in constants.js.
  if (confidentialityNum) {
    const cp = confidentialityParas(contract);
    calloutClause(confidentialityNum, T.s_confidentiality, cp.lead, ...cp.paras);
  }

  // --- Intellectual Property Rights ----------------------------------------
  // Sponsorship must NOT license the Deliverables to the Client — see ipParas.
  if (ipNum) clause(ipNum, T.s_ip, ...ipParas(contract));

  // --- Duration ------------------------------------------------------------
  clause(durationNum, T.s_duration,
    durationSentence({ language: contract.language, startDate: fmtDate(contract.startDate), endDate: fmtDate(contract.endDate), termYears, terminationNum }));

  // --- Termination ---------------------------------------------------------
  if (terminationNum) clause(terminationNum, T.s_termination,
    T.terminationNotice,
    terminationEffectPara(contract));

  // --- Limitation of Liability ---------------------------------------------
  if (liabilityNum) clause(liabilityNum, T.s_liability,
    T.liability);

  // --- Force Majeure -------------------------------------------------------
  if (forceMajeureNum) clause(forceMajeureNum, T.s_forceMajeure,
    T.forceMajeure);

  // --- Governing Law & Jurisdiction ----------------------------------------
  if (governingLawNum) clause(governingLawNum, T.s_governingLaw,
    governingLawSentence({ language: contract.language, governingLaw: contract.governingLaw, jurisdiction: contract.jurisdiction }));

  // --- Special Terms (optional) — numbered list, each optionally clause-ref'd.
  if (specialTermsNum) {
    ensure(40);
    pillHeader(specialTermsNum, T.s_specialTerms);
    specialTermsParsed.forEach((t, i) => {
      const ref = t.relatesTo && t.relatesTo !== 'General' ? `${T.reRef} ${clauseName(t.relatesTo, contract.language)}. ` : '';
      text(`${i + 1}.  ${ref}${t.text}`, { size: 10, gap: i === specialTermsParsed.length - 1 ? 10 : 3, x: M + 6, width: maxW - 6 });
    });
  }

  // --- Entire Agreement ----------------------------------------------------
  if (entireAgreementNum) clause(entireAgreementNum, T.s_entireAgreement, T.entireAgreement);

  // --- Designated Contact block (present once captured at signing). ---------
  if (contract.contactName) {
    pillHeader(null, T.designatedContact);
    const opsBits = [contract.contactName, contract.contactRole].filter(Boolean).join(', ');
    const opsTail = [contract.contactEmail, contract.contactPhone].filter(Boolean).join(' · ');
    text(`Client's designated contact for operations & communication: ${opsBits}${opsTail ? ' · ' + opsTail : ''}.`, { size: 10, gap: 2 });
    if (contract.financeName || contract.financeEmail) {
      text(`Finance contact: ${[contract.financeName, contract.financeEmail].filter(Boolean).join(' · ')}.`, { size: 10, gap: 2 });
    }
    y += 6;
  }

  // --- Navy closing panel — warm, confident sign-off before signatures. ----
  // Warm sign-off panel — omitted on the short form, where it is the largest
  // remaining block that is not a term of the deal.
  if (!shortForm) {
    const padX = 16, padY = 14, innerW = maxW - padX * 2;
    const body = closingNote({ language: contract.language, clientName });
    const emph = T.closingTagline;
    doc.setFont(FONT, 'normal'); doc.setFontSize(10);
    const bodyLines = doc.splitTextToSize(body, innerW);
    doc.setFont(FONT, 'bold');
    const emphLines = doc.splitTextToSize(emph, innerW);
    const boxH = padY * 2 + bodyLines.length * 14 + 6 + emphLines.length * 14;
    ensure(boxH + 12);
    const boxTop = y;
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, boxTop, maxW, boxH, 4, 4, 'F');
    let ty = boxTop + padY;
    doc.setFont(FONT, 'normal'); doc.setFontSize(10); doc.setTextColor(230, 236, 247);
    bodyLines.forEach((ln) => { ty += 10; doc.text(ln, M + padX, ty); ty += 4; });
    ty += 6;
    doc.setFont(FONT, 'bold'); doc.setTextColor(...CYAN);
    emphLines.forEach((ln) => { ty += 10; doc.text(ln, M + padX, ty); ty += 4; });
    y = boxTop + boxH + 14;
  }

  // --- SIGNATURES — two columns with real signature IMAGES. ----------------
  // Keep the whole block together; push to a fresh page if it wouldn't fit.
  ensure(210);
  pillHeader(null, T.s_signatures);
  text(T.executedBy, { size: 8, color: GREY, gap: 12 });

  const colW = (maxW - 30) / 2;
  const colX = [M, M + colW + 30];
  const heads = [`${T.forAndOnBehalfOf} ${companyName}`, `${T.forAndOnBehalfOf} ${clientName}`];

  const signed = !!contract.signedAt;
  // The provider counter-signs as of the agreement date — NOT sentAt, which
  // moves on every re-send and split this date from the "made on" line above.
  const provDate = agreementDate(contract);
  const cols = [
    // Provider column = Scios authorised signatory (auto counter-signature).
    { sigImg: company?.signatorySignature || null, sigFallback: company?.signatoryName || '', name: company?.signatoryName || '', title: company?.signatoryTitle || '', date: (company?.signatoryName ? fmtDate(provDate) : '') },
    // Client column = the client's drawn signature when signed (blank pre-sign).
    { sigImg: signed ? (contract.signerSignature || null) : null, sigFallback: signed ? (contract.signerName || '') : '', name: signed ? (contract.signerName || '') : '', title: signed ? (contract.signerTitle || '') : '', date: signed ? fmtDate(contract.signedAt) : '' },
  ];

  // Pre-compute the authorised-representative caption (client column only) so we
  // reserve equal vertical space in BOTH columns and keep the signature lines
  // aligned. Party heading stays the Client (bound); caption records who signed.
  let repLines = [];
  if (contract.signerOnBehalf && contract.representativeCompany) {
    doc.setFont(FONT, 'normal'); doc.setFontSize(7);
    const reg = contract.representativeRegistration ? ` (${T.regNoShort} ${contract.representativeRegistration})` : '';
    repLines = doc.splitTextToSize(`Signed by ${contract.representativeCompany}${reg}, as duly authorised representative`, colW).slice(0, 2);
    if (contract.signerAuthorityBasis) {
      repLines = repLines.concat(doc.splitTextToSize(`Authority: ${contract.signerAuthorityBasis}`, colW).slice(0, 1));
    }
  }
  const capReserve = repLines.length ? repLines.length * 8 + 4 : 0;

  ensure(190 + capReserve);
  const blockTop = y;
  let maxColBottom = y;
  cols.forEach((col, idx) => {
    const x = colX[idx];
    let yy = blockTop;
    // Column header, navy uppercase.
    yy += 9;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(upper(heads[idx]).slice(0, 60), x, yy);
    yy += 12;

    // Draw caption on the CLIENT column; reserve the same space on the other.
    if (idx === 1 && repLines.length) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      repLines.forEach((ln, i) => doc.text(ln, x, yy + i * 8));
      yy += repLines.length * 8 + 4;
    } else {
      yy += capReserve;
    }
    yy += 4;

    // Signature area: reserve a tall band; draw a LARGE image just above the
    // signature line, else the italic name fallback.
    const sigLineY = yy + 64;   // downward position of the ruled signature line
    let drewImg = false;
    if (col.sigImg) {
      // Provider (idx 0) counter-signature draws smaller than the client's.
      const fit = idx === 0 ? fitImage(col.sigImg, 135, 46) : fitImage(col.sigImg, 190, 64);
      if (fit) {
        try {
          doc.addImage(col.sigImg, imgFormat(col.sigImg), x + 2, sigLineY - fit.h - 3, fit.w, fit.h);
          drewImg = true;
        } catch (_) { drewImg = false; }
      }
    }
    if (!drewImg && col.sigFallback) {
      doc.setFont(FONT, 'italic');
      doc.setFontSize(20);
      doc.setTextColor(...BLACK);
      doc.text(col.sigFallback, x + 2, sigLineY - 6);
    }
    // Signature line + label.
    doc.setDrawColor(150, 160, 170);
    doc.line(x, sigLineY, x + colW, sigLineY);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 148, 156);
    doc.text(T.sig_signature, x, sigLineY + 10);
    yy = sigLineY + 26;

    const field = (label, val) => {
      if (val) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        doc.text(String(val), x + 2, yy - 3);
      }
      doc.setDrawColor(150, 160, 170);
      doc.line(x, yy + 2, x + colW, yy + 2);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 148, 156);
      doc.text(upper(label), x, yy + 12);
      yy += 28;
    };
    field(T.sig_name, col.name);
    field(T.sig_title, col.title);
    field(T.sig_date, col.date);
    if (yy > maxColBottom) maxColBottom = yy;
  });
  y = maxColBottom + 8;

  // Closing rule + signer note are trailing decoration, so they must never be
  // what starts a new page: `rule()` calls ensure(), which would break to a
  // fresh page and draw a lone hairline on it, and that page then defeats the
  // empty-page check below (y has advanced past pageContentStart). Only draw
  // them if they genuinely fit on the current page.
  const tailNeed = 12 + (shortForm ? 0 : 30);
  if (y + tailNeed <= H - BOTTOM) {
    rule();
    // Signer guidance, not a term of the deal — omitted on the short form.
    if (!shortForm) text(T.reviewNote, { size: 9, color: GREY });
  }

  // Drop a trailing page that ended up with no body content (a page-break
  // artifact where the last block spilled but drew nothing meaningful).
  if (doc.getNumberOfPages() > 1 && y <= pageContentStart + 1) {
    doc.deletePage(doc.getNumberOfPages());
  }

  // --- Footer band on every page. ------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter();
  }

  return doc;
}

// Convenience: trigger a browser download of the contract PDF.
// Async because the Unicode font is fetched on first use (see pdfFont.js).
export async function downloadContractPdf({ contract, client, company }) {
  const doc = await generateContractPdf({ contract, client, company });
  doc.save(`${contract.contractNumber || 'contract'}.pdf`);
}
