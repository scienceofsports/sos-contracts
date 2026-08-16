-- ============================================================================
-- Forecast (estimated) payment rows — planned billing that is NOT money owed.
--
-- WHY THIS COLUMN EXISTS
-- Some agreements have no fixed instalment plan: the CFA B-Division filming
-- contract is billed every two months in arrears on the matches ACTUALLY
-- filmed, at EUR 150 per match. The expected billing can be forecast from the
-- fixture calendar, and seeing that forecast on the dashboard is genuinely
-- useful — but it is not a receivable. Nothing has been invoiced, the CFA has
-- agreed no such sum, and the real amount will differ.
--
-- Without this flag, a forecast row is indistinguishable from a real one and
-- flows straight into Outstanding, Due-now and Overdue — asserting the client
-- owes money they do not, and turning "overdue" on a date that means nothing.
-- That breaks the house rule that money-owed figures are real money owed.
--
-- SEMANTICS
--   is_estimate = false (default)  a real scheduled payment; counts as a
--                                  receivable exactly as before.
--   is_estimate = true             a forecast. Shown in forward-looking views
--                                  (pipeline / expected billing), EXCLUDED from
--                                  receivables, outstanding, due-now, overdue
--                                  and aging. Cannot be 'overdue': a forecast
--                                  has no due date anyone agreed to.
--
-- Marking a row paid means it really happened, so clearing the flag at that
-- point is correct — the trigger below does it, which keeps collected/income
-- figures honest without any UI having to remember.
-- ============================================================================

alter table public.payments
  add column if not exists is_estimate boolean not null default false;

comment on column public.payments.is_estimate is
  'true = forecast/planned billing, NOT a receivable. Excluded from outstanding, due-now, overdue and aging. Cleared automatically when the row is marked paid.';

-- Index the common filter (receivable rows are the non-estimates).
create index if not exists payments_is_estimate_idx
  on public.payments(is_estimate)
  where is_estimate = true;

-- ---------------------------------------------------------------------------
-- A paid row is by definition no longer a forecast: real money arrived, and it
-- must appear in collected/income figures. Enforce that in the DB so it cannot
-- drift depending on which code path marked it paid.
-- ---------------------------------------------------------------------------
create or replace function public.clear_estimate_on_payment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and new.is_estimate then
    new.is_estimate := false;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_clear_estimate on public.payments;
create trigger payments_clear_estimate
  before insert or update on public.payments
  for each row execute function public.clear_estimate_on_payment();
