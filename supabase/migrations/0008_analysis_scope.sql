-- ============================================================================
-- Analysis Scope — per-contract definition of exactly what is analysed.
--
-- analysis_teams: which of the Client's teams the Service Provider will analyse
--   (any of U14, U15, U16, U17, U19, Men's). Stored as a JSON array of strings.
--
-- opp_* flags: whether the Client is granted access to opponent analysis —
--   three independent toggles (match footage, team analysis, player analysis).
--
-- The clause also states, as fixed wording, that analysis covers LEAGUE
-- competition matches only (excluding friendly and cup matches); the season is
-- derived from the contract's start/end dates (not stored here).
-- ============================================================================
alter table public.contracts
  add column if not exists analysis_teams        jsonb   not null default '[]'::jsonb,
  add column if not exists opp_match_footage     boolean not null default false,
  add column if not exists opp_team_analysis     boolean not null default false,
  add column if not exists opp_player_analysis   boolean not null default false;
