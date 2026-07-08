-- ============================================================================
-- Per-contract "value includes VAT" flag.
--
-- When a client objects to VAT being added on top (e.g. a non-VAT-registered
-- grassroots club that can't reclaim it), SOS may agree an all-in price. This
-- flag records that the contract's value is VAT-INCLUSIVE: the net + VAT are
-- backed OUT of the agreed figure (net = value ÷ 1.19) rather than VAT added on
-- top. VAT is still charged and remitted — this is a pricing presentation, not
-- a VAT exemption. Defaults false (the standard VAT-on-top behaviour).
-- ============================================================================

alter table public.contracts
  add column if not exists vat_inclusive boolean not null default false;
