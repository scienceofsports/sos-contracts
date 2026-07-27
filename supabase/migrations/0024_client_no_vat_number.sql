-- ============================================================================
-- Client has NO VAT number (explicit), vs. one simply not filled in yet.
--
-- The party clause distinguishes three cases, and until now could only express
-- two of them:
--   1. VAT number known        -> ", VAT number CY12345678X"
--   2. VAT number not yet known -> ", VAT number [ to be confirmed on signing ]"
--   3. Client HAS no VAT number -> phrase omitted entirely
--
-- Case 3 was inferred from entity_type: clubs/federations (registered
-- associations) omitted the phrase, companies always showed the placeholder.
-- That inference breaks for a company that is legitimately not VAT-registered
-- — e.g. a non-profit company limited by guarantee, which is how many Cyprus
-- NPOs are actually incorporated (registered with the Registrar of COMPANIES,
-- HE number, but no VAT registration). Such a client is a "company" for the
-- descriptor and has no VAT number for the VAT phrase, and the old model
-- forced a permanent "[ to be confirmed on signing ]" into an executed
-- contract for a number that will never exist.
--
-- This flag states the fact explicitly instead of guessing it from entity type.
--
-- Default false preserves today's behaviour for every existing client: a
-- company with a blank VAT still shows the placeholder, so nothing silently
-- loses the prompt that exists to catch an unfilled field.
-- ============================================================================

alter table public.clients
  add column if not exists no_vat_number boolean not null default false;

comment on column public.clients.no_vat_number is
  'True when the client is confirmed NOT to have a VAT number (e.g. a non-profit company limited by guarantee). Omits the VAT phrase from the contract party clause entirely, rather than showing a "to be confirmed on signing" placeholder for a number that does not exist.';
