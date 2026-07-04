-- ============================================================================
-- CC recipients + client-provided contacts.
--
-- cc_emails: additional people (finance, a director) who receive the "please
-- sign" email and the signed certificate — informational only; the single
-- signer still signs.
--
-- The academy's operations/communication contact person and finance contact
-- are captured from the CLIENT during signing and stored on the contract, then
-- shown in the executed document.
-- ============================================================================
alter table public.clients
  add column if not exists cc_emails jsonb not null default '[]'::jsonb;

alter table public.contracts
  add column if not exists contact_name    text,
  add column if not exists contact_role    text,
  add column if not exists contact_email   text,
  add column if not exists contact_phone   text,
  add column if not exists finance_name    text,
  add column if not exists finance_email   text;
