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
  paid:     { bg:'bg-green-100',  text:'text-green-700'  },
  pending:  { bg:'bg-amber-100',  text:'text-amber-700'  },
  overdue:  { bg:'bg-red-100',    text:'text-red-700'    },
  disputed: { bg:'bg-purple-100', text:'text-purple-700' },
};

export const CONTRACT_TYPES = [
  { value:'platform_subscription', label:'Platform Subscription' },
  { value:'data_license', label:'Data License' },
  { value:'consulting', label:'Consulting' },
  { value:'partnership', label:'Partnership' },
  { value:'custom', label:'Custom' },
];

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
