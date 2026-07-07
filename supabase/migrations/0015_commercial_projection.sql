-- ============================================================================
-- 0015_commercial_projection
--
-- Player-funded commercial models (Shared / Player-funded) now compute the
-- contract value as a projection from expected enrolment:
--   Shared:        club_fixed_fee + (player_fee x months x expected_players x (1 - kickback%))
--   Player-funded: player_fee x months x expected_players x (1 - kickback%)
-- Two new inputs back this: the club's fixed fee (Shared) and the expected
-- number of players used for the projection (separate from min_players, the
-- contractual floor).
-- ============================================================================

alter table public.contracts add column if not exists expected_players integer;
alter table public.contracts add column if not exists club_fixed_fee numeric;
