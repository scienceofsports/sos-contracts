-- ============================================================================
-- Commercial Model — how the deal is funded, and the club kickback.
--
-- billing_basis: 'services' (contract value = sum of the services catalog, the
--   existing behaviour) or 'player_funded' (value = the kickback calculator:
--   players × monthly fee × months − kickback).
--
-- payment_model: who pays —
--   'club_all'      : the club pays the whole (net) fee.
--   'club_players'  : club + players split.
--   'players_all'   : players pay the Service Provider directly.
--
-- Player-fee inputs (used by the calculator + the clause):
--   player_count, player_monthly_fee, player_months.
--
-- kickback_pct: commission the Service Provider pays the club on player fees.
--   For club_all / club_players it is netted off the invoice (drives value);
--   for players_all it is stated as terms only ("% of fees actually collected,
--   settled per season") and does NOT drive value/installments.
-- ============================================================================
alter table public.contracts
  add column if not exists billing_basis        text    not null default 'services',
  add column if not exists payment_model        text,
  add column if not exists player_count         integer,
  add column if not exists player_monthly_fee   numeric,
  add column if not exists player_months        integer,
  add column if not exists kickback_pct         numeric;
