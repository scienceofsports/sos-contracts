-- ============================================================================
-- Decline / request changes + admin resend & revise (GAP 5)
--
-- Adds a 'declined' status to both the signing_requests and contracts status
-- enums so a signer can decline (or request changes) and the admin can see it,
-- then resend a fresh link or recall the contract to draft to revise it.
--
-- Postgres CHECK constraints can't be altered in place, so we DROP and re-ADD
-- them. The constraint names are the auto-generated `<table>_status_check`
-- (confirmed from 0001_initial_schema.sql, where both columns declare an inline
-- `check (status in (...))`). `if exists` keeps this safe to re-run.
-- ============================================================================

alter table public.signing_requests drop constraint if exists signing_requests_status_check;
alter table public.signing_requests add constraint signing_requests_status_check
  check (status in ('sent','viewed','otp_sent','otp_verified','signed','expired','cancelled','declined'));

alter table public.contracts drop constraint if exists contracts_status_check;
alter table public.contracts add constraint contracts_status_check
  check (status in ('draft','sent','signed','active','expired','cancelled','declined'));
