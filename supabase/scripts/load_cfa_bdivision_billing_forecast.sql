-- ============================================================================
-- CFA B-Division filming — expected billing for season 2026/27 (FORECAST).
--
-- Four bi-monthly invoices (Cl. 3.1: invoiced every two months in arrears on
-- the matches actually filmed). These rows are ESTIMATES: nothing has been
-- invoiced and the CFA has agreed no such sum, so every row carries
-- is_estimate = true (migration 0025) and is therefore EXCLUDED from
-- receivables, outstanding, due-now, overdue and aging. They appear only in the
-- forward-looking "expected billing" views.
--
-- WHERE THE NUMBERS COME FROM
-- The 2025/26 competition calendar (232 fixtures: Round A single round-robin,
-- 16 clubs x 15 matchdays = 120; plus two parallel Round B groups of 8 playing
-- a double round-robin = 56 each). 2026/27 is assumed to repeat that shape.
--
--   period      fixtures   TV     billable
--   Sep+Oct        48       6        42
--   Nov+Dec        56       7        49
--   Jan+Feb        72       9        63
--   Mar+Apr        56       6        50
--   SEASON        232      28       204   x EUR 150 = EUR 30,600 net
--
-- TV deduction = one match per MATCH-WEEK (28 distinct match-weeks in the
-- season), not one per matchday: in Round B the two groups play in parallel, so
-- a single broadcast pick covers both. 204 billable reconciles exactly with the
-- estimate already frozen on the contract (EUR 30,600/season).
--
-- Amounts follow the money model: amount = NET, total_amount = net + VAT @19%.
-- Due date = 30 days after the expected invoice date (Cl. 3.2), which is the
-- day after each period closes.
--
-- SAFE TO RE-RUN: deletes only this contract's existing ESTIMATE rows first, so
-- real invoices already entered are never touched. Re-run it to refresh the
-- forecast once the CFA supplies the real fixture list.
--
-- RUN AS: Supabase SQL Editor. Requires migration 0025 to have been applied.
-- ============================================================================

begin;

do $$
declare
  v_contract_id uuid;
  v_estimates   integer;
  v_real        integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'is_estimate'
  ) then
    raise exception 'Column payments.is_estimate is missing — apply migration 0025_payment_estimates.sql first. Without it these rows would be counted as real receivables.';
  end if;

  select id into v_contract_id
  from public.contracts
  where description like '%2026-0005319-Championships-0000716%';

  if v_contract_id is null then
    raise exception 'CFA B-Division contract not found. Run record_offline_contract_cfa_bdivision.sql first.';
  end if;

  -- Clear only previous FORECAST rows; never touch real invoices.
  delete from public.payments
  where contract_id = v_contract_id and is_estimate = true;
  get diagnostics v_estimates = row_count;

  select count(*) into v_real
  from public.payments
  where contract_id = v_contract_id and is_estimate = false;

  insert into public.payments
    (contract_id, description, due_date, amount, vat_rate, vat_amount, total_amount,
     currency, status, is_estimate, notes)
  values
    (v_contract_id,
     'Est. Invoice 1 — Sep+Oct 2026 (42 matches)',
     date '2026-12-01', 6300.00, 19, 1197.00,  7497.00, 'EUR', 'pending', true,
     'FORECAST, not invoiced. 48 fixtures less 6 televised = 42 billable x EUR 150. Invoice expected 01/11/2026, payable within 30 days.'),
    (v_contract_id,
     'Est. Invoice 2 — Nov+Dec 2026 (49 matches)',
     date '2027-01-31', 7350.00, 19, 1396.50,  8746.50, 'EUR', 'pending', true,
     'FORECAST, not invoiced. 56 fixtures less 7 televised = 49 billable x EUR 150. Invoice expected 01/01/2027, payable within 30 days.'),
    (v_contract_id,
     'Est. Invoice 3 — Jan+Feb 2027 (63 matches)',
     date '2027-04-02', 9450.00, 19, 1795.50, 11245.50, 'EUR', 'pending', true,
     'FORECAST, not invoiced. 72 fixtures less 9 televised = 63 billable x EUR 150 — the peak period: Round A ends and both Round B groups begin. Invoice expected 01/03/2027, payable within 30 days.'),
    (v_contract_id,
     'Est. Invoice 4 — Mar+Apr 2027 (50 matches)',
     date '2027-05-31', 7500.00, 19, 1425.00,  8925.00, 'EUR', 'pending', true,
     'FORECAST, not invoiced. 56 fixtures less 6 televised = 50 billable x EUR 150. Season ends late April. Invoice expected 01/05/2027, payable within 30 days.');

  raise notice 'CFA B-Division forecast loaded: 4 estimate rows, EUR 30,600 net / EUR 36,414 gross (204 matches). Replaced % previous estimate row(s); left % real payment row(s) untouched.',
    v_estimates, v_real;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify.
-- ---------------------------------------------------------------------------
select p.description, p.due_date, p.amount as net, p.vat_amount as vat,
       p.total_amount as gross, p.status, p.is_estimate
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%'
order by p.due_date;

select
  count(*)                                          as rows,
  sum(p.amount)      filter (where p.is_estimate)   as forecast_net,
  sum(p.total_amount) filter (where p.is_estimate)  as forecast_gross,
  coalesce(sum(p.total_amount) filter (where not p.is_estimate), 0) as real_receivable
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%';
