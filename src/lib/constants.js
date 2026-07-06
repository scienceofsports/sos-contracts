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
    detail:'Possession, passes, xG, player performance metrics and visual dashboards, delivered within 24 hours of each match.' },
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
  return SERVICE_CATALOG
    .filter(s => services[s.key] && services[s.key].selected)
    .map(s => {
      const qty = Number(services[s.key].qty) || 0;
      const complimentary = !!services[s.key].complimentary;
      const bundledIncluded = !!services[s.key].bundledIncluded;
      const rate = (complimentary || bundledIncluded) ? 0 : Number(services[s.key].rate != null ? services[s.key].rate : s.defaultRate);
      const amount = s.unit === 'flat' ? rate : (s.unit === 'included' ? 0 : rate * qty);
      return { ...s, qty, rate, complimentary, bundledIncluded, amount };
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

// Derive a "2026/2027" season label from ISO start/end dates (fallback to just
// the start year, or '' when no dates). Ported into both PDF generators.
export function seasonLabelFromDates(startDate, endDate) {
  const sy = startDate ? new Date(startDate).getUTCFullYear() : null;
  const ey = endDate ? new Date(endDate).getUTCFullYear() : null;
  if (sy && ey && ey !== sy) return `${sy}/${ey}`;
  if (sy) return `${sy}/${sy + 1}`;
  return '';
}

// Commercial Model — kickback calculator. Pure math, no formatting.
// gross = players × monthlyFee × months; kickback = gross × pct/100;
// net = gross − kickback. Returns numbers rounded to 2 dp.
// NOTE: ported verbatim into both PDF generators — keep in sync.
export function computeKickback({ playerCount, playerMonthlyFee, playerMonths, kickbackPct }) {
  const n = Number(playerCount) || 0;
  const fee = Number(playerMonthlyFee) || 0;
  const months = Number(playerMonths) || 0;
  const pct = Number(kickbackPct) || 0;
  const gross = Math.round(n * fee * months * 100) / 100;
  const kickback = Math.round(gross * (pct / 100) * 100) / 100;
  const net = Math.round((gross - kickback) * 100) / 100;
  return { gross, kickback, net, pct, playerCount: n, playerMonthlyFee: fee, playerMonths: months };
}

// Human labels for the payment models.
export const PAYMENT_MODEL_LABELS = {
  club_all: 'Club-funded — the Client pays the full fee',
  club_players: 'Shared — the Client and its players jointly fund the fee',
  players_all: 'Player-funded — fees are collected directly from players',
};

// Build the Commercial Terms clause parts from a contract + a money formatter
// `fm(amount)`. Returns { intro, breakdown, commission } (any may be '').
// NOTE: ported verbatim into both PDF generators — keep in sync.
export function commercialModelText(contract, fm) {
  const basis = contract?.billingBasis || 'services';
  const model = contract?.paymentModel || null;
  if (basis !== 'player_funded' || !model) return { intro: '', breakdown: '', commission: '' };
  const k = computeKickback({
    playerCount: contract.playerCount, playerMonthlyFee: contract.playerMonthlyFee,
    playerMonths: contract.playerMonths, kickbackPct: contract.kickbackPct,
  });
  const feeLine = `${k.playerCount} players at ${fm(k.playerMonthlyFee)} per player per month over ${k.playerMonths} months`;
  const intro = PAYMENT_MODEL_LABELS[model] || '';
  if (model === 'players_all') {
    // Terms only — no netted value; commission on amounts actually collected.
    const commission = k.pct ? `The Service Provider shall pay the Client a commission of ${k.pct}% of the fees actually collected from players enrolled through the Client, reconciled and settled per football season.` : '';
    return { intro, breakdown: `Access fees are collected by the Service Provider directly from participating players (${feeLine}).`, commission };
  }
  // club_all / club_players — calculated net, kickback shown as a breakdown.
  const breakdown = `Gross player fees (${feeLine}) total ${fm(k.gross)}. A club kickback of ${k.pct}% (${fm(k.kickback)}) is applied, resulting in a net contract value of ${fm(k.net)} payable by the Client.`;
  const commission = 'The kickback is applied as a discount against the fees payable by the Client and is reflected in the total contract value and payment schedule above.';
  return { intro, breakdown, commission };
}

export function generateDescriptionFromServices(services, slaHours) {
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
      const statusNote = i.unit === 'included' ? '' : i.bundledIncluded ? ' (included in the core platform price)' : i.complimentary ? ' (complimentary)' : '';
      lines.push(`- ${i.label}${qtyNote}${statusNote} — ${i.detail}`);
      if (i.key === 'platform_access') {
        const seats = platformSeatsSummary(services.platform_access);
        if (seats) lines.push(`  Access: ${seats} (exact users to be confirmed with the client).`);
      }
    });
    lines.push('');
  });
  lines.push(`${slaHours || 24}-hour SLA on delivery of key analytical outputs after each match.`);
  return lines.join('\n');
}
