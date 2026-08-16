-- ============================================================================
-- CFA B-Division filming — season 2027/28 payment schedule (season 2 of 2).
--
-- Completes the contract's schedule. The agreement runs TWO seasons (2026/2027
-- and 2027/2028, value EUR 61,200 net) but only season 1 was loaded, leaving the
-- deal under-scheduled by exactly one season: EUR 36,414 gross of contracted
-- billing was missing from Receivables and Outstanding.
--
--   contract value  61,200.00 net  ->  72,828.00 gross @ 19%
--   season 2026/27  36,414.00 gross  (already loaded)
--   season 2027/28  36,414.00 gross  (this script)
--                   ---------
--                   72,828.00        reconciles exactly
--
-- Same four bi-monthly windows and match counts as season 1, dates shifted one
-- year. As with season 1 these amounts are PROJECTIONS from the fixture
-- calendar — the contract bills per match actually filmed — so adjust each row
-- to the real count before invoicing. Season 2's club composition will also
-- differ after promotion/relegation, though the group sizes are fixed so the
-- totals hold.
--
-- SAFE TO RE-RUN: removes only its own unpaid rows (matched on the '2027/28'
-- description prefix) and never touches a paid row or anything entered by hand.
--
-- RUN AS: Supabase SQL Editor.
-- ============================================================================

begin;

do $$
declare
  v_contract_id uuid;
  v_removed     integer;
  v_s1_gross    numeric;
  v_total_gross numeric;
  v_value       numeric;
begin
  select id, value into v_contract_id, v_value
  from public.contracts
  where description like '%2026-0005319-Championships-0000716%';

  if v_contract_id is null then
    raise exception 'CFA B-Division contract not found. Run record_offline_contract_cfa_bdivision.sql first.';
  end if;

  -- Re-run safety, part 1: clear this script's own UNPAID rows so a re-run
  -- refreshes them. A paid row is deliberately left alone — it records real money.
  delete from public.payments
  where contract_id = v_contract_id
    and description like 'Invoice %B Division 2027/28%'
    and status <> 'paid';
  get diagnostics v_removed = row_count;

  -- Re-run safety, part 2: skip any invoice already present as PAID. Without
  -- this, a re-run after banking (say) Invoice 5 would leave the paid row AND
  -- insert a fresh pending copy — a duplicate that overstates receivables by
  -- that invoice's value. Caught by testing the re-run against a paid row.
  insert into public.payments
    (contract_id, description, due_date, amount, vat_rate, vat_amount, total_amount,
     currency, status, notes)
  select * from (values
    (v_contract_id,
     'Invoice 5 — B Division 2027/28 filming, Sep+Oct 2027',
     date '2027-12-01', 6300.00, 19, 1197.00,  7497.00, 'EUR', 'pending',
     'Season 2 of 2. Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 42 billable matches x EUR 150. Invoice expected 01/11/2027, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 6 — B Division 2027/28 filming, Nov+Dec 2027',
     date '2028-01-31', 7350.00, 19, 1396.50,  8746.50, 'EUR', 'pending',
     'Season 2 of 2. Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 49 billable matches x EUR 150. Invoice expected 01/01/2028, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 7 — B Division 2027/28 filming, Jan+Feb 2028',
     date '2028-04-02', 9450.00, 19, 1795.50, 11245.50, 'EUR', 'pending',
     'Season 2 of 2. Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 63 billable matches x EUR 150 — the peak period: Round A ends and both Round B groups begin. Invoice expected 01/03/2028, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 8 — B Division 2027/28 filming, Mar+Apr 2028',
     date '2028-05-31', 7500.00, 19, 1425.00,  8925.00, 'EUR', 'pending',
     'Season 2 of 2. Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 50 billable matches x EUR 150. Season ends late April 2028. Invoice expected 01/05/2028, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.')
  ) as v(contract_id, description, due_date, amount, vat_rate, vat_amount, total_amount, currency, status, notes)
  where not exists (
    select 1 from public.payments p
    where p.contract_id = v.contract_id
      and p.description = v.description
  );

  select coalesce(sum(total_amount), 0) into v_total_gross
  from public.payments where contract_id = v_contract_id;

  select coalesce(sum(total_amount), 0) into v_s1_gross
  from public.payments
  where contract_id = v_contract_id and description like '%2026/27%';

  raise notice 'Season 2027/28 loaded (removed % previous). Season 1: % | Season 2: % | TOTAL SCHEDULED: % vs contract value+VAT %.',
    v_removed, v_s1_gross, v_total_gross - v_s1_gross, v_total_gross, round(v_value * 1.19, 2);

  if abs(v_total_gross - v_value * 1.19) > 1 then
    raise warning 'Schedule still does not reconcile to value+VAT (diff %). Check for extra or missing rows.',
      round(v_total_gross - v_value * 1.19, 2);
  else
    raise notice 'Schedule reconciles exactly to the contract value.';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify: all eight invoices across both seasons.
-- ---------------------------------------------------------------------------
select p.description, p.due_date,
       to_char(p.amount,'FM999G990D00')       as net,
       to_char(p.total_amount,'FM999G990D00') as gross,
       p.status
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%'
order by p.due_date;

select
  count(*)                                        as rows,
  to_char(sum(p.amount),'FM999G999G990D00')       as total_net,
  to_char(sum(p.total_amount),'FM999G999G990D00') as total_gross,
  to_char(max(c.value) * 1.19,'FM999G999G990D00') as contract_value_plus_vat
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%';
