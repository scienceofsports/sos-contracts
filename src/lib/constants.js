/* =========================================================================
   CONSTANTS
   ========================================================================= */
export const STATUS_BADGE = {
  draft:    { bg:'bg-slate-100',  text:'text-slate-600'  },
  sent:     { bg:'bg-amber-100',  text:'text-amber-700'  },
  signed:   { bg:'bg-blue-100',   text:'text-blue-700'   },
  active:   { bg:'bg-green-100',  text:'text-green-700'  },
  expired:  { bg:'bg-red-100',    text:'text-red-700'    },
  cancelled:{ bg:'bg-slate-100',  text:'text-slate-500'  },
  declined: { bg:'bg-red-100',    text:'text-red-700'    },
  paid:     { bg:'bg-green-100',  text:'text-green-700'  },
  pending:  { bg:'bg-amber-100',  text:'text-amber-700'  },
  overdue:  { bg:'bg-red-100',    text:'text-red-700'    },
  disputed: { bg:'bg-purple-100', text:'text-purple-700' },
};

export const PAYMENT_TYPES = [
  { value:'one_time', label:'One-time' },
  { value:'monthly', label:'Monthly' },
  { value:'quarterly', label:'Quarterly' },
  { value:'annually', label:'Annually' },
  { value:'milestone', label:'Milestone-based' },
];

export const CURRENCIES = ['EUR','AED','USD'];
export const CURRENCY_SYMBOL = { EUR:'€', AED:'AED ', USD:'$' };

/* Service catalog — the services SCIOS offers to clubs/academies, per
   "Science of Sports Services 2026-2027" pricing sheet. unit determines how
   quantity is interpreted: 'flat' (fixed fee, qty locked to 1), 'per_match'
   (rate x number of matches), 'per_unit' (rate x count), 'included' (bundled,
   no separate charge). */
export const SERVICE_CATALOG = [
  { key:'platform_access', label:'Access to Football Platform', group:'Core Services', unit:'flat', defaultRate:11500, defaultQty:1,
    detail:'Video + data combined, match events & clips, player comparisons, team & player rankings — everything accessible in one place.' },
  { key:'camera_installation', label:'Installation of Fixed Camera', group:'Recording Services', unit:'per_unit', defaultRate:500, defaultQty:1,
    detail:'One-off installation of fixed/robotic camera(s) at the club\'s venue, priced per camera.' },
  { key:'physical_data', label:'Match Physical Performance Data', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    detail:'Match physical data, player load tracking and performance benchmarks to protect players and reduce injury risk.' },
  { key:'live_broadcasting', label:'Live Match Broadcasting', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    detail:'Matches streamed live for parents, coaches and club management — increasing visibility for the academy.' },
  { key:'match_recording', label:'Match Recording (Robotic camera)', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    detail:'Fixed/robotic camera recording for home and away matches — professional, high-quality coverage with no club equipment or staff needed.' },
  { key:'own_team_analysis', label:'Own Team Tactical Analysis', group:'Analysis Services', unit:'per_match', defaultRate:120, defaultQty:0,
    detail:'Team structure analysis, phases of play, and key moments with video clips, prepared by professional performance analysts.' },
  { key:'opponent_analysis', label:'Opponent Tactical Analysis', group:'Analysis Services', unit:'per_match', defaultRate:120, defaultQty:0,
    detail:'Opponent playing style, key players, and strengths & weaknesses ahead of each fixture.' },
  { key:'match_reports', label:'Match Team & Player Reports', group:'Reporting Services', unit:'included', defaultRate:0, defaultQty:130,
    detail:'Possession, passes, xG, player performance metrics and visual dashboards.' },
  { key:'academy_reports', label:'Academy Performance Reports', group:'Reporting Services', unit:'per_unit', defaultRate:100, defaultQty:3,
    detail:'Quarterly and full-season academy performance overviews — team progress, tactical evolution, physical trends and recommendations (1st Quarter, 2nd Quarter, Full Season).' },
  { key:'player_reports', label:'Individual Player Reports', group:'Reporting Services', unit:'per_unit', defaultRate:100, defaultQty:10,
    detail:'Detailed player analysis, strengths and improvement areas, with video-supported feedback.' },
  { key:'adhoc_reports', label:'Ad-Hoc Reports', group:'Reporting Services', unit:'included', defaultRate:0, defaultQty:0,
    detail:'On-demand reports tailored to specific needs, for fast support on key decisions whenever required.' },
  { key:'coach_support', label:'One-on-One Coach Support', group:'Coaching Support', unit:'included', defaultRate:0, defaultQty:3,
    detail:'Platform guidance, analysis-driven solutions, educational support and custom plans tailored to the academy, delivered across the season.' },
];

export const SERVICE_UNIT_LABELS = {
  flat: 'Flat fee',
  per_match: 'Per match',
  per_unit: 'Per unit',
  included: 'Included',
};

export const SERVICE_GROUPS = ['Core Services', 'Recording Services', 'Analysis Services', 'Reporting Services', 'Coaching Support'];

export function computeServiceLineItems(services) {
  if (!services || typeof services !== 'object') return [];
  return SERVICE_CATALOG
    .filter(s => services[s.key] && services[s.key].selected)
    .map(s => {
      const svc = services[s.key];
      const qty = Number(svc.qty) || 0;
      // Single "included" concept (merges the old complimentary + bundledIncluded).
      // Catalog items with unit 'included' are inherently included.
      const included = s.unit === 'included' || !!svc.included || !!svc.complimentary || !!svc.bundledIncluded;
      // Keep the REAL rate even when included, so the list price can be shown
      // struck-through. `amount` is what's actually charged (0 when included).
      const rate = Number(svc.rate != null ? svc.rate : s.defaultRate);
      const listPrice = s.unit === 'flat' ? rate : rate * qty;   // full value of the line
      const amount = included ? 0 : listPrice;                    // what's added to the total
      return { ...s, qty, rate, included, listPrice, amount };
    });
}

export const UNLIMITED_SEATS = -1;

export function seatLabel(count, singular, plural) {
  if (count === UNLIMITED_SEATS) return `Unlimited ${plural}`;
  if (count > 0) return `${count} ${count > 1 ? plural : singular}`;
  return '';
}

export function platformSeatsSummary(svc) {
  if (!svc) return '';
  const parts = [
    seatLabel(svc.directorSeats, 'Director', 'Directors'),
    seatLabel(svc.coachSeats, 'Coach', 'Coaches'),
    seatLabel(svc.playerSeats, 'Player', 'Players'),
  ].filter(Boolean);
  return parts.join(', ');
}

// Build the two "Scope of Analysis" sentences from a contract's scope fields.
// Returns { teams, coverage, opponent } strings (empty teams → caller may skip
// the clause). `seasonLabel` is derived from the contract dates by the caller.
// NOTE: this helper is PORTED verbatim into both PDF generators — keep in sync.
export function analysisScopeText(contract, seasonLabel) {
  const teams = Array.isArray(contract?.analysisTeams) ? contract.analysisTeams : [];
  const teamsStr = teams.length ? teams.join(', ') : '';
  const coverage = `Analysis covers League competition matches${seasonLabel ? ` for the ${seasonLabel} football season` : ''}.`;
  // Only surface access that IS granted — never print "not included" lines.
  const opp = [
    ['Opponent match footage', contract?.oppMatchFootage],
    ['Opponent team analysis', contract?.oppTeamAnalysis],
    ['Opponent player analysis', contract?.oppPlayerAnalysis],
  ];
  const granted = opp.filter(([, on]) => on).map(([label]) => label);
  const opponent = granted.length ? granted.join(' · ') + '.' : '';
  return { teams: teamsStr, coverage, opponent };
}

// The legal descriptor for the Client party in the opening clause. A SCIOS
// counterparty is not always a limited company — clubs and federations are
// usually registered ASSOCIATIONS / governing bodies, not companies, and often
// carry no VAT number. entity_type ('company' | 'club' | 'federation') drives
// the correct phrasing so the party clause reads accurately for each. Default
// is 'company', preserving the historic wording for every existing client.
export function clientEntityDescriptor(entityType) {
  switch (entityType) {
    case 'club':       return 'an association duly registered under the laws of';
    case 'federation': return 'a governing body duly registered under the laws of';
    case 'company':
    default:           return 'a company registered under the laws of';
  }
}

// Build the Client party sentence for the opening clause, shared by all three
// document generators (App.jsx screen, contractPdf.js draft, contractPdf.ts
// sent/signed). Callers pass already-resolved display strings so each generator
// keeps control of its own "to be confirmed on signing" placeholder styling;
// `vat` is passed as null/'' to OMIT the VAT phrase entirely (e.g. an
// association with no VAT registration) rather than print an empty blank.
export function clientPartyClause({ name, entityType, country, registration, vat, address }) {
  const vatPhrase = vat ? `, VAT number ${vat}` : '';
  return `${name}, ${clientEntityDescriptor(entityType)} ${country} with registration number ${registration}${vatPhrase}, having its registered office at ${address} (the "Client").`;
}

// Clause names a special term can reference (stable — by name, not number).
export const SPECIAL_TERM_CLAUSES = [
  'General', 'Purpose', 'Scope of Services', 'Scope of Analysis', 'Fees & Payment',
  'Commercial Terms & Club Commission', 'Confidentiality & Data Protection',
  'Intellectual Property Rights', 'Duration', 'Termination',
  'Limitation of Liability', 'Force Majeure', 'Governing Law & Jurisdiction',
];

// Strip markdown emphasis (**bold**, *italic*, __, _) from authored text so it
// never leaks literal asterisks/underscores into the rendered contract.
export function stripMarkdown(s) {
  return String(s ?? '').replace(/\*\*/g, '').replace(/__/g, '').replace(/(^|\s)[*_](\S)/g, '$1$2').replace(/(\S)[*_](\s|$)/g, '$1$2');
}

// Normalize the special_terms value into a list of { relatesTo, text } rows.
// Backward compatible: a plain string (legacy contracts) becomes one General
// term. A JSON array is parsed as-is. Markdown emphasis is stripped from text.
// NOTE: ported into both PDF generators — keep in sync.
export function parseSpecialTerms(raw) {
  const clean = (arr) => arr
    .filter(t => t && t.text && String(t.text).trim())
    .map(t => ({ relatesTo: t.relatesTo || 'General', text: stripMarkdown(t.text).trim() }));
  if (!raw) return [];
  if (Array.isArray(raw)) return clean(raw);
  if (typeof raw === 'object') return clean([raw]);
  const s = String(raw).trim();
  if (!s) return [];
  // Try JSON (new format); fall back to legacy plain text as one General term.
  if (s[0] === '[' || s[0] === '{') {
    try {
      const parsed = JSON.parse(s);
      return clean(Array.isArray(parsed) ? parsed : [parsed]);
    } catch { /* not JSON — treat as plain text below */ }
  }
  return [{ relatesTo: 'General', text: stripMarkdown(s) }];
}

// Derive a "2026/2027" season label from ISO start/end dates (fallback to just
// the start year, or '' when no dates). Ported into both PDF generators.
export function seasonLabelFromDates(startDate, endDate) {
  const sy = startDate ? new Date(startDate).getUTCFullYear() : null;
  const ey = endDate ? new Date(endDate).getUTCFullYear() : null;
  if (sy && ey && ey !== sy) return `${sy}/${ey}`;
  if (sy) return `${sy}/${sy + 1}`;
  return '';
}

// Human labels for the payment models.
export const PAYMENT_MODEL_LABELS = {
  club_all: 'Club-funded — the Client pays the full fee',
  club_players: 'Shared — a fixed amount is agreed with the Client; players fund the remainder',
  players_all: 'Player-funded — fees are collected directly from players',
};

// Default club commission / kickback rate on player fees when none is entered.
export const DEFAULT_KICKBACK_PCT = 25;

// Compute the contract value + its component parts for the player-funded models
// (Shared / Player-funded), from a projection: player fee x months x expected
// players, of which the Service Provider keeps (100 - kickback%). The club
// commission (kickback) is applied to the PLAYER revenue only; the club fixed
// fee (Shared) is kept in full. Returns all parts so the UI + clause + PDFs show
// an identical breakdown. NOTE: ported into both PDF generators — keep in sync.
// `servicesTotal` = the services catalogue total, kept only for reference/display
// (it is NOT added to the value — services are deliverables the player fees fund).
//
// True for a player-funded / shared deal — i.e. the value comes from the funding
// model (club fee + player fees), not from priced services. Robust to a stale
// `billing_basis`: a player payment model alone is enough. Ported into both PDF
// generators — keep identical.
export function isPlayerFunded(contract) {
  const basis = contract?.billingBasis ?? contract?.billing_basis;
  const model = contract?.paymentModel ?? contract?.payment_model;
  return basis === 'player_funded' || model === 'players_all' || model === 'club_players';
}

export function commercialValue(contract, servicesTotal) {
  const model = contract?.paymentModel || null;
  const fee = Number(contract.playerMonthlyFee) || 0;
  const months = Number(contract.playerMonths) || 0;
  const pct = contract.kickbackPct === '' || contract.kickbackPct == null
    ? DEFAULT_KICKBACK_PCT : Number(contract.kickbackPct) || 0;
  const clubFee = Number(contract.clubFixedFee) || 0;
  const includeClubFee = model === 'club_players';
  const minPlayers = Number(contract.minPlayers) || 0;
  const svc = Math.round((
    servicesTotal != null
      ? Number(servicesTotal) || 0
      : computeServiceLineItems(contract.services).reduce((s, i) => s + i.amount, 0)
  ) * 100) / 100;
  // MODEL: in a player-funded / shared deal the PLAYER FEES fund the club's
  // payment — the selected services are the DELIVERABLES those fees pay for, NOT
  // a separate charge added on top. Summing services + player fees double-counts
  // (the platform access would be billed once as a service and again inside the
  // fee that already buys it). So services are EXCLUDED from the value.
  //
  // The club commission is deducted from the PLAYER FEES ONLY — the club fixed
  // fee is kept WHOLE (it is the guaranteed fee, and VAT sits on it in full, so
  // the commission must not erode it):
  //
  //   playerPortion = min players x fee x months   (the committed floor)
  //   clubPortion   = club fixed fee               (Shared only, kept whole)
  //   commission    = playerPortion x commission%  (off player fees only)
  //   gross         = clubPortion + playerPortion  (services NOT added)
  //   value         = clubPortion + (playerPortion - commission)
  //
  // Worked: Shared 10,000 club fee + 11,000 player fees @25% -> commission 2,750,
  // value 10,000 + 8,250 = 18,250. Player-funded 80 x 12 x 10 = 9,600 @50% ->
  // 4,800 (no club fee, services are deliverables, unpriced).
  const playerPortion = Math.round(minPlayers * fee * months * 100) / 100;
  const clubPortion = includeClubFee ? clubFee : 0;
  const gross = Math.round((clubPortion + playerPortion) * 100) / 100;
  const commissionAmount = Math.round(playerPortion * (pct / 100) * 100) / 100;
  const guaranteed = Math.round((clubPortion + playerPortion - commissionAmount) * 100) / 100;
  const hasPlayerFees = fee > 0;
  // No committed money at all (no services, no club fee, no min-player floor) ->
  // value is variable (billed purely on actual enrolment).
  const variableOnly = gross <= 0;
  // A variable-only deal has NO committed floor (e.g. Player-funded with min
  // players left blank), so it has no fixed contract value — return 0, never a
  // leftover `stored` figure. Keeping a stale value here was the bug where the
  // displayed value froze and stopped recomputing as the player inputs changed.
  const value = gross > 0 ? guaranteed : 0;
  return {
    clubFee: clubPortion,
    servicesTotal: svc,
    minPlayers, playerPortion, gross, commissionAmount,
    pct, value, fee, months,
    hasPlayerFees, variableOnly,
    // Back-compat fields some callers/PDFs still read.
    players: minPlayers, playerGross: playerPortion, clubShare: commissionAmount,
    sosPlayerShare: Math.round((playerPortion * (1 - pct / 100)) * 100) / 100,
    hasProjectionInputs: hasPlayerFees,
  };
}

// VAT SPLIT for player-funded / shared deals.
// ---------------------------------------------------------------------------
// The Client (club) is invoiced for the whole contract value, but only the
// CLUB FIXED FEE is a taxable SCIOS supply — the player-funded portion is money
// the club collects from players (consumers) and passes through, so it carries
// NO SCIOS VAT. This helper returns, for the whole contract, how the NET value
// splits into a VAT-bearing part and a VAT-free part. Every VAT site (payment
// rows, previews, all three document generators) derives from this so they
// agree. For a normal services / club-funded deal the whole value is vatable.
//
// Returns { vatableNet, exemptNet, isSplit }:
//   vatableNet — net amount that VAT is charged on (club fixed fee, or full value)
//   exemptNet  — net amount with NO VAT (player-funded portion), 0 for normal deals
//   isSplit    — true only when a player-funded deal actually has both parts
// The two always sum to the contract's net value.
export function vatSplit(contract) {
  const r2 = (n) => Math.round(n * 100) / 100;   // local: round2 lives in format.js
  const value = Number(contract?.value) || 0;
  if (!isPlayerFunded(contract)) {
    return { vatableNet: r2(value), exemptNet: 0, isSplit: false };
  }
  // Player-funded: only the club fixed fee is taxable. Shared (club_players)
  // has one; pure Player-funded (players_all) has none → the whole value is
  // player money and carries no VAT at all. The fixed fee is kept WHOLE (the
  // club commission is treated as coming off the player portion only), which is
  // also what the on-screen "guaranteed = club fixed fee" label promises.
  const clubFee = r2(Number(contract?.clubFixedFee ?? contract?.club_fixed_fee) || 0);
  const vatableNet = Math.min(clubFee, value);          // never exceed the value
  const exemptNet = r2(value - vatableNet);
  return { vatableNet, exemptNet, isSplit: vatableNet > 0 && exemptNet > 0 };
}

// ITEMISED SCOPE ROWS for a player-funded / shared deal.
// ---------------------------------------------------------------------------
// Previously the Scope table dumped the WHOLE contract value onto the platform-
// access line and marked every other service "Included" — which read as
// "platform access costs €18,250". This helper instead itemises the deal so a
// club sees what it's paying for:
//   • each PRICED service at its real list price (these ARE the club fee portion)
//   • a single "Player-funded contribution" line = value − club fee (net of the
//     commission), which is VAT-free
// The rows sum to the contract's net value. `reconciles` is false when the
// priced services don't add up to the club fee (a data-entry mismatch the
// document should warn about rather than silently mis-total).
//
// Returns { rows: [{label, amount, kind}], playerLine, servicesSum, clubFee,
//           reconciles } — or null for a non-player-funded deal (caller keeps
// its existing per-line rendering). `kind` is 'service' | 'player'.
export function playerFundedScopeRows(contract, lineItems) {
  if (!isPlayerFunded(contract)) return null;
  const r2 = (n) => Math.round(n * 100) / 100;
  const clubFee = r2(Number(contract?.clubFixedFee ?? contract?.club_fixed_fee) || 0);
  const value = r2(Number(contract?.value) || 0);
  // Priced services (real list price > 0) become the itemised club-fee lines;
  // zero-priced catalogue items stay "Included" deliverables.
  const items = Array.isArray(lineItems) ? lineItems : [];
  const priced = items.filter(i => Number(i.listPrice) > 0);
  const servicesSum = r2(priced.reduce((s, i) => s + Number(i.listPrice), 0));
  // Player-funded contribution = whatever the value is beyond the club fee (i.e.
  // the net player portion). For pure player-funded (no club fee) this is the
  // whole value; for Shared it is value − clubFee.
  const playerAmount = r2(value - clubFee);
  return {
    clubFee,
    servicesSum,
    playerLine: playerAmount > 0.005 ? { label: 'Player-funded contribution (net of commission)', amount: playerAmount, kind: 'player' } : null,
    // Reconciles when the priced services sum to the club fee (within a cent).
    // No priced services yet → not reconciled (nothing itemised to show).
    reconciles: clubFee <= 0.005 ? true : Math.abs(servicesSum - clubFee) <= 0.01,
  };
}

// Build the Commercial Terms clause parts from a contract + a money formatter
// `fm(amount)`. Returns { intro, breakdown, commission } (any may be '').
// The value is a PROJECTION from expected enrolment; player revenue is computed
// in net of the club commission. NOTE: ported into both PDF generators.
export function commercialModelText(contract, fm) {
  const basis = contract?.billingBasis || 'services';
  const model = contract?.paymentModel || null;
  if (basis !== 'player_funded' || !model) return { intro: '', breakdown: '', commission: '' };
  const cv = commercialValue(contract);
  const minP = Number(contract.minPlayers) || 0;
  const intro = PAYMENT_MODEL_LABELS[model] || '';
  // The CLUB pays the whole contract value in every model. Player fees FUND the
  // Client's payment (min players × fee × months); they are not collected from
  // players separately. The club commission is DEDUCTED from the total.
  const monthsStr = cv.months ? ` over ${cv.months} months` : '';
  const playerFeeStr = cv.fee
    ? `a player-participation fee of ${fm(cv.fee)} per player per month${monthsStr}`
    : `a player-participation fee agreed with the Client${monthsStr}`;
  const minStr = minP ? `, calculated on a minimum of ${minP} players` : '';
  // Only assert a commission % when it was actually configured (legacy rows may
  // have none — don't invent a commission clause they never signed).
  const hasPct = (contract.kickbackPct !== '' && contract.kickbackPct != null && Number(contract.kickbackPct) > 0) || cv.pct > 0;
  const commissionStr = hasPct ? ` A club commission of ${cv.pct}% is deducted from the player-participation fees.` : '';
  const fundStr = ' The full contract value is payable by the Client; player participation fees fund part of the Client\'s payment and are not collected separately from players.';

  if (model === 'club_players') {
    // Shared: services + club fixed fee + player fees, less commission — all paid
    // by the Client (club).
    const feeClause = cv.clubFee > 0
      ? `The Client shall pay the Service Provider a fixed fee of ${fm(cv.clubFee)} per season, together with ${playerFeeStr}${minStr}.`
      : `The Client shall pay the Service Provider the fixed fee set out in the Fees & Payment section, together with ${playerFeeStr}${minStr}.`;
    const breakdown = `${feeClause}${commissionStr}${fundStr}`;
    return { intro, breakdown, commission: '' };
  }
  // players_all — player fees (plus any services), less commission, all paid by
  // the Client (club); nothing is collected directly from players.
  const breakdown = `The Client shall pay the Service Provider ${playerFeeStr}${minStr}.${commissionStr}${fundStr}`;
  return { intro, breakdown, commission: '' };
}

// Build the Service Levels delivery sentence(s) from the default SLA + optional
// per-team bands. Returns an array of sentences. NOTE: ported into both PDF
// generators — keep in sync.
export function serviceLevelsLines(contract) {
  const defHours = Number(contract?.slaHours) || 72;
  const bands = Array.isArray(contract?.slaBands) ? contract.slaBands.filter(b => b && Array.isArray(b.teams) && b.teams.length && Number(b.hours)) : [];
  if (!bands.length) {
    return [`The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match within ${defHours} hours of receipt of usable match footage and applicable match data.`];
  }
  // If every team shares the same SLA, render one clean sentence.
  const distinctHours = [...new Set(bands.map(b => Number(b.hours)))];
  if (distinctHours.length === 1) {
    return [`The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match within ${distinctHours[0]} hours of receipt of usable match footage and applicable match data.`];
  }
  // Mixed SLA — list each timeframe with its teams (fastest first).
  const sorted = [...bands].sort((a, b) => Number(a.hours) - Number(b.hours));
  const lines = sorted.map(b => `for ${b.teams.join(', ')}, within ${Number(b.hours)} hours`);
  return [
    `The Service Provider shall use reasonable endeavours to deliver the key analytical outputs for each covered match, measured from receipt of usable match footage and applicable match data, as follows: ${lines.join('; ')}.`,
  ];
}

// VAT summary for the Fees clause. Derives net / VAT / gross from the payment
// rows (which carry the real per-instalment VAT), with a fallback to the
// contract value. Returns:
//   { applies, sentence, amountLabel, note }
// - applies: true when VAT is charged (>0).
// - sentence: the VAT line to show after the "total of X" sentence.
// - amountLabel: header/label for the instalment Amount column.
// - note: reverse-charge / out-of-scope note (from the payment rows), or ''.
// `fm(amount)` formats money. NOTE: ported into both PDF generators.
export function vatSummary(contract, fm, client) {
  const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  // Client country/VAT — accept it from an explicit client arg OR a nested/flat
  // field on the contract, so every renderer resolves the same value.
  const country = client?.country || contract?.client?.country || contract?.clientCountry || null;
  const hasVatNo = client?.vatNumber || client?.vat_number || contract?.client?.vatNumber || contract?.clientVatNumber || null;

  const pays = Array.isArray(contract?.payments) ? contract.payments : [];
  const num = (v) => Number(v) || 0;
  let net = 0, vat = 0, gross = 0, rate = 0;
  if (pays.length) {
    pays.forEach(p => {
      const a = num(p.amount ?? p.total_amount);
      const v = num(p.vatAmount ?? p.vat_amount);
      net += a; vat += v; gross += (num(p.totalAmount ?? p.total_amount) || (a + v));
      const r = num(p.vatRate ?? p.vat_rate); if (r) rate = r;
    });
  } else {
    net = num(contract?.value); gross = net;
  }
  net = Math.round(net * 100) / 100; vat = Math.round(vat * 100) / 100; gross = Math.round(gross * 100) / 100;

  // AUTHORITATIVE FALLBACK: if the payment rows carry no VAT split but the client
  // is domestic Cyprus (or an EU client with no reverse-charge VAT number), VAT
  // still applies at 19%. This guarantees the review copy and the signed copy
  // show identical VAT regardless of whether the frozen payment rows happened to
  // carry a vat_amount — the earlier "review shows no VAT, signed shows VAT" bug.
  // For a player-funded / shared deal, VAT applies ONLY to the club fixed fee
  // (the player-funded portion is VAT-free — see vatSplit), so the fallback must
  // charge 19% on the vatable portion of the net, NOT the whole net. This keeps
  // the frozen/legacy view (where per-row vatAmount may be missing) consistent
  // with the write path, instead of re-VATing the player money.
  const chargeable = (country === 'CY') || (country && EU.includes(country) && !hasVatNo);
  if (vat <= 0.005 && chargeable && net > 0) {
    rate = rate || 0.19;
    const split = vatSplit({ ...contract, value: net });
    vat = Math.round(split.vatableNet * rate * 100) / 100;
    gross = Math.round((net + vat) * 100) / 100;
  }

  const applies = vat > 0.005;
  const ratePct = rate ? Math.round(rate * 100) : 19;
  // `net`/`vat`/`gross` are exposed so every renderer can show a reconciling
  // Total-Contract-Value block on the SAME net basis: the headline value is
  // always NET (ex-VAT), with VAT and the gross total shown as their own rows.
  // This is the fix for the old contradiction where the Scope table printed the
  // gross as "Total Contract Value" while the Fees sentence called the very same
  // number "(exclusive of VAT)". net = contract.value everywhere now.
  if (applies) {
    return {
      applies: true,
      net, vat, gross, ratePct,
      sentence: `The above amount is exclusive of VAT. VAT at ${ratePct}% (${fm(vat)}) applies, giving a total amount payable of ${fm(gross)}.`,
      amountLabel: 'Amount (incl. VAT)',
      note: '',
    };
  }
  // No VAT charged — note why (reverse charge or out of scope), if we can tell.
  let noteText = '';
  if (country && EU.includes(country) && country !== 'CY' && hasVatNo) noteText = 'The VAT reverse-charge mechanism applies (Article 196, EU VAT Directive); the Client shall self-account for VAT.';
  else if (country && !EU.includes(country)) noteText = 'This supply is outside the scope of Cyprus VAT.';
  // No VAT: net === gross, vat 0. Renderers show a single Total row.
  return { applies: false, net, vat: 0, gross: net, ratePct, sentence: noteText, amountLabel: 'Amount', note: noteText };
}

// Build a short SLA bullet that respects per-team SLA bands (not just the single
// slaHours). Single SLA -> "24-hour SLA on key analytical outputs after each
// match"; mixed -> "SLA: 24h (U17, U19, Men's); 72h (U14, U15, U16)".
function slaSummaryLine(contract) {
  const bands = Array.isArray(contract?.slaBands)
    ? contract.slaBands.filter(b => b && Array.isArray(b.teams) && b.teams.length && Number(b.hours)) : [];
  if (!bands.length) {
    // No per-team analysis in this deal -> there is no match-analysis SLA to
    // report. Returning null (rather than a phantom 24h line) keeps platform-
    // only contracts truthful; summarizeAgreement filters nulls out.
    return null;
  }
  const distinct = [...new Set(bands.map(b => Number(b.hours)))];
  if (distinct.length === 1) {
    return `${distinct[0]}-hour SLA on key analytical outputs after each match`;
  }
  const sorted = [...bands].sort((a, b) => Number(a.hours) - Number(b.hours));
  return 'SLA: ' + sorted.map(b => `${Number(b.hours)}h (${b.teams.join(', ')})`).join('; ');
}

// Short, scannable bullet summary of the agreement for the admin Contract
// Details panel — just WHAT is included, no marketing prose. Pass the whole
// contract (or an object with .services, .slaBands, .slaHours). Returns an array
// of one-line strings.
export function summarizeAgreement(contract, slaHoursLegacy) {
  // Back-compat: earlier callers passed (services, slaHours). Detect that shape.
  const isContract = contract && (contract.services || contract.slaBands);
  const services = isContract ? contract.services : contract;
  const slaCtx = isContract ? contract : { slaHours: slaHoursLegacy };
  const items = computeServiceLineItems(services);
  if (!items.length) return [];
  const out = items.map(i => {
    let line = i.label;
    if (i.key === 'platform_access') {
      const seats = platformSeatsSummary(services.platform_access);
      if (seats) line += ` — ${seats}`;
    } else if (i.unit === 'per_match') {
      line += ` (${i.qty} matches)`;
    } else if (i.unit === 'per_unit') {
      line += ` (${i.qty})`;
    }
    if (i.included) line += ' (included)';
    return line;
  });
  const sla = slaSummaryLine(slaCtx);
  if (sla) out.push(sla);
  return out;
}

// `slaCtx` may be a number (legacy: a single slaHours) or a contract-shaped
// object with per-team `slaBands` (and optional `slaHours` fallback). The SLA
// sentence now reflects the ACTUAL chosen SLA/bands, and is omitted entirely
// when the deal has no per-team analysis (no phantom "24-hour SLA").
export function generateDescriptionFromServices(services, slaCtx) {
  const items = computeServiceLineItems(services);
  if (!items.length) return '';
  const groups = SERVICE_GROUPS;
  const lines = ['Science of Sports will provide the following services:', ''];
  groups.forEach(group => {
    const groupItems = items.filter(i => i.group === group);
    if (!groupItems.length) return;
    lines.push(group);
    groupItems.forEach(i => {
      const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
      const statusNote = (i.included && i.unit !== 'included') ? ' (included)' : '';
      lines.push(`- ${i.label}${qtyNote}${statusNote} — ${i.detail}`);
      if (i.key === 'platform_access') {
        const seats = platformSeatsSummary(services.platform_access);
        if (seats) lines.push(`  Access: ${seats} (exact users to be confirmed with the client).`);
      }
    });
    lines.push('');
  });
  const ctx = (slaCtx && typeof slaCtx === 'object') ? slaCtx : { slaHours: slaCtx };
  const sla = slaSummaryLine(ctx);
  if (sla) lines.push(sla.replace(/ SLA on key analytical/, ' SLA on delivery of key analytical') + '.');
  return lines.join('\n');
}
