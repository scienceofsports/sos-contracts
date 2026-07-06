-- ============================================================================
-- Default Service-Level SLA hours.
--
-- sla_hours is the DEFAULT SLA (in hours) applied to all covered teams, unless
-- overridden by a per-team band in sla_bands (migration 0011). This column was
-- referenced by the app from the start but never actually created — so the
-- default SLA silently reverted to 24h on edit. This adds it.
-- ============================================================================
alter table public.contracts
  add column if not exists sla_hours integer not null default 24;
