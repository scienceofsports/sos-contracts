-- ============================================================================
-- Client ENTITY TYPE — a company is not the only kind of counterparty.
--
-- SCIOS signs not just with limited companies but with football CLUBS and
-- FEDERATIONS, which in most jurisdictions (Cyprus included: a "σωματείο" under
-- the Associations & Foundations Law) are registered ASSOCIATIONS / governing
-- bodies, NOT companies. Describing such a party as "a company registered under
-- the laws of …" in the contract's party clause is legally inaccurate, and these
-- entities frequently have a registration number but NO VAT number.
--
-- This column lets an admin classify the client so the party clause uses the
-- correct legal descriptor:
--   'company'    -> "a company registered under the laws of {country} …"
--   'club'       -> "an association duly registered under the laws of {country} …"
--   'federation' -> "a governing body duly registered under the laws of {country} …"
--
-- Default 'company' preserves the exact existing wording for every current
-- client, so no already-signed contract is affected (the wording lives in the
-- frozen document_snapshot anyway; this only drives newly-drafted documents).
-- ============================================================================

alter table public.clients
  add column if not exists entity_type text not null default 'company';

-- Guard against typos / unexpected values at write time.
alter table public.clients
  drop constraint if exists clients_entity_type_check;
alter table public.clients
  add constraint clients_entity_type_check
  check (entity_type in ('company', 'club', 'federation'));
