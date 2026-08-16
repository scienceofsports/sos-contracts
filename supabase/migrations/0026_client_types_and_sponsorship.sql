-- ============================================================================
-- 0026_client_types_and_sponsorship
--
-- Extends the contracts system from "SCIOS supplies analysis services to a club"
-- to the five commercial counterparty types SCIOS actually signs with:
--
--   federation (CFA)  ─┐
--   club / academy     ├─ services agreements  (today's document, unchanged)
--   agency             ─┘  (agency = full-access platform subscription)
--   sponsor            ──  sponsorship agreements (a DIFFERENT document)
--
-- A sponsorship deal is not a services deal with different line items. It grants
-- RIGHTS (ad spots, branding placements, event presence) rather than delivering
-- services, carries no SLA and no scope of analysis, and puts a reciprocal
-- obligation on the sponsor (supply brand assets in broadcast format). See the
-- executed KFC "Youth Zone" agreement, which this models.
--
-- ---------------------------------------------------------------------------
-- SAFETY — existing contracts are NOT impacted:
--   * Every column added here is NULLable or DEFAULTed to today's behaviour
--     (contract_kind defaults to 'services'), so an existing row renders a
--     byte-identical document.
--   * The entity_type check constraint is WIDENED, never narrowed — widening
--     cannot reject any row that already exists.
--   * Sent/active/signed contracts render from the frozen document_snapshot /
--     executed_snapshot, so document code changes cannot alter them at all.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CLIENT ENTITY TYPE — add 'agency' and 'sponsor'.
--
-- 0021 introduced entity_type to make the party clause legally accurate ('a
-- company' vs 'an association' vs 'a governing body'). Two more counterparty
-- kinds now sign with SCIOS:
--   'agency'  -> player/football agencies buying a full platform subscription.
--                Usually incorporated, so they keep company-style VAT handling,
--                but the descriptor names them accurately as agencies.
--   'sponsor' -> commercial brands buying sponsorship rights (e.g. KFC). These
--                are ordinary companies and take the company descriptor; the
--                type exists so sponsors are a reportable segment and so the
--                drafting UI can offer the sponsorship document.
-- ----------------------------------------------------------------------------
alter table public.clients
  drop constraint if exists clients_entity_type_check;
alter table public.clients
  add constraint clients_entity_type_check
  check (entity_type in ('company', 'club', 'federation', 'agency', 'sponsor'));

-- ----------------------------------------------------------------------------
-- 2. CONTRACT KIND — which document/clause set to render.
--
-- 'services'    -> today's agreement (Purpose / Scope of Services / Scope of
--                  Analysis / Fees / Commercial Terms / Service Levels / …).
--                  DEFAULT, so every existing contract keeps its exact document.
-- 'sponsorship' -> Purpose / Sponsorship Rights / Fee / Branding & Materials,
--                  with Scope of Analysis, Service Levels and Commercial Terms
--                  suppressed (they are meaningless for a sponsorship).
--
-- NOTE: this drives the DOCUMENT, while clients.entity_type describes the PARTY.
-- They are deliberately separate — a federation could in principle sponsor a
-- property, and an agency signs a services agreement.
-- ----------------------------------------------------------------------------
alter table public.contracts
  add column if not exists contract_kind text not null default 'services';

alter table public.contracts
  drop constraint if exists contracts_contract_kind_check;
alter table public.contracts
  add constraint contracts_contract_kind_check
  check (contract_kind in ('services', 'sponsorship'));

-- ----------------------------------------------------------------------------
-- 3. SPONSORSHIP PROPERTY — what is actually being sponsored.
--
-- The KFC Purpose clause names the property explicitly ("the television program
-- 'Youth Zone', produced by Science of Sports and broadcast on Cablenet Sports
-- channels"). Without this the Purpose clause cannot be written accurately, so
-- it is a first-class field rather than free text buried in the description.
-- Examples: 'Youth Zone', 'Annual Youth Awards 2026', 'the Science of Sports
-- platform', 'Monthly Coach Awards'.
-- ----------------------------------------------------------------------------
alter table public.contracts
  add column if not exists sponsorship_property text;

-- Optional one-line context for the property, printed after the property name in
-- the Purpose clause (e.g. 'produced by Science of Sports and broadcast on
-- Cablenet Sports channels'). Kept separate from `description` so the Purpose
-- clause composes cleanly.
alter table public.contracts
  add column if not exists sponsorship_property_detail text;

-- ----------------------------------------------------------------------------
-- 4. SPONSORSHIP RIGHTS — the bespoke rights granted, as structured rows.
--
-- Deliberately BESPOKE (no fixed Gold/Silver/Bronze tiers): SCIOS has priced
-- sponsorship deal-by-deal so far, and there is not yet enough repetition to
-- justify fixed packages. Tiers can be layered on later without a schema change.
--
-- Shape: an array of rows, mirroring how services are stored so the rights table
-- can render like the scope table:
--   [{ "type": "tv_spot",        "qty": 3, "per": "episode", "detail": "max 30 seconds each" },
--    { "type": "power_popup",    "qty": 2, "per": "episode", "detail": "" },
--    { "type": "animated_popup", "qty": 2, "per": "episode", "detail": "" }]
--
-- `type` matches a key in SPONSORSHIP_RIGHT_TYPES (src/lib/constants.js).
-- Pricing is a single package fee on contracts.value — individual rights are NOT
-- separately priced, which is how the KFC deal was actually structured.
-- ----------------------------------------------------------------------------
alter table public.contracts
  add column if not exists sponsorship_rights jsonb;

-- Activation window in plain terms — e.g. 'eight (8) episodes broadcast between
-- March 2026 and February 2027'. The contract start/end dates give the legal
-- term; this states the delivery commitment inside that term, as KFC clause 2
-- does. Free text because the unit varies by property (episodes, events, months).
alter table public.contracts
  add column if not exists sponsorship_activation text;

-- ----------------------------------------------------------------------------
-- 5. INDEXES — segment reporting (contracts by kind, clients by type).
-- ----------------------------------------------------------------------------
create index if not exists contracts_contract_kind_idx on public.contracts (contract_kind);
create index if not exists clients_entity_type_idx     on public.clients   (entity_type);
