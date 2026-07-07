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
const CHIP_GREEN_BG = rgb(0.878, 0.965, 0.933); // light-green chip fill (Complimentary)
const CHIP_GREEN_TX = rgb(0.020, 0.588, 0.412); // #059669 green chip text
const BOX_BG = rgb(0.96, 0.968, 0.976);     // subtle navy tint for boxes
const LILAC_BG = rgb(0.933, 0.941, 0.984);  // #EEF0FB — callout box fill (Confidentiality)
const BOX_BORDER = rgb(0.82, 0.85, 0.89);
const FOOTER_GREY = rgb(0.663, 0.714, 0.8); // #A9B6CC

// Rainbow strip segments (cyan #22C7E6, blue #2563EB, purple #8B5CF6, pink #EC4899)

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
      const svc = services[s.key];
      const qty = Number(svc.qty) || 0;
      // Single "included" concept (merges old complimentary + bundledIncluded).
      const included = s.unit === 'included' || !!svc.included || !!svc.complimentary || !!svc.bundledIncluded;
      const rate = Number(svc.rate != null ? svc.rate : s.defaultRate);
      const listPrice = s.unit === 'flat' ? rate : rate * qty;
      const amount = included ? 0 : listPrice;
      return { ...s, qty, rate, included, listPrice, amount };
    });
}

// Port of vatSummary — derive net/VAT/gross from payment rows. Keep in sync
// with src/lib/constants.js.
function vatSummary(contract: Any, fm: (a: Any) => string): { applies: boolean; sentence: string; amountLabel: string; note: string } {
  const pays = Array.isArray(contract?.payments) ? contract.payments : [];
  const num = (v: Any) => Number(v) || 0;
  let net = 0, vat = 0, gross = 0, rate = 0;
  if (pays.length) {
    for (const p of pays) {
      const a = num(p.amount ?? p.total_amount);
      const v = num(p.vatAmount ?? p.vat_amount);
      net += a; vat += v; gross += (num(p.totalAmount ?? p.total_amount) || (a + v));
      const r = num(p.vatRate ?? p.vat_rate); if (r) rate = r;
    }
  } else {
    net = num(contract?.value); gross = net;
  }
  net = Math.round(net * 100) / 100; vat = Math.round(vat * 100) / 100; gross = Math.round(gross * 100) / 100;
  const applies = vat > 0.005;
  const ratePct = rate ? Math.round(rate * 100) : 19;
  if (applies) {
    return { applies: true, sentence: `The above amount is exclusive of VAT. VAT at ${ratePct}% (${fm(vat)}) applies, giving a total amount payable of ${fm(gross)}.`, amountLabel: 'Amount (incl. VAT)', note: '' };
  }
  const country = contract?.client?.country || contract?.clientCountry;
  const hasVatNo = contract?.client?.vatNumber || contract?.clientVatNumber;
  const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  let noteText = '';
  if (country && EU.includes(country) && country !== 'CY' && hasVatNo) noteText = 'The VAT reverse-charge mechanism applies (Article 196, EU VAT Directive); the Client shall self-account for VAT.';
  else if (country && !EU.includes(country)) noteText = 'This supply is outside the scope of Cyprus VAT.';
  return { applies: false, sentence: noteText, amountLabel: 'Amount', note: noteText };
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

// Port of analysisScopeText — build the two "Scope of Analysis" sentences.
// Keep in sync with src/lib/constants.js. Accepts snake_case or camelCase.
function analysisScopeText(c: Any, seasonLabel: string): { teams: string; coverage: string; opponent: string } {
  const teamsArr = Array.isArray(c?.analysisTeams) ? c.analysisTeams : (Array.isArray(c?.analysis_teams) ? c.analysis_teams : []);
  const teams = teamsArr.length ? teamsArr.join(', ') : '';
  const coverage = `Analysis covers League competition matches${seasonLabel ? ` for the ${seasonLabel} football season` : ''}.`;
  // Only surface access that IS granted — never print "not included" lines.
  const opp: Array<[string, boolean]> = [
    ['Opponent match footage', !!(c?.oppMatchFootage ?? c?.opp_match_footage)],
    ['Opponent team analysis', !!(c?.oppTeamAnalysis ?? c?.opp_team_analysis)],
    ['Opponent player analysis', !!(c?.oppPlayerAnalysis ?? c?.opp_player_analysis)],
  ];
  const granted = opp.filter(([, on]) => on).map(([label]) => label);
  const opponent = granted.length ? granted.join(' · ') + '.' : '';
  return { teams, coverage, opponent };
}

// Port of stripMarkdown — remove **bold**/*italic*/__/_ so authored text never
// leaks literal markdown into the rendered contract. Keep in sync w/ constants.js.
function stripMarkdown(s: Any): string {
  return String(s ?? '').replace(/\*\*/g, '').replace(/__/g, '').replace(/(^|\s)[*_](\S)/g, '$1$2').replace(/(\S)[*_](\s|$)/g, '$1$2');
}

// Port of parseSpecialTerms — normalize special_terms into [{relatesTo,text}].
// Backward compatible: plain string (legacy) → one General term; JSON array →
// parsed. Markdown stripped. Keep in sync with src/lib/constants.js.
function parseSpecialTerms(raw: Any): Array<{ relatesTo: string; text: string }> {
  const clean = (arr: Any[]) => arr
    .filter((t: Any) => t && t.text && String(t.text).trim())
    .map((t: Any) => ({ relatesTo: t.relatesTo || 'General', text: stripMarkdown(t.text).trim() }));
  if (!raw) return [];
  if (Array.isArray(raw)) return clean(raw);
  if (typeof raw === 'object') return clean([raw]);
  const s = String(raw).trim();
  if (!s) return [];
  if (s[0] === '[' || s[0] === '{') {
    try {
      const parsed = JSON.parse(s);
      return clean(Array.isArray(parsed) ? parsed : [parsed]);
    } catch { /* not JSON — treat as plain text below */ }
  }
  return [{ relatesTo: 'General', text: stripMarkdown(s) }];
}

// Port of seasonLabelFromDates — "2026/2027" from ISO start/end dates.
function seasonLabelFromDates(startDate: Any, endDate: Any): string {
  const sy = startDate ? new Date(startDate).getUTCFullYear() : null;
  const ey = endDate ? new Date(endDate).getUTCFullYear() : null;
  if (sy && ey && ey !== sy) return `${sy}/${ey}`;
  if (sy) return `${sy}/${sy + 1}`;
  return '';
}

// Port of serviceLevelsLines — default SLA + optional per-team bands. Accepts
// snake_case or camelCase. Keep in sync with src/lib/constants.js.
function serviceLevelsLines(c: Any): string[] {
  const defHours = Number(c?.slaHours ?? c?.sla_hours) || 72;
  const rawBands = c?.slaBands ?? c?.sla_bands;
  const bands = Array.isArray(rawBands) ? rawBands.filter((b: Any) => b && Array.isArray(b.teams) && b.teams.length && Number(b.hours)) : [];
  if (!bands.length) {
    return [`The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match within ${defHours} hours of receipt of usable match footage and applicable match data.`];
  }
  const distinctHours = [...new Set(bands.map((b: Any) => Number(b.hours)))];
  if (distinctHours.length === 1) {
    return [`The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match within ${distinctHours[0]} hours of receipt of usable match footage and applicable match data.`];
  }
  const sorted = [...bands].sort((a: Any, b: Any) => Number(a.hours) - Number(b.hours));
  const lines = sorted.map((b: Any) => `for ${b.teams.join(', ')}, within ${Number(b.hours)} hours`);
  return [`The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match, measured from receipt of usable match footage and applicable match data, as follows: ${lines.join('; ')}.`];
}

const PAYMENT_MODEL_LABELS: Record<string, string> = {
  club_all: 'Club-funded — the Client pays the full fee',
  club_players: 'Shared — a fixed amount is agreed with the Client; players fund the remainder',
  players_all: 'Player-funded — fees are collected directly from players',
};

// Port of commercialModelText. Accepts snake_case or camelCase. `fm` formats
// money. Shared/Player-funded state player funding as TERMS — nothing computed
// into the value. Keep in sync with src/lib/constants.js.
function commercialModelText(c: Any, fm: (a: Any) => string): { intro: string; breakdown: string; commission: string } {
  const basis = (c?.billingBasis ?? c?.billing_basis) || 'services';
  const model = (c?.paymentModel ?? c?.payment_model) || null;
  if (basis !== 'player_funded' || !model) return { intro: '', breakdown: '', commission: '' };
  const fee = Number(c?.playerMonthlyFee ?? c?.player_monthly_fee) || 0;
  const months = Number(c?.playerMonths ?? c?.player_months) || 0;
  const pct = Number(c?.kickbackPct ?? c?.kickback_pct) || 0;
  const minP = Number(c?.minPlayers ?? c?.min_players) || 0;
  const value = c?.value;
  const intro = PAYMENT_MODEL_LABELS[model] || '';
  const feeBits: string[] = [];
  if (fee) feeBits.push(`${fm(fee)} per player per month`);
  if (months) feeBits.push(`over ${months} months`);
  const feeStr = feeBits.join(' ');
  const minStr = minP ? ` The Client undertakes to enrol a minimum of ${minP} players.` : '';

  if (model === 'club_players') {
    const breakdown = `The Client shall pay the Service Provider a fixed fee of ${fm(value)} as set out in the Fees & Payment section. Participating players shall fund the remainder of the programme, contributing${feeStr ? ` ${feeStr}` : ' a monthly fee agreed with the Client'}, collected by the Service Provider.${minStr}`;
    const commission = pct ? `The Service Provider shall pay the Client a commission of ${pct}% of the player fees actually collected, reconciled and settled per football season.` : '';
    return { intro, breakdown, commission };
  }
  const breakdown = `Access fees are collected by the Service Provider directly from participating players${feeStr ? `, at ${feeStr}` : ''}.${minStr}`;
  const commission = pct ? `The Service Provider shall pay the Client a commission of ${pct}% of the fees actually collected from players enrolled through the Client, reconciled and settled per football season.` : '';
  return { intro, breakdown, commission };
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
  // Full-spectrum rainbow (matches the on-screen CSS gradient), drawn as many
  // thin interpolated slices so it reads as a smooth gradient edge-to-edge.
  const drawRainbow = (pg: Any, topY: number, h = 3) => {
    // Same 7 stops as --sos-rainbow: cyan→green→yellow→orange→pink→purple→blue.
    const stops = [[34,199,230],[34,230,138],[230,230,34],[245,166,35],[236,72,153],[139,92,246],[37,99,235]];
    const N = 96;
    const sliceW = W / N;
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * (stops.length - 1);
      const a = Math.floor(t), b = Math.min(a + 1, stops.length - 1), f = t - a;
      const col = rgb(
        (stops[a][0] + (stops[b][0] - stops[a][0]) * f) / 255,
        (stops[a][1] + (stops[b][1] - stops[a][1]) * f) / 255,
        (stops[a][2] + (stops[b][2] - stops[a][2]) * f) / 255,
      );
      const w = (i === N - 1) ? (W - i * sliceW) : sliceW + 1;
      pg.drawRectangle({ x: i * sliceW, y: topY - h, width: w, height: h, color: col });
    }
  };

  // --- Full navy header band with two-logo lockup + cyan contract number. ---
  // Drawn on PAGE 1 only. pdf-lib is bottom-up: the band sits at the top edge.
  const drawHeaderP1 = (pg: Any) => {
    const bandTop = H;
    const bandBottom = H - HEADER_BAND;
    pg.drawRectangle({ x: 0, y: bandBottom, width: W, height: HEADER_BAND, color: NAVY });

    // Two-logo lockup, vertically centred in the upper part of the band so the
    // cyan contract number can sit below it.
    //
    // The SOS wordmark PNG is WIDE (star + "SCIENCE OF SPORTS"), so a small
    // height cap makes it render tiny. Give each logo a generous fit box
    // (200w × 44h) and let width drive the scale — this matches the on-screen
    // prominence and fixes the "shrunken SOS logo" seen on sent/signed PDFs.
    const logoH = 44;
    const logoMaxW = 200;
    const lockCenterY = H - 34;         // baseline-ish centre for the lockup row
    const gap = 22;
    const crossW = font.widthOfTextAtSize('x', 14);

    // Measure the SOS + client widths (image scaled into logoMaxW×logoH, else wordmark).
    const sosFit = sosLogo ? sosLogo.scaleToFit(logoMaxW, logoH) : null;
    const cliFit = clientLogo ? clientLogo.scaleToFit(logoMaxW, logoH) : null;
    const sosW = sosFit ? sosFit.width : bold.widthOfTextAtSize('SCIENCE OF SPORTS', 13);
    const cliW = cliFit ? cliFit.width : bold.widthOfTextAtSize(clientName0.toUpperCase(), 12);
    const totalW = sosW + gap + crossW + gap + cliW;
    let cx = (W - totalW) / 2;

    // SOS logo / wordmark.
    if (sosLogo && sosFit) {
      try {
        pg.drawImage(sosLogo, { x: cx, y: lockCenterY - sosFit.height / 2, width: sosFit.width, height: sosFit.height });
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
    if (clientLogo && cliFit) {
      try {
        pg.drawImage(clientLogo, { x: cx, y: lockCenterY - cliFit.height / 2, width: cliFit.width, height: cliFit.height });
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
    // Signature SCIOS rainbow hairline directly above the footer band (y 38→41).
    drawRainbow(pg, 41, 3);
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

  // Track where the current page's body content started, to detect a trailing
  // page that ended up empty (chrome only) and drop it before finalizing.
  let pageContentStart = y;
  // Move to a fresh page when the cursor would collide with the footer.
  const newPage = () => {
    drawFooter(page);
    page = pdf.addPage([W, H]);
    drawHeaderRest(page);
    y = CONTENT_TOP_REST;
    pageContentStart = CONTENT_TOP_REST;
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

  // Callout clause: pill header, then paragraphs inside a lilac box with a navy
  // left-bar (mirrors the on-screen Confidentiality callout). `lead` is a bold
  // navy lead-in prepended to the first paragraph.
  const wrapMeasure = (str: string, size: number, width: number): number => {
    const words = String(str ?? '').split(/\s+/);
    let line = '', count = 0;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > width && line) { count++; line = w; }
      else line = test;
    }
    if (line) count++;
    return count;
  };
  const calloutClause = (num: number | null, title: string, lead: string, ...paras: Any[]) => {
    ensure(40);
    pillHeader(num, title);
    const padX = 12, padY = 10, barW = 3, textW = maxW - padX * 2;
    let lineCount = 0;
    paras.forEach((p, i) => {
      const s = i === 0 ? `${lead} ${p}` : p;
      lineCount += wrapMeasure(s, 10, textW);
    });
    const gaps = (paras.length - 1) * 4;
    const boxH = padY * 2 + lineCount * 14 + gaps;
    ensure(boxH + 6);
    const boxTop = y;
    page.drawRectangle({ x: M, y: py(boxTop + boxH), width: maxW, height: boxH, color: LILAC_BG });
    page.drawRectangle({ x: M, y: py(boxTop + boxH), width: barW, height: boxH, color: NAVY });
    y = boxTop + padY;
    paras.forEach((p, i) => {
      const s = i === 0 ? `${lead} ${p}` : p;
      text(s, { x: M + padX, width: textW, size: 10, gap: i === paras.length - 1 ? 0 : 4 });
    });
    y = boxTop + boxH + 10;
  };

  // --- Data prep -----------------------------------------------------------
  const services = c.services;
  const lineItems = computeServiceLineItems(services);
  const currency = c.currency || 'EUR';
  const value = c.value;
  const startDate = pick(c, 'startDate', 'start_date');
  const endDate = pick(c, 'endDate', 'end_date');
  const termYears = startDate && endDate ? Math.max(1, Math.round(daysBetween(startDate, endDate) / 365)) : null;
  const paymentTypeRaw = pick(c, 'paymentType', 'payment_type') || '';
  const paymentType = paymentTypeRaw === 'one_time' ? 'in a single payment'
    : paymentTypeRaw === 'milestone' ? 'in instalments'
    : paymentTypeRaw.replace('_', ' ');
  const payments = Array.isArray(c?.payments) ? c.payments : [];
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
  // Blank client fields show a bracketed "[ … ]" placeholder on the pre-sign
  // document; by signing time the client has confirmed them, so the SIGNED
  // contract reads as plain text (no brackets, no highlight) — clean + unmarked.
  const clientRegText = clientReg
    ? `a company registered with registration number ${clientReg}, `
    : '[ registration number to be confirmed by the Client on signing ], ';
  const clientAddr = cl.address || '[ address to be confirmed by the Client on signing ]';

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
  text(`${clientName}, ${clientRegText}having its registered office at ${clientAddr} (the "Client").`, { size: 10, gap: 2 });
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
  const analysisScope = analysisScopeText(c, seasonLabelFromDates(startDate, endDate));
  const analysisNum = analysisScope.teams ? n++ : null;
  const feesNum = n++;
  const commercial = commercialModelText(c, (a: Any) => fmtMoney(a, currency));
  const commercialNum = commercial.intro ? n++ : null;
  const serviceLevelsNum = n++;
  const confidentialityNum = n++;
  const ipNum = n++;
  const durationNum = n++;
  const terminationNum = n++;
  const liabilityNum = n++;
  const forceMajeureNum = n++;
  const governingLawNum = n++;
  const specialTermsParsed = parseSpecialTerms(specialTerms);
  const specialTermsNum = specialTermsParsed.length ? n++ : null;
  const entireAgreementNum = n++;

  // Draw a small green "Included" chip inline (matches on-screen); returns x.
  const chip = (label: string, x: number, baselineY: number) => {
    const size = 8;
    const padX = 6;
    const w = font.widthOfTextAtSize(label, size) + padX * 2;
    const chipH = 13;
    // baselineY is the downward baseline of the text line the chip sits on.
    page.drawRectangle({ x, y: py(baselineY + 3), width: w, height: chipH, color: CHIP_GREEN_BG });
    page.drawText(label, { x: x + padX, y: py(baselineY - 1.5), size, font: bold, color: CHIP_GREEN_TX });
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
      // Service-group subheading: cyan accent bar + navy uppercase label
      // (colour lives in the bar; the text stays navy and fully legible).
      y += 10;
      const ghBaseline = y;
      page.drawRectangle({ x: M, y: py(ghBaseline + 2), width: 3, height: 10, color: CYAN });
      page.drawText(group.toUpperCase(), { x: M + 8, y: py(ghBaseline), size: 9, font: bold, color: NAVY });
      y += 4;
      groupItems.forEach((i) => {
        const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
        const chipLabel = i.included ? 'Included' : null;
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
          if (seats) text(`Access: ${seats} (exact users to be confirmed with the client).`, { size: 9, color: SOFT_GREY, gap: 2, x: itemX + 10, width: itemW - 10 });
        }
      });
      y += 6;
    });
    text('Key analytical outputs are delivered after each match in accordance with the Service Levels set out below.', { size: 10, gap: 10 });
  } else {
    text(c.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.', { size: 10, gap: 10 });
  }

  // --- Scope of Services — premium ruled TABLE (SERVICE | QTY). -------------
  if (scopeNum) {
    pillHeader(scopeNum, 'Scope of Services');

    const cellPadX = 10;
    const qtyColW = 90;
    const svcColW = maxW - qtyColW;

    // Local word-wrap helper (pdf-lib has no splitText). Returns wrapped lines.
    const wrap = (str: string, f: Any, size: number, width: number): string[] => {
      const words = String(str ?? '').split(/\s+/);
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) > width && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };

    // Header row: navy band, white SERVICE / QTY.
    const headH = 20;
    ensure(headH + 4);
    y += 4;
    const headTop = y;
    page.drawRectangle({ x: M, y: py(headTop + headH), width: maxW, height: headH, color: NAVY });
    page.drawText('SERVICE', { x: M + cellPadX, y: py(headTop + 13), size: 8.5, font: bold, color: WHITE });
    const qtyHeadW = bold.widthOfTextAtSize('AMOUNT', 8.5);
    page.drawText('AMOUNT', { x: W - M - cellPadX - qtyHeadW, y: py(headTop + 13), size: 8.5, font: bold, color: WHITE });
    y = headTop + headH;

    // Body rows.
    lineItems.forEach((i) => {
      const priceStr = fmtMoney(i.listPrice, currency);
      const seats = (i.key === 'platform_access') ? platformSeatsSummary(services?.platform_access) : '';
      const subline = seats ? `Access: ${seats} (exact users to be confirmed with the client)` : '';

      const labelLines = wrap(i.label, font, 9.5, svcColW - cellPadX * 2);
      const subLines = subline ? wrap(subline, font, 8.5, svcColW - cellPadX * 2) : [];
      const rowH = 10 + labelLines.length * 12 + (subLines.length ? subLines.length * 11 + 2 : 0);
      ensure(rowH + 2);
      const rowTop = y;

      let ly = rowTop + 12;
      for (const ln of labelLines) { page.drawText(ln, { x: M + cellPadX, y: py(ly), size: 9.5, font, color: BLACK }); ly += 12; }
      if (subLines.length) {
        ly += 1;
        for (const ln of subLines) { page.drawText(ln, { x: M + cellPadX, y: py(ly), size: 8.5, font, color: SOFT_GREY }); ly += 11; }
      }
      // Amount right-aligned. Included lines show the list price struck through
      // + "Incl." so the value is visible but unbilled.
      const rightX = W - M - cellPadX;
      const amtBaseline = rowTop + 12;
      if (i.included && i.listPrice > 0) {
        // Waived a real value: struck-through list price + "Incl."
        const inclW = bold.widthOfTextAtSize('Incl.', 9.5);
        page.drawText('Incl.', { x: rightX - inclW, y: py(amtBaseline), size: 9.5, font: bold, color: rgb(0.063, 0.588, 0.412) });
        const pw = font.widthOfTextAtSize(priceStr, 9.5);
        const priceRight = rightX - inclW - 6;
        page.drawText(priceStr, { x: priceRight - pw, y: py(amtBaseline), size: 9.5, font, color: rgb(0.588, 0.627, 0.667) });
        page.drawLine({ start: { x: priceRight - pw, y: py(amtBaseline - 3) }, end: { x: priceRight, y: py(amtBaseline - 3) }, thickness: 0.6, color: rgb(0.588, 0.627, 0.667) });
      } else if (i.included) {
        // No value to strike — just "Included".
        const w = bold.widthOfTextAtSize('Included', 9.5);
        page.drawText('Included', { x: rightX - w, y: py(amtBaseline), size: 9.5, font: bold, color: rgb(0.063, 0.588, 0.412) });
      } else {
        const pw = font.widthOfTextAtSize(priceStr, 9.5);
        page.drawText(priceStr, { x: rightX - pw, y: py(amtBaseline), size: 9.5, font, color: BLACK });
      }

      y = rowTop + rowH;
      page.drawLine({ start: { x: M, y: py(y) }, end: { x: W - M, y: py(y) }, thickness: 0.5, color: rgb(0.862, 0.878, 0.902) });
    });

    // Total row.
    ensure(24);
    page.drawLine({ start: { x: M, y: py(y) }, end: { x: W - M, y: py(y) }, thickness: 1, color: NAVY });
    y += 15;
    page.drawText('Total Contract Value', { x: M + cellPadX, y: py(y), size: 10.5, font: bold, color: NAVY });
    const totalStr = fmtMoney(value, currency);
    const totalW2 = bold.widthOfTextAtSize(totalStr, 10.5);
    page.drawText(totalStr, { x: W - M - cellPadX - totalW2, y: py(y), size: 10.5, font: bold, color: NAVY });
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
      page.drawRectangle({ x: M, y: py(oaBaseline + 2), width: 3, height: 10, color: CYAN });
      page.drawText('OPPONENT ACCESS', { x: M + 8, y: py(oaBaseline), size: 9, font: bold, color: NAVY });
      y += 4;
      text(analysisScope.opponent, { size: 10, gap: 10 });
    }
  }

  // --- Fees & Payment ------------------------------------------------------
  {
    ensure(40);
    pillHeader(feesNum, 'Fees & Payment');
    const vs = vatSummary(c, (a: Any) => fmtMoney(a, currency));
    text(`In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of ${fmtMoney(value, currency)}${vs.applies ? ' (exclusive of VAT)' : ''}, payable ${paymentType}, net ${paymentTermsDays} days from the date of a valid invoice.`, { size: 10, gap: vs.sentence ? 3 : 6 });
    if (vs.sentence) text(vs.sentence, { size: 10, gap: 6 });
    // Instalment schedule table (only when more than one payment).
    if (payments.length > 1) {
      const amtX = W - M - 12;
      const dateX = M + maxW * 0.5;
      const amtHead = (vs.amountLabel || 'Amount').toUpperCase();
      ensure(16); y += 12;
      page.drawText('PAYMENT', { x: M + 6, y: py(y), size: 8, font: bold, color: NAVY });
      page.drawText('DUE DATE', { x: dateX, y: py(y), size: 8, font: bold, color: NAVY });
      const ahW = bold.widthOfTextAtSize(amtHead, 8);
      page.drawText(amtHead, { x: amtX - ahW, y: py(y), size: 8, font: bold, color: NAVY });
      y += 3;
      page.drawLine({ start: { x: M, y: py(y) }, end: { x: W - M, y: py(y) }, thickness: 0.5, color: NAVY });
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        ensure(16); y += 13;
        const due = pick(p, 'dueDate', 'due_date');
        const amt = pick(p, 'totalAmount', 'total_amount');
        const amt2 = amt != null ? amt : pick(p, 'amount');
        page.drawText(`Instalment ${i + 1}`, { x: M + 6, y: py(y), size: 9.5, font, color: BLACK });
        page.drawText(due ? fmtDate(due) : '—', { x: dateX, y: py(y), size: 9.5, font, color: BLACK });
        const amtStr = fmtMoney(amt2, currency);
        const aW = bold.widthOfTextAtSize(amtStr, 9.5);
        page.drawText(amtStr, { x: amtX - aW, y: py(y), size: 9.5, font: bold, color: BLACK });
        y += 3;
        page.drawLine({ start: { x: M, y: py(y) }, end: { x: W - M, y: py(y) }, thickness: 0.4, color: rgb(0.862, 0.878, 0.902) });
      }
      y += 8;
    }
    text(`All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of ${latePaymentPenalty}% per month applies to overdue amounts.`, { size: 10, gap: 10 });
  }
  {
    const bankName = pick(co, 'bankName', 'bank_name');
    const bankIBAN = pick(co, 'bankIBAN', 'bank_iban');
    const bankSWIFT = pick(co, 'bankSWIFT', 'bank_swift');
    if (bankName || bankIBAN || bankSWIFT) {
      // Tinted, bordered bank-details box. Measure the content span, then paint
      // the box behind it on the same page (kept together to avoid a page split).
      const bankLines = [
        `Account Name: ${companyName0}`,
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

  // --- Commercial Terms & Club Commission ----------------------------------
  if (commercialNum) {
    const paras: Any[] = [`${commercial.intro}. ${commercial.breakdown}`];
    if (commercial.commission) paras.push(commercial.commission);
    clause(commercialNum, 'Commercial Terms & Club Commission', ...paras);
  }

  // --- Service Levels ------------------------------------------------------
  {
    const slLines = serviceLevelsLines(c);
    const excl = " These timeframes exclude weekends, public holidays and any delay caused by the Client, third parties or events beyond the Service Provider's reasonable control.";
    const remedy = "Where the Service Provider fails to meet the applicable service level for a given match, it shall remedy the delay within a reasonable cure period. The Client's sole and exclusive remedy for a service-level failure shall be a proportionate service credit against the fees for the affected deliverables; a service-level failure shall not, of itself, entitle the Client to terminate this Agreement, save in the case of repeated and material failures not remedied following written notice.";
    clause(serviceLevelsNum, 'Service Levels', slLines[0] + excl, remedy);
  }

  // --- Confidentiality & Data Protection (lilac callout) -------------------
  calloutClause(confidentialityNum, 'Confidentiality & Data Protection',
    'Confidentiality & GDPR.',
    'The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.',
    'In respect of personal data processed under this Agreement, the Client acts as data controller and the Service Provider as data processor. The Service Provider shall process such data only as needed to provide the services, keep it secure, not transfer it outside the EEA without safeguards, assist the Client with data-subject requests, and delete or return the data on termination. Where the data concerns minors, the Client is responsible for obtaining any necessary parental or guardian consent.',
    "All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.");

  // --- Intellectual Property Rights ----------------------------------------
  clause(ipNum, 'Intellectual Property Rights',
    'The match footage, video recordings, reports, analytics outputs, clips and other deliverables produced for the Client under this Agreement (the "Deliverables") are provided for the Client\'s use. The Service Provider grants the Client a perpetual, irrevocable, royalty-free licence to use, reproduce, store and archive the Deliverables for the Client\'s own internal football and operational purposes. The Service Provider shall not disclose or share the Client\'s Deliverables with any third party without the Client\'s prior written consent, save as required by law.',
    'The Service Provider retains all right, title and interest in its platform, software, systems, methodologies, know-how, models and templates, and in any pre-existing or independently developed materials (the "Service Provider IP"), which are licensed to the Client only as necessary to receive the services. The Service Provider may retain internal copies of the Deliverables and may use anonymised and aggregated data derived from the services for benchmarking, research and the improvement and provision of its products and services, provided that no such use identifies the Client, its players or its teams without the Client\'s consent.');

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

  // --- Special Terms (optional) — numbered list, each optionally clause-ref'd.
  if (specialTermsNum) {
    ensure(40);
    pillHeader(specialTermsNum, 'Special Terms');
    specialTermsParsed.forEach((t, i) => {
      const ref = t.relatesTo && t.relatesTo !== 'General' ? `Re: ${t.relatesTo}. ` : '';
      text(`${i + 1}.  ${ref}${t.text}`, { size: 10, gap: i === specialTermsParsed.length - 1 ? 10 : 3, x: M + 6, width: maxW - 6 });
    });
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

  // --- Navy closing panel — warm, confident sign-off before signatures. ----
  {
    const padX = 16, padY = 14, innerW = maxW - padX * 2;
    const body = `Science of Sports is proud to partner with ${clientName0} and is committed to delivering performance analysis of the highest professional standard throughout this Agreement.`;
    const emph = 'Transforming matches into knowledge — together.';
    const bodyLc = wrapMeasure(body, 10, innerW);
    const emphLc = (() => {
      const words = emph.split(/\s+/); let line = '', count = 0;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (bold.widthOfTextAtSize(t, 10) > innerW && line) { count++; line = w; } else line = t; }
      if (line) count++; return count;
    })();
    const boxH = padY * 2 + bodyLc * 14 + 6 + emphLc * 14;
    ensure(boxH + 12);
    const boxTop = y;
    page.drawRectangle({ x: M, y: py(boxTop + boxH), width: maxW, height: boxH, color: NAVY });
    y = boxTop + padY;
    text(body, { x: M + padX, width: innerW, size: 10, color: rgb(0.902, 0.925, 0.969), gap: 6 });
    text(emph, { x: M + padX, width: innerW, size: 10, f: bold, color: CYAN });
    y = boxTop + boxH + 14;
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
    // Draw the fallback NAME at a font size that fits the column width, so a
    // long typed name is never clipped or run past the column edge.
    const drawFittedName = (str: string) => {
      const maxW = colW - 4;
      let size = 20;
      while (size > 9 && italic.widthOfTextAtSize(str, size) > maxW) size -= 1;
      page.drawText(str, { x: x + 2, y: py(sigLineY - 6), size, font: italic, color: BLACK });
    };
    if (col.sig) {
      try {
        // Larger signature: fit into a bigger box so it reads bold and prominent.
        const scaled = col.sig.scaleToFit(190, 64);
        // Image bottom sits ~5pt above the ruled line; grows upward.
        page.drawImage(col.sig, { x: x + 2, y: py(sigLineY - 5), width: scaled.width, height: scaled.height });
      } catch (_) {
        if (col.sigFallback) drawFittedName(col.sigFallback);
      }
    } else if (col.sigFallback) {
      drawFittedName(col.sigFallback);
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

  // If the final page ended up with no body content (a page-break artifact),
  // drop it — the previous page already got its footer in newPage(). Otherwise
  // footer the final page normally.
  const pageCount = pdf.getPageCount();
  if (pageCount > 1 && y <= pageContentStart + 1) {
    pdf.removePage(pageCount - 1);
  } else {
    drawFooter(page);
  }

  const bytes = await pdf.save();
  const hex = await sha256Hex(Array.from(bytes).map((b) => String.fromCharCode(b)).join(''));
  return { bytes, sha256: hex };
}
