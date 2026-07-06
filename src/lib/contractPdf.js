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
import { fmtDate, fmtMoney, daysBetween } from './format.js';
import { computeServiceLineItems, platformSeatsSummary, SERVICE_GROUPS, analysisScopeText, seasonLabelFromDates, commercialModelText } from './constants.js';

export function generateContractPdf({ contract, client, company }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
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
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(crossSize);
    const crossW = doc.getTextWidth('×');

    // Resolve Scios + client lockup elements. Images preferred; text fallback.
    const sosLogo = company?.logo || null;
    const clientLogo = client?.logoBase64 || null;
    const sosFit = sosLogo ? fitImage(sosLogo, logoMaxW, logoH) : null;
    const cliFit = clientLogo ? fitImage(clientLogo, logoMaxW, logoH) : null;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const sosW = sosFit ? sosFit.w : doc.getTextWidth('SCIENCE OF SPORTS');
    doc.setFontSize(12);
    const cliW = cliFit ? cliFit.w : doc.getTextWidth(clientName.toUpperCase());

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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...WHITE);
      doc.text('SCIENCE OF SPORTS', cx, lockCenterY + 4);
    }
    cx += sosW + gap;

    // --- Cyan multiplication cross. ---
    doc.setFont('helvetica', 'normal');
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...WHITE);
      doc.text(clientName.toUpperCase(), cx, lockCenterY + 4);
    }

    // --- Cyan contract number, centred below the lockup. ---
    if (contractNumber) {
      doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text('SCIENCE OF SPORTS', M, 17);
    if (contractNumber) {
      doc.setFont('helvetica', 'normal');
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(companyName, M, H - 20);
    const email = company?.contactEmail || 'info@scienceofsports.net';
    const reg = company?.registrationNumber || 'HE 449875';
    const vat = company?.vatNumber;
    const line2 = `${email} · +357 22 396997 · Reg. No. ${reg}${vat ? ' · VAT ' + vat : ''}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...FOOTER_GREY);
    doc.text(line2, M, H - 10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...CYAN);
    doc.text('Transforming matches into knowledge.', W - M, H - 14, { align: 'right' });
  };

  // -------------------------------------------------------------------------
  // Layout cursor + page management. `y` grows downward (jsPDF native top-down).
  // -------------------------------------------------------------------------
  let y = CONTENT_TOP_P1;
  const newPage = () => {
    doc.addPage();
    drawHeaderRest();
    y = CONTENT_TOP_REST;
  };
  const ensure = (need) => { if (y + need > H - BOTTOM) newPage(); };

  // Word-wrapped text writer. Advances y downward.
  const text = (str, opts = {}) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? 'normal';
    const color = opts.color ?? BLACK;
    const x = opts.x ?? M;
    const width = opts.width ?? maxW;
    doc.setFont('helvetica', style);
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
    doc.setFont('helvetica', 'bold');
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

  // Small inline "Included"/"Complimentary" chip: light-cyan rounded rect with
  // cyan-deep bold text. `baselineY` is the text baseline of the line it sits on.
  const chip = (label, x, baselineY) => {
    const size = 8;
    const padX = 6;
    const chipH = 12;
    const green = label === 'Complimentary';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    const w = doc.getTextWidth(label) + padX * 2;
    doc.setFillColor(...(green ? CHIP_GREEN_BG : CHIP_BG));
    doc.roundedRect(x, baselineY - chipH + 3, w, chipH, 3, 3, 'F');
    doc.setTextColor(...(green ? CHIP_GREEN_TX : CYAN_DEEP));
    doc.text(label, x + padX, baselineY - 0.5);
    return x + w;
  };

  // --- Data prep -----------------------------------------------------------
  const services = contract.services;
  const lineItems = services ? computeServiceLineItems(services) : [];
  const termYears = contract.startDate && contract.endDate
    ? Math.max(1, Math.round(daysBetween(contract.startDate, contract.endDate) / 365)) : null;

  // --- Page 1 header band ---------------------------------------------------
  drawHeaderP1();

  // --- Title split on the dash: client name on top, agreement type below. ---
  {
    const parts = (contract.title || 'Service Agreement').split(/\s+[—–-]\s+/);
    const centered = (str, size, gap) => {
      ensure(size + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(...NAVY);
      y += size;
      doc.text(str, W / 2, y, { align: 'center' });
      y += gap;
    };
    centered((parts[0] || '').toUpperCase(), 18, parts.length > 1 ? 4 : 8);
    if (parts.length > 1) centered(parts.slice(1).join(' - ').toUpperCase(), 13, 8);
  }
  rule();

  // --- Preamble — both parties, full details. ------------------------------
  text(`This Agreement is made on ${fmtDate(contract.createdAt || contract.sentAt || new Date().toISOString())} between:`, { size: 10, gap: 4 });
  text(`${company?.name || '—'}, a company registered under the laws of the Republic of Cyprus with registration number ${company?.registrationNumber || '—'}, VAT number ${company?.vatNumber || '—'}, having its registered office at ${company?.registeredAddress || '—'} (the "Service Provider"),`, { size: 10, gap: 2 });
  text('and', { size: 10, gap: 2 });
  text(`${client?.companyName || '—'}, ${client?.registrationNumber ? `a company registered with registration number ${client.registrationNumber}, ` : ''}having its registered office at ${client?.address || '[address]'} (the "Client").`, { size: 10, gap: 2 });
  text('The above are hereinafter jointly referred to as the "Parties".', { size: 10, gap: 10 });

  // --- About the Service Provider — navy pill + intro + credential bullets. --
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

  // --- Clause numbering (identical logic to ContractDocumentBody). ----------
  let n = 1;
  const purposeNum = n++;
  const scopeNum = lineItems.length > 0 ? n++ : null;
  const analysisScope = analysisScopeText(contract, seasonLabelFromDates(contract.startDate, contract.endDate));
  const analysisNum = analysisScope.teams ? n++ : null;
  const feesNum = n++;
  const commercial = commercialModelText(contract, (a) => fmtMoney(a, contract.currency));
  const commercialNum = commercial.intro ? n++ : null;
  const confidentialityNum = n++;
  const ipNum = n++;
  const durationNum = n++;
  const terminationNum = n++;
  const liabilityNum = n++;
  const forceMajeureNum = n++;
  const governingLawNum = n++;
  const specialTermsNum = (contract.specialTerms && contract.specialTerms.trim()) ? n++ : null;
  const entireAgreementNum = n++;

  // --- Purpose — STRUCTURED by service group when services exist. -----------
  pillHeader(purposeNum, 'Purpose');
  if (lineItems.length > 0) {
    text('The purpose of this Agreement is to define the terms of cooperation between the Parties, under which the Service Provider shall provide the Client with the following services:', { size: 10, gap: 6 });
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(group.toUpperCase(), M + 8, ghBaseline);
      y += 4;
      groupItems.forEach((i) => {
        const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
        const chipLabel = i.bundledIncluded ? 'Included' : i.complimentary ? 'Complimentary' : i.unit === 'included' ? 'Included' : null;
        const itemX = M + 12;
        const itemW = maxW - 12;
        // Label line: navy bold label + grey qty note + inline chip.
        ensure(16);
        y += 10;                  // baseline for the label line
        const labelBaseline = y;
        let lx = itemX;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...NAVY);
        doc.text(i.label, lx, labelBaseline);
        lx += doc.getTextWidth(i.label);
        if (qtyNote) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...GREY);
          doc.text(qtyNote, lx, labelBaseline);
          lx += doc.getTextWidth(qtyNote);
        }
        if (chipLabel) { lx += 6; chip(chipLabel, lx, labelBaseline); }
        y += 3;
        // Detail line(s) in grey, indented.
        text(i.detail, { size: 9.5, color: SOFT_GREY, gap: 2, x: itemX, width: itemW });
        if (i.key === 'platform_access') {
          const seats = platformSeatsSummary(services?.platform_access);
          if (seats) text(`Access: ${seats} (exact users to be confirmed with the client).`, { size: 9, color: SOFT_GREY, gap: 2, x: itemX + 10, width: itemW - 10 });
        }
      });
      y += 6;
    });
    text(`${contract.slaHours || 24}-hour SLA on delivery of key analytical outputs after each match.`, { size: 10, gap: 10 });
  } else {
    text(contract.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.', { size: 10, gap: 10 });
  }

  // --- Scope of Services — premium ruled TABLE (SERVICE | QTY). -------------
  if (scopeNum) {
    pillHeader(scopeNum, 'Scope of Services');

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
    doc.text('SERVICE', M + cellPadX, headTop + 13);
    doc.text('QTY', W - M - cellPadX, headTop + 13, { align: 'right' });
    y = headTop + headH;

    // Body rows: wrapped service label (+ optional seats subline) on the left,
    // qty on the right, thin rule under each row.
    doc.setFont('helvetica', 'normal');
    lineItems.forEach((i) => {
      const qty = i.unit === 'flat' ? fmtMoney(i.amount, contract.currency)
        : (i.unit === 'included' || i.complimentary || i.bundledIncluded) ? 'Included'
        : String(i.qty);
      // Compose the service label; platform access carries a seats subline.
      const seats = (i.key === 'platform_access') ? platformSeatsSummary(services?.platform_access) : '';
      const subline = seats ? `Access: ${seats} (exact users to be confirmed with the client)` : '';

      // Measure wrapped label height so the row + rule size correctly.
      doc.setFontSize(9.5);
      const labelLines = doc.splitTextToSize(i.label, svcColW - cellPadX * 2);
      const subLines = subline ? doc.splitTextToSize(subline, svcColW - cellPadX * 2) : [];
      const rowH = 10 + labelLines.length * 12 + (subLines.length ? subLines.length * 11 + 2 : 0);
      ensure(rowH + 2);
      const rowTop = y;

      // Service label (navy).
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...BLACK);
      let ly = rowTop + 12;
      labelLines.forEach((ln) => { doc.text(ln, M + cellPadX, ly); ly += 12; });
      // Seats subline (grey).
      if (subLines.length) {
        doc.setFontSize(8.5);
        doc.setTextColor(...SOFT_GREY);
        ly += 1;
        subLines.forEach((ln) => { doc.text(ln, M + cellPadX, ly); ly += 11; });
      }
      // QTY, right-aligned, vertically near the first label line.
      doc.setFont('helvetica', (qty === 'Included' ? 'bold' : 'normal'));
      doc.setFontSize(9.5);
      doc.setTextColor(...(qty === 'Included' ? NAVY : BLACK));
      doc.text(qty, W - M - cellPadX, rowTop + 12, { align: 'right' });

      y = rowTop + rowH;
      // Row separator rule.
      doc.setDrawColor(220, 224, 230);
      doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y);
    });

    // Total row: heavier top rule + navy bold total.
    ensure(24);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(1);
    doc.line(M, y, W - M, y);
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text('Total Contract Value', M + cellPadX, y);
    doc.text(fmtMoney(contract.value, contract.currency), W - M - cellPadX, y, { align: 'right' });
    y += 12;
  }

  // --- Scope of Analysis ---------------------------------------------------
  if (analysisNum) {
    pillHeader(analysisNum, 'Scope of Analysis');
    text(`The Service Provider shall provide performance analysis for the following teams of the Client: ${analysisScope.teams}. ${analysisScope.coverage}`, { size: 10, gap: analysisScope.opponent ? 6 : 10 });
    // Cyan-bar "Opponent access" subheading + granted items — only if any granted.
    if (analysisScope.opponent) {
      ensure(20);
      y += 10;
      const oaBaseline = y;
      doc.setFillColor(...CYAN);
      doc.rect(M, oaBaseline - 8, 3, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text('OPPONENT ACCESS', M + 8, oaBaseline);
      y += 4;
      text(analysisScope.opponent, { size: 10, gap: 10 });
    }
  }

  // --- Fees & Payment ------------------------------------------------------
  clause(feesNum, 'Fees & Payment',
    `In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of ${fmtMoney(contract.value, contract.currency)}, payable ${(contract.paymentType || '').replace('_', ' ')}, net ${contract.paymentTermsDays} days from the date of a valid invoice.`,
    `All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of ${contract.latePaymentPenalty}% per month applies to overdue amounts.`);

  // --- Tinted bank-details box. --------------------------------------------
  if (company?.bankName || company?.bankIBAN || company?.bankSWIFT) {
    const bankLines = [
      company?.bankName ? `Bank: ${company.bankName}` : null,
      company?.bankIBAN ? `IBAN: ${company.bankIBAN}` : null,
      company?.bankSWIFT ? `SWIFT/BIC: ${company.bankSWIFT}` : null,
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
    text('BANK DETAILS (SERVICE PROVIDER)', { x: innerX, size: 8, style: 'bold', color: NAVY, gap: 4 });
    for (const bl of bankLines) text(bl, { x: innerX, size: 9, color: SOFT_GREY, gap: 1 });
    y = boxTop + boxH + 10;
  }

  // --- Commercial Terms & Club Commission ----------------------------------
  if (commercialNum) {
    const paras = [`${commercial.intro}. ${commercial.breakdown}`];
    if (commercial.commission) paras.push(commercial.commission);
    clause(commercialNum, 'Commercial Terms & Club Commission', ...paras);
  }

  // --- Confidentiality & Data Protection (lilac callout) -------------------
  calloutClause(confidentialityNum, 'Confidentiality & Data Protection',
    'Confidentiality & GDPR.',
    'The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.',
    "All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.");

  // --- Intellectual Property Rights ----------------------------------------
  clause(ipNum, 'Intellectual Property Rights',
    'All match footage, training footage, video recordings, reports, analytics outputs, player data, databases, clips and any other materials produced, collected or generated by the Service Provider under this Agreement (collectively, the "Deliverables") shall be the exclusive property of the Client. The Client shall have unrestricted, irrevocable and royalty-free rights to use, reproduce, store, modify, distribute and archive the Deliverables for any internal purpose. The Service Provider shall not use, reproduce, disclose, commercialize or share any Deliverables with any third party without the Client\'s prior written consent.');

  // --- Duration ------------------------------------------------------------
  clause(durationNum, 'Duration',
    `This Agreement shall commence on ${fmtDate(contract.startDate)} and shall remain in force until ${fmtDate(contract.endDate)}${termYears ? ` (approximately ${termYears} year${termYears > 1 ? 's' : ''})` : ''}, unless terminated earlier in accordance with Section ${terminationNum}.`);

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
    `This Agreement shall be governed by the laws of ${contract.governingLaw}, with exclusive jurisdiction in ${contract.jurisdiction}.`);

  // --- Special Terms (optional) --------------------------------------------
  if (specialTermsNum) {
    clause(specialTermsNum, 'Special Terms', contract.specialTerms);
  }

  // --- Entire Agreement ----------------------------------------------------
  clause(entireAgreementNum, 'Entire Agreement & Amendments',
    'This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.');

  // --- Navy closing panel — warm, confident sign-off before signatures. ----
  {
    const padX = 16, padY = 14, innerW = maxW - padX * 2;
    const body = `Science of Sports is proud to partner with ${clientName} and is committed to delivering performance analysis of the highest professional standard throughout this Agreement.`;
    const emph = 'Transforming matches into knowledge — together.';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const bodyLines = doc.splitTextToSize(body, innerW);
    doc.setFont('helvetica', 'bold');
    const emphLines = doc.splitTextToSize(emph, innerW);
    const boxH = padY * 2 + bodyLines.length * 14 + 6 + emphLines.length * 14;
    ensure(boxH + 12);
    const boxTop = y;
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, boxTop, maxW, boxH, 4, 4, 'F');
    let ty = boxTop + padY;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(230, 236, 247);
    bodyLines.forEach((ln) => { ty += 10; doc.text(ln, M + padX, ty); ty += 4; });
    ty += 6;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...CYAN);
    emphLines.forEach((ln) => { ty += 10; doc.text(ln, M + padX, ty); ty += 4; });
    y = boxTop + boxH + 14;
  }

  // --- SIGNATURES — two columns with real signature IMAGES. ----------------
  // Keep the whole block together; push to a fresh page if it wouldn't fit.
  ensure(210);
  pillHeader(null, 'Signatures');
  text('Executed by the duly authorised representatives of the Parties as of the dates set out below.', { size: 8, color: GREY, gap: 12 });

  const colW = (maxW - 30) / 2;
  const colX = [M, M + colW + 30];
  const heads = [`For and on behalf of ${companyName}`, `For and on behalf of ${clientName}`];

  const signed = !!contract.signedAt;
  const provDate = contract.signedAt || contract.sentAt || contract.createdAt;
  const cols = [
    // Provider column = Scios authorised signatory (auto counter-signature).
    { sigImg: company?.signatorySignature || null, sigFallback: company?.signatoryName || '', name: company?.signatoryName || '', title: company?.signatoryTitle || '', date: (company?.signatoryName ? fmtDate(provDate) : '') },
    // Client column = the client's drawn signature when signed (blank pre-sign).
    { sigImg: signed ? (contract.signerSignature || null) : null, sigFallback: signed ? (contract.signerName || '') : '', name: signed ? (contract.signerName || '') : '', title: signed ? (contract.signerTitle || '') : '', date: signed ? fmtDate(contract.signedAt) : '' },
  ];

  ensure(190);
  const blockTop = y;
  let maxColBottom = y;
  cols.forEach((col, idx) => {
    const x = colX[idx];
    let yy = blockTop;
    // Column header, navy uppercase.
    yy += 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(heads[idx].toUpperCase().slice(0, 60), x, yy);
    yy += 16;

    // Signature area: reserve a tall band; draw a LARGE image just above the
    // signature line, else the italic name fallback.
    const sigLineY = yy + 64;   // downward position of the ruled signature line
    let drewImg = false;
    if (col.sigImg) {
      // Larger signature: fit into a bigger box so it reads bold and prominent.
      const fit = fitImage(col.sigImg, 190, 64);
      if (fit) {
        try {
          doc.addImage(col.sigImg, imgFormat(col.sigImg), x + 2, sigLineY - fit.h - 3, fit.w, fit.h);
          drewImg = true;
        } catch (_) { drewImg = false; }
      }
    }
    if (!drewImg && col.sigFallback) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(20);
      doc.setTextColor(...BLACK);
      doc.text(col.sigFallback, x + 2, sigLineY - 6);
    }
    // Signature line + label.
    doc.setDrawColor(150, 160, 170);
    doc.line(x, sigLineY, x + colW, sigLineY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 148, 156);
    doc.text('SIGNATURE', x, sigLineY + 10);
    yy = sigLineY + 26;

    const field = (label, val) => {
      if (val) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        doc.text(String(val), x + 2, yy - 3);
      }
      doc.setDrawColor(150, 160, 170);
      doc.line(x, yy + 2, x + colW, yy + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 148, 156);
      doc.text(label.toUpperCase(), x, yy + 12);
      yy += 28;
    };
    field('Name', col.name);
    field('Title', col.title);
    field('Date', col.date);
    if (yy > maxColBottom) maxColBottom = yy;
  });
  y = maxColBottom + 8;
  rule();

  // --- Signature note. -----------------------------------------------------
  text('This document is provided for review. To execute it, the Client signs electronically through the secure signing link. Upon signing, a Certificate of Completion containing the full signature evidence is issued to both parties.', { size: 9, color: GREY });

  // --- Footer band on every page. ------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter();
  }

  return doc;
}

// Convenience: trigger a browser download of the contract PDF.
export function downloadContractPdf({ contract, client, company }) {
  const doc = generateContractPdf({ contract, client, company });
  doc.save(`${contract.contractNumber || 'contract'}.pdf`);
}
