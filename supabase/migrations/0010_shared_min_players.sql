-- ============================================================================
-- Shared commercial model — minimum players.
--
-- For the Shared model, the contract value is the FIXED amount agreed with the
-- club (entered as the contract value); players fund the remainder at
-- player_monthly_fee per month. The exact number of players is not known in
-- advance, so it is not computed into the value. min_players optionally records
-- a minimum player commitment, stated as a term in the Commercial clause.
-- ============================================================================
alter table public.contracts
  add column if not exists min_players integer;
