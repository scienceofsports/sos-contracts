-- ============================================================================
-- Mixed / per-team Service-Level bands.
--
-- sla_hours (existing) stays the DEFAULT SLA that applies to all covered teams.
-- sla_bands optionally overrides it for specific teams — a JSON array of
--   { teams: [ ...team labels... ], hours: <number> }. Teams not listed in any
--   band fall under the default sla_hours. The Service Levels clause lists each
--   band plus the default.
-- ============================================================================
alter table public.contracts
  add column if not exists sla_bands jsonb not null default '[]'::jsonb;
