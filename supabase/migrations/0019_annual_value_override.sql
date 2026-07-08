-- ============================================================================
-- Optional per-contract ANNUAL VALUE OVERRIDE (a display / reporting figure).
--
-- The dashboard's "Annual Revenue (run-rate)" annualises each active contract as
-- value ÷ term-in-years (see annualisedValue() in the app). For a clean yearly
-- deal whose start/end dates don't land on a whole number of 365-day years, that
-- division produces an "odd" figure. Example: a €164,500 CFA deal that is really
-- €47,000/yr over 3.5 seasons runs 07/01/2026–30/06/2029 = 1,270 days = 3.48 yrs,
-- so the run-rate reads €47,277.56 instead of the intended €47,000.
--
-- This column lets an admin pin the reported annual figure to the real agreed
-- per-year amount. It is DISPLAY-ONLY: it changes reporting/run-rate views, NOT
-- the legal contract. The signed value, start_date, end_date and services are
-- untouched — the total contracted money and every payment schedule stay exactly
-- as executed. NULL (the default) keeps the automatic value ÷ term behaviour.
--
-- IMPORTANT: this column is DELIBERATELY NOT added to the frozen-columns list in
-- migration 0017's block_signed_contract_edit() trigger. Because it is a
-- reporting adjustment and not a term of the agreement, it MUST remain writable
-- on an already-signed/active contract — that is the whole point (the CFA
-- contract is already active). Editing it does not alter the document, its hash,
-- or any evidence, so it is not a tamper concern.
-- ============================================================================

alter table public.contracts
  add column if not exists annual_value_override numeric null;
