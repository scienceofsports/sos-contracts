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

/* CLIENT TYPES — who SCIOS signs services agreements with. These are the
   audiences the service catalogue is segmented for (see `appliesTo` below).
   'club' covers academies too: they buy the same catalogue, and the party
   clause wording is driven by clients.entity_type, not by this list. */
export const SERVICE_CLIENT_TYPES = ['federation', 'club', 'agency'];

/* Service catalog — the services SCIOS offers to clubs/academies, per
   "Science of Sports Services 2026-2027" pricing sheet. unit determines how
   quantity is interpreted: 'flat' (fixed fee, qty locked to 1), 'per_match'
   (rate x number of matches), 'per_unit' (rate x count), 'included' (bundled,
   no separate charge).

   `appliesTo` lists the client types a service is offered to, so the drafting
   UI shows only relevant lines. Every pre-existing service applies to
   federations and clubs exactly as before — this tag NARROWS nothing that was
   previously offered, it only keeps club/federation match services out of an
   agency subscription (an agency has no teams and no matches of its own). */
export const SERVICE_CATALOG = [
  { key:'platform_access', label:'Access to Football Platform', group:'Core Services', unit:'flat', defaultRate:11500, defaultQty:1,
    appliesTo:['federation','club'],
    detail:'Video + data combined, match events & clips, player comparisons, team & player rankings — everything accessible in one place.' },
  // AGENCY SUBSCRIPTION — the agency equivalent of platform_access. An agency
  // has no teams, venues or fixtures of its own: it buys full read access to the
  // platform to track and evidence the players it represents. Priced as a flat
  // annual subscription rather than a season fee tied to match volume.
  { key:'agency_subscription', label:'Agency Platform Subscription', group:'Core Services', unit:'flat', defaultRate:0, defaultQty:1,
    appliesTo:['agency'],
    detail:'Full access to the Science of Sports platform for the agency\'s staff — player profiles and performance data, match events and video clips, player comparisons, team and player rankings, and report downloads.' },
  { key:'camera_installation', label:'Installation of Fixed Camera', group:'Recording Services', unit:'per_unit', defaultRate:500, defaultQty:1,
    appliesTo:['federation','club'],
    detail:'One-off installation of fixed/robotic camera(s) at the club\'s venue, priced per camera.' },
  { key:'veo_camera', label:'VEO Camera', group:'Recording Services', unit:'flat', defaultRate:0, defaultQty:1,
    appliesTo:['federation','club'],
    detail:'Provision of a VEO automated (robotic) camera for the season, enabling the club to record its own home and away matches — no operator required.' },
  { key:'physical_data', label:'Match Physical Performance Data', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    appliesTo:['federation','club'],
    detail:'Match physical data, player load tracking and performance benchmarks to protect players and reduce injury risk.' },
  { key:'live_broadcasting', label:'Live Match Broadcasting', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    appliesTo:['federation','club'],
    detail:'Matches streamed live for parents, coaches and club management — increasing visibility for the club.' },
  { key:'match_recording', label:'Match Recording (Robotic camera)', group:'Recording Services', unit:'per_match', defaultRate:100, defaultQty:0,
    appliesTo:['federation','club'],
    detail:'Fixed/robotic camera recording for home and away matches — professional, high-quality coverage with no club equipment or staff needed.' },
  { key:'own_team_analysis', label:'Own Team Tactical Analysis', group:'Analysis Services', unit:'per_match', defaultRate:120, defaultQty:0,
    appliesTo:['federation','club'],
    detail:'Team structure analysis, phases of play, and key moments with video clips, prepared by professional performance analysts.' },
  { key:'opponent_analysis', label:'Opponent Tactical Analysis', group:'Analysis Services', unit:'per_match', defaultRate:120, defaultQty:0,
    appliesTo:['federation','club'],
    detail:'Opponent playing style, key players, and strengths & weaknesses ahead of each fixture.' },
  { key:'match_reports', label:'Match Team & Player Reports', group:'Reporting Services', unit:'included', defaultRate:0, defaultQty:130,
    appliesTo:['federation','club'],
    detail:'Possession, passes, xG, player performance metrics and visual dashboards.' },
  { key:'academy_reports', label:'Academy Performance Reports', group:'Reporting Services', unit:'per_unit', defaultRate:100, defaultQty:3,
    appliesTo:['federation','club'],
    detail:'Quarterly and full-season academy performance overviews — team progress, tactical evolution, physical trends and recommendations (1st Quarter, 2nd Quarter, Full Season).' },
  { key:'player_reports', label:'Individual Player Reports', group:'Reporting Services', unit:'per_unit', defaultRate:100, defaultQty:10,
    appliesTo:['federation','club','agency'],
    detail:'Detailed player analysis, strengths and improvement areas, with video-supported feedback.' },
  { key:'adhoc_reports', label:'Ad-Hoc Reports', group:'Reporting Services', unit:'included', defaultRate:0, defaultQty:0,
    appliesTo:['federation','club','agency'],
    detail:'On-demand reports tailored to specific needs, for fast support on key decisions whenever required.' },
  { key:'coach_support', label:'One-on-One Coach Support', group:'Coaching Support', unit:'included', defaultRate:0, defaultQty:3,
    appliesTo:['federation','club'],
    detail:'Platform guidance, analysis-driven solutions, educational support and custom plans tailored to the club, delivered across the season.' },
];

// Services offered to a given client type, for the drafting UI's service picker.
// A catalogue entry with no `appliesTo` is treated as available to EVERY type —
// so an untagged service (e.g. one added later without the tag) is never
// silently hidden. Falls back to the whole catalogue when no type is given,
// which is what every existing caller does today.
export function serviceCatalogFor(clientType) {
  if (!clientType) return SERVICE_CATALOG;
  return SERVICE_CATALOG.filter(s => !s.appliesTo || s.appliesTo.includes(clientType));
}

// Map a client's entity_type to the catalogue segment it buys from. Companies
// default to the club catalogue (a private academy is often a Ltd), and
// sponsors have no services catalogue at all — they sign the sponsorship
// document instead, so they fall back to the club list only if ever asked.
export function serviceClientTypeFor(entityType) {
  switch (entityType) {
    case 'federation': return 'federation';
    case 'agency':     return 'agency';
    case 'club':
    case 'company':
    case 'sponsor':
    default:           return 'club';
  }
}

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

// Is this contract the sponsorship document rather than the services document?
// Robust to snake_case (frozen snapshots) and to a missing field (legacy rows
// pre-0026 are always 'services'). NOTE: ported into both PDF generators.
export function isSponsorship(contract) {
  return (contract?.contractKind ?? contract?.contract_kind ?? 'services') === 'sponsorship';
}

// Does this contract cover matches? Drives whether the Service Levels clause is
// meaningful. A sponsorship covers none; an agency subscription covers none
// either (an agency has no teams of its own), so a phantom "72-hour SLA on key
// analytical outputs after each match" must not appear on those documents.
// A services contract with any per-match service keeps today's behaviour exactly.
// NOTE: ported into both PDF generators — keep in sync.
export function hasMatchServices(contract) {
  if (isSponsorship(contract)) return false;
  const items = computeServiceLineItems(contract?.services);
  if (items.some(i => i.unit === 'per_match')) return true;
  // An explicit per-team SLA band is itself evidence of match coverage, even if
  // the per-match services are recorded elsewhere (e.g. a bundled package).
  const bands = Array.isArray(contract?.slaBands ?? contract?.sla_bands)
    ? (contract.slaBands ?? contract.sla_bands) : [];
  return bands.some(b => b && Array.isArray(b.teams) && b.teams.length && Number(b.hours));
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
    // Player/football agencies are normally incorporated, but naming them as
    // agencies reads accurately in the party clause and keeps them a distinct
    // reportable segment. They keep company-style VAT handling (see
    // clientVatDisplay / VAT_REQUIRED_ENTITY_TYPES).
    case 'agency':     return 'an agency registered under the laws of';
    // Sponsors are ordinary commercial companies (e.g. KFC Cyprus) — the party
    // clause is the standard company wording. The type exists to drive the
    // sponsorship document and segment reporting, not to change the descriptor.
    case 'sponsor':
    case 'company':
    default:           return 'a company registered under the laws of';
  }
}

// Entity types that are incorporated businesses and therefore normally DO carry
// a VAT number — so a blank VAT field means "not filled in yet" (show the TBC
// placeholder) rather than "this entity has none". Clubs and federations are
// registered associations that frequently have no VAT registration at all.
export const VAT_REQUIRED_ENTITY_TYPES = ['company', 'agency', 'sponsor'];

// Resolve what the party clause should print for the Client's VAT number.
// Three distinct cases, and only the middle one is a placeholder:
//   * a known number      -> print it
//   * confirmed to have NONE (no_vat_number, or a non-corporate entity with a
//     blank field) -> '' so clientPartyClause OMITS the phrase entirely
//   * simply not filled in yet (a company) -> the caller's TBC placeholder
// `tbc` is passed in so each generator keeps its own placeholder styling.
// NOTE: ported into both PDF generators; keep all three in sync.
export function clientVatDisplay(client, tbc) {
  const vat = client?.vatNumber || client?.vat_number;
  if (vat) return vat;
  // Explicitly flagged as having no VAT number — e.g. a non-profit company
  // limited by guarantee. Never show a placeholder for a number that will
  // never exist; an executed contract must not carry a permanent blank.
  if (client?.noVatNumber ?? client?.no_vat_number) return '';
  // Clubs/federations are registered associations and frequently have no VAT
  // registration at all, so a blank means "none" rather than "pending".
  // Agencies and sponsors ARE incorporated businesses, so they behave like a
  // company here — a blank is "not filled in yet", not "has none".
  const entityType = client?.entityType || client?.entity_type || 'company';
  return VAT_REQUIRED_ENTITY_TYPES.includes(entityType) ? tbc : '';
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

/* =========================================================================
   SPONSORSHIP
   -------------------------------------------------------------------------
   A sponsorship agreement grants RIGHTS (exposure, branding, presence) rather
   than delivering services. It is modelled on the executed KFC × "Youth Zone"
   agreement: rights are listed with a quantity and a frequency, and the whole
   package is priced as ONE fee — individual rights are not separately priced.

   Deliberately BESPOKE: no fixed Gold/Silver/Bronze tiers, because SCIOS has
   priced sponsorship deal-by-deal and there is not yet enough repetition to
   justify packages. Tiers can be added later without a schema change.
   ========================================================================= */

// The sponsorship inventory SCIOS can sell, grouped the way the sponsorship
// deck presents it. `unitLabel` is the noun used when a quantity is shown, and
// `defaultPer` seeds the frequency selector.
export const SPONSORSHIP_RIGHT_TYPES = [
  // --- Broadcast (the "Youth Zone" TV show with Cablenet) -------------------
  { key:'tv_spot',        label:'Television Advertising Spot', group:'Broadcast', unitLabel:'spot',      defaultPer:'episode',
    detail:'Television advertising spot broadcast within the programme.' },
  { key:'power_popup',    label:'Power Pop-Up Placement',      group:'Broadcast', unitLabel:'placement', defaultPer:'episode',
    detail:'Power pop-up advertising placement displayed during the programme.' },
  { key:'animated_popup', label:'Animated Pop-Up Placement',   group:'Broadcast', unitLabel:'placement', defaultPer:'episode',
    detail:'Animated pop-up advertising placement displayed during the programme.' },
  { key:'show_billboard', label:'Opening / Closing Billboard', group:'Broadcast', unitLabel:'billboard', defaultPer:'episode',
    detail:'Sponsor billboard shown in the programme\'s opening and closing sequence.' },
  // --- Platform & reports (the SCIOS digital estate) ------------------------
  { key:'platform_branding', label:'Platform Branding',        group:'Digital',   unitLabel:'placement', defaultPer:'season',
    detail:'Sponsor branding displayed across the Science of Sports platform, seen by coaches, players, analysts and academies.' },
  // `uncountable`: the right is a single standing entitlement, not a countable
  // run of placements — "Sponsor logo on every performance report", not "one
  // performance report branding placement per report". sponsorshipRightText
  // renders these without the "N (n)" prefix.
  { key:'reports_branding',  label:'Performance Report Branding', group:'Digital', unitLabel:'placement', defaultPer:'report',
    uncountable:true, uncountableText:'Sponsor logo displayed on every performance report',
    detail:'Sponsor logo displayed on the performance reports delivered to players, coaches and academies.' },
  { key:'social_post',       label:'Social Media Feature',     group:'Digital',   unitLabel:'post',      defaultPer:'month',
    detail:'Sponsor feature published across the Science of Sports social media channels.' },
  // --- Events (Youth Awards, Coach Awards, Conference, Summit, camps) -------
  { key:'event_naming',      label:'Event Naming Rights',      group:'Events',    unitLabel:'right',     defaultPer:'event',
    uncountable:true, uncountableText:'Event naming rights',
    detail:'Sponsor name associated with the event title and applied across event branding.' },
  { key:'event_branding',    label:'Event Branding & Signage', group:'Events',    unitLabel:'placement', defaultPer:'event',
    detail:'Sponsor branding displayed on stage, signage and printed materials at the event.' },
  { key:'event_presence',    label:'Event Presence / Activation', group:'Events', unitLabel:'activation', defaultPer:'event',
    detail:'On-site sponsor presence or brand activation at the event.' },
  { key:'award_presentation',label:'Award Presentation',       group:'Events',    unitLabel:'award presentation', defaultPer:'event',
    detail:'Sponsor representative presents an award on stage during the ceremony.' },
];

export const SPONSORSHIP_RIGHT_GROUPS = ['Broadcast', 'Digital', 'Events'];

// Frequency options for a rights row. 'total' means the quantity is the whole
// commitment rather than a per-occurrence rate (e.g. "10 posts in total").
export const SPONSORSHIP_PER_OPTIONS = [
  { value:'episode', label:'per episode' },
  { value:'event',   label:'per event' },
  { value:'match',   label:'per match' },
  { value:'report',  label:'per report' },
  { value:'month',   label:'per month' },
  { value:'season',  label:'for the season' },
  { value:'total',   label:'in total' },
];

// Resolve the stored sponsorship_rights rows against the catalogue, dropping
// unknown keys and rows with no quantity. Mirrors computeServiceLineItems so the
// rights table renders like the scope table.
// NOTE: ported into both PDF generators — keep in sync.
export function computeSponsorshipRights(rights) {
  if (!Array.isArray(rights)) return [];
  const byKey = Object.fromEntries(SPONSORSHIP_RIGHT_TYPES.map(r => [r.key, r]));
  return rights
    .map(r => {
      const def = byKey[r?.type];
      if (!def) return null;
      const qty = Number(r.qty) || 0;
      if (qty <= 0) return null;
      return {
        ...def,
        qty,
        per: r.per || def.defaultPer,
        // Per-deal override of the catalogue wording; blank falls back to it.
        detail: (r.detail && String(r.detail).trim()) || def.detail,
      };
    })
    .filter(Boolean);
}

// One rights row as a contract sentence fragment — "Three (3) television
// advertising spots per episode (maximum duration: 30 seconds each)". Numbers
// are spelled out to match the drafting convention of the executed KFC
// agreement. NOTE: ported into both PDF generators — keep in sync.
const NUMBER_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];

export function spellNumber(n) {
  const i = Number(n);
  if (!Number.isInteger(i) || i < 0 || i > 20) return String(n);
  const w = NUMBER_WORDS[i];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function sponsorshipRightText(row) {
  if (!row) return '';
  const qty = Number(row.qty) || 0;
  const perOptU = SPONSORSHIP_PER_OPTIONS.find(p => p.value === row.per);
  // Uncountable rights are standing entitlements — render them as a statement,
  // with the frequency appended only when it adds meaning (not "per report",
  // which the wording already implies).
  if (row.uncountable) {
    const base = row.uncountableText || row.label;
    const skipPer = !row.per || row.per === 'total' || row.per === 'report';
    return `${base}${skipPer ? '' : ` ${perOptU?.label || ''}`}`.replace(/\s+/g, ' ').trim();
  }
  const label = String(row.label || '').toLowerCase();
  const unit = String(row.unitLabel || '').toLowerCase();
  // The catalogue label usually ALREADY ends in the unit noun ("Television
  // Advertising Spot" + unit "spot"), so appending it blindly produced
  // "…advertising spot spots". Pluralise the label's own tail in that case, and
  // only append the unit noun when the label doesn't already end with it
  // (e.g. "Platform Branding" + "placement" -> "platform branding placements").
  const endsWithUnit = unit && (label === unit || label.endsWith(` ${unit}`));
  let phrase;
  if (endsWithUnit) {
    phrase = qty === 1 ? label : `${label}s`;
  } else {
    phrase = unit ? `${label} ${qty === 1 ? unit : `${unit}s`}` : label;
  }
  const perOpt = SPONSORSHIP_PER_OPTIONS.find(p => p.value === row.per);
  const perStr = perOpt ? ` ${perOpt.label}` : '';
  return `${spellNumber(qty)} (${qty}) ${phrase}${perStr}`.replace(/\s+/g, ' ').trim();
}

// Clause names a special term can reference (stable — by name, not number).
// Includes both document kinds' clauses: a services agreement never offers the
// sponsorship clause names in its picker (and vice versa) — the drafting UI
// filters by contract kind — but the list stays one stable superset so a stored
// special term keeps resolving if a contract's kind is ever corrected.
export const SPECIAL_TERM_CLAUSES = [
  'General', 'Purpose', 'Scope of Services', 'Scope of Analysis', 'Fees & Payment',
  'Commercial Terms & Club Commission', 'Sponsorship Rights', 'Branding & Materials',
  'Confidentiality & Data Protection',
  'Intellectual Property Rights', 'Duration', 'Termination',
  'Limitation of Liability', 'Force Majeure', 'Governing Law & Jurisdiction',
];

// Clause names offered in the special-terms picker for a given contract kind —
// so a sponsorship contract doesn't offer "Scope of Analysis" and a services
// contract doesn't offer "Sponsorship Rights".
const SERVICES_ONLY_CLAUSES    = ['Scope of Services', 'Scope of Analysis', 'Commercial Terms & Club Commission'];
const SPONSORSHIP_ONLY_CLAUSES = ['Sponsorship Rights', 'Branding & Materials'];

export function specialTermClausesFor(contractKind) {
  const drop = contractKind === 'sponsorship' ? SERVICES_ONLY_CLAUSES : SPONSORSHIP_ONLY_CLAUSES;
  return SPECIAL_TERM_CLAUSES.filter(c => !drop.includes(c));
}

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

// Opening line of the Commercial Terms clause, per funding model. Deliberately
// separate from PAYMENT_MODEL_LABELS: those describe the models to an admin
// choosing one, and read as statements of fact once printed in a signed contract
// (e.g. "fees are collected directly from players" is untrue — the Client
// collects from families through its own offices and pays the Service Provider).
// NOTE: ported into both PDF generators — keep in sync.
export const DOCUMENT_MODEL_INTRO = {
  club_all: 'Club-funded',
  club_players: 'Shared funding — a fixed fee, with the remainder funded by player participation',
  players_all: 'Player-funded — the fees are funded by player participation and paid by the Client',
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
  // Pure Player-funded (players_all) EXCLUDES the club fixed fee from the value
  // (see `includeClubFee` in commercialValue) — so a fee left over in the form
  // from a previous model must not be carved out of the value as vatable here.
  // Only Shared (club_players) actually has a club fee inside the value.
  const model = contract?.paymentModel ?? contract?.payment_model;
  const clubFee = model === 'players_all'
    ? 0
    : r2(Number(contract?.clubFixedFee ?? contract?.club_fixed_fee) || 0);
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
// `fm` (optional) is a money formatter; when given, the player line spells out
// the derivation — e.g. "Player-funded contribution (100 × €10 × 11 months, less
// 25% commission)" — so the club sees where the amount comes from rather than a
// bare figure. Falls back to a plain label when the player inputs aren't all set.
export function playerFundedScopeRows(contract, lineItems, fm) {
  if (!isPlayerFunded(contract)) return null;
  const r2 = (n) => Math.round(n * 100) / 100;
  // Same rule as vatSplit/commercialValue: only Shared carries a club fixed fee
  // inside the value; on pure Player-funded the whole value is player money.
  const pfModel = contract?.paymentModel ?? contract?.payment_model;
  const clubFee = pfModel === 'players_all'
    ? 0
    : r2(Number(contract?.clubFixedFee ?? contract?.club_fixed_fee) || 0);
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
  // Spell out the derivation when we have the inputs: players × fee × months,
  // less the commission %. Only show the parts that are actually set.
  const minPlayers = Number(contract?.minPlayers ?? contract?.min_players) || 0;
  const fee = Number(contract?.playerMonthlyFee ?? contract?.player_monthly_fee) || 0;
  const months = Number(contract?.playerMonths ?? contract?.player_months) || 0;
  const rawPct = contract?.kickbackPct ?? contract?.kickback_pct;
  const pct = (rawPct === '' || rawPct == null) ? DEFAULT_KICKBACK_PCT : Number(rawPct) || 0;
  const money = typeof fm === 'function' ? fm : (a) => String(a);
  let label = 'Player-funded contribution (net of commission)';
  if (minPlayers > 0 && fee > 0 && months > 0) {
    const commStr = pct > 0 ? `, less ${pct}% commission` : '';
    // Single period = a one-off per-player season fee; don't render "× 1 months".
    const perStr = months === 1 ? ' for the season' : ` × ${months} months`;
    label = `Player-funded contribution (${minPlayers} × ${money(fee)}${perStr}${commStr})`;
  }
  return {
    clubFee,
    servicesSum,
    playerLine: playerAmount > 0.005 ? { label, amount: playerAmount, kind: 'player' } : null,
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
  // The UI labels describe the models to an admin picking one ("fees are collected
  // directly from players") — which is factually WRONG in the contract: the Client
  // collects and pays the Service Provider, nothing is collected from players by
  // us. The next sentence of the clause says exactly that, so the label contradicts
  // it. Use document wording here instead. NOTE: ported into both PDF generators.
  const intro = DOCUMENT_MODEL_INTRO[model] || PAYMENT_MODEL_LABELS[model] || '';
  // The CLUB pays the whole contract value in every model. Player fees FUND the
  // Client's payment (min players × fee × months); they are not collected from
  // players separately. The club commission is DEDUCTED from the total.
  // A single-period deal is a one-off per-player fee for the season, NOT a monthly
  // subscription — saying "per player per month over 1 months" invites the club to
  // read it as recurring (and is ungrammatical). Word it per-season instead.
  const oneOff = cv.months === 1;
  const monthsStr = oneOff ? ' for the season' : (cv.months ? ` per month over ${cv.months} months` : '');
  const playerFeeStr = cv.fee
    ? `a player-participation fee of ${fm(cv.fee)} per player${monthsStr}`
    : `a player-participation fee agreed with the Client${monthsStr}`;
  const minStr = minP ? `, calculated on a minimum of ${minP} players` : '';
  // Only assert a commission % when it was actually configured (legacy rows may
  // have none — don't invent a commission clause they never signed).
  const hasPct = (contract.kickbackPct !== '' && contract.kickbackPct != null && Number(contract.kickbackPct) > 0) || cv.pct > 0;
  const commissionStr = hasPct ? ` A club commission of ${cv.pct}% is deducted from the player-participation fees.` : '';
  // On players_all the player fees fund the WHOLE payment, not "part" of it — the
  // "part" wording only describes Shared, where a club fixed fee covers the rest.
  const fundStr = model === 'players_all'
    ? ' The full contract value is payable by the Client; the player-participation fees fund the Client\'s payment and are not collected from players by the Service Provider.'
    : ' The full contract value is payable by the Client; player participation fees fund part of the Client\'s payment and are not collected separately from players.';

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

// THE date of the agreement — the single source for both the "This Agreement is
// made on …" line and the Service Provider's countersignature date, so the two
// can never disagree within one document.
//
// Pinned to createdAt (when the agreement was drawn up), NOT sentAt. sentAt is
// derived from the LAST send event, so every re-send silently re-dated the
// document — and because the made-on line and the signature block fell back
// through sentAt differently, a re-sent contract could print "made on 07/07"
// against a countersignature of 17/07. The agreement date is a fact about the
// document, not about how many times it was emailed.
//
// Falls back to sentAt then now() only when createdAt is missing (legacy rows).
// NOTE: ported into both PDF generators; keep all three in sync.
export function agreementDate(contract) {
  return contract?.createdAt || contract?.created_at
    || contract?.sentAt || contract?.sent_at
    || new Date().toISOString();
}

// Payment-timing wording for the Fees clause. Two payment triggers exist and
// they are mutually exclusive — stating both is a contradiction a client can
// exploit:
//   * NET TERMS  — "net N days from the date of a valid invoice". The due date
//     floats with whenever the invoice is issued. Correct for a single payment.
//   * FIXED DATES — an instalment schedule with explicit due dates. The dates
//     govern; "net 30" is then meaningless (invoice on 01/08 for a 15/08
//     instalment and the two rules disagree by a fortnight).
// So when the contract carries a real dated instalment schedule, we DROP the net
// terms and instead promise an invoice ahead of each due date — which is also
// what makes the fixed dates collectable.
// Returns { timingPhrase, advanceInvoiceSentence } — the latter '' when not
// applicable. NOTE: ported into both PDF generators; keep all three in sync.
export function paymentTimingWording(contract) {
  const pays = Array.isArray(contract?.payments) ? contract.payments : [];
  const dated = pays.length > 1 && pays.every(p => p?.dueDate || p?.due_date);
  if (dated) {
    return {
      timingPhrase: ' in accordance with the payment schedule set out below.',
      advanceInvoiceSentence: 'The Service Provider shall issue a separate invoice for each instalment in advance of its due date.',
    };
  }
  const days = contract?.paymentTermsDays ?? contract?.payment_terms_days;
  return {
    timingPhrase: days != null ? `, net ${days} days from the date of a valid invoice.` : '.',
    advanceInvoiceSentence: '',
  };
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

// COMPACT operations summaries for the Dashboard overview table.
// slaLabel: short SLA for a table cell — "24h", "72h", or "24h+" when the
// contract has mixed per-team bands (tightest shown, "+" flags the mix). "—"
// when there's no match-analysis SLA (e.g. platform-only deals).
export function slaLabel(contract) {
  const bands = Array.isArray(contract?.slaBands)
    ? contract.slaBands.filter(b => b && Array.isArray(b.teams) && b.teams.length && Number(b.hours)) : [];
  if (bands.length) {
    const hours = bands.map(b => Number(b.hours));
    const min = Math.min(...hours);
    const mixed = new Set(hours).size > 1;
    return `${min}h${mixed ? '+' : ''}`;
  }
  // Fall back to the single slaHours only when it was explicitly set.
  const h = Number(contract?.slaHours);
  return h > 0 ? `${h}h` : '—';
}

// cameraLabel: what recording hardware the deal includes — "2× Fixed", "1× VEO",
// "1× VEO + 2× Fixed", or "—". The ticked Recording Services are the ONLY source:
// if no camera service is selected, the club has no camera and this returns "—".
//
// It deliberately does NOT scan the special terms / description for the word
// "camera". That fallback used to exist (flagged with "*") to surface cameras
// recorded as prose, but contract prose also mentions cameras that are NOT sold —
// e.g. an upsell clause offering camera analysis as a future add-on — so a text
// match reported "has a fixed camera" when the truth was "a camera was discussed".
// Cameras are priced hardware: if one is being provided, it is a ticked service.
export function cameraLabel(contract) {
  const items = computeServiceLineItems(contract?.services);
  const byKey = Object.fromEntries(items.map(i => [i.key, i]));
  const parts = [];
  // A SELECTED camera is provided regardless of whether its price is separately
  // charged or bundled ("Included") — the Cameras column tracks hardware, not
  // pricing. So we count it whenever the service line is present (computeService-
  // LineItems only returns selected services), not only when it's separately priced.
  const veo = byKey['veo_camera'];
  const fixed = byKey['camera_installation'];
  if (veo) parts.push(`${veo.qty || 1}× VEO`);
  if (fixed) parts.push(`${fixed.qty || 1}× Fixed`);
  return parts.length ? parts.join(' + ') : '—';
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
