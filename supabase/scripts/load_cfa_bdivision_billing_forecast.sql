-- ============================================================================
-- CFA B-Division filming — payment schedule for season 2026/27.
--
-- Four bi-monthly invoices (Cl. 3.1: invoiced every two months in arrears on
-- the matches actually filmed), loaded as REAL scheduled receivables so they
-- behave exactly like every other row on the Receivables page: counted in
-- Outstanding and Due-now, with Send Reminder / Mark Paid, and going overdue if
-- unpaid past the due date.
--
-- DELIBERATE CHOICE, MADE BY THE BUSINESS OWNER. The amounts are PROJECTIONS
-- from the fixture calendar — the contract has no committed total and bills on
-- matches actually filmed — so the schedule will not match the real invoices
-- exactly. It is scheduled this way so the deal is managed alongside the rest of
-- the book. Adjust each row to the real figure when the invoice is raised.
-- (payments.is_estimate from migration 0025 stays false here; it remains
-- available for genuinely non-committal forecasts.)
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
-- SAFE TO RE-RUN: it removes only the four rows it created (matched on their
-- 'Invoice N — ' description prefix) and only while they are still unpaid. A row
-- you have marked paid, or any other payment you add by hand, is never touched.
--
-- RUN AS: Supabase SQL Editor.
-- ============================================================================

begin;

do $$
declare
  v_contract_id uuid;
  v_removed     integer;
  v_kept        integer;
  v_has_est     boolean;
begin
  select id into v_contract_id
  from public.contracts
  where description like '%2026-0005319-Championships-0000716%';

  if v_contract_id is null then
    raise exception 'CFA B-Division contract not found. Run record_offline_contract_cfa_bdivision.sql first.';
  end if;

  -- 0025 is optional for this script (these rows are real, not estimates), but
  -- if the column exists these rows must explicitly be non-estimates.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'is_estimate'
  ) into v_has_est;

  -- Re-run safety: remove ONLY this script's own unpaid rows. Matching on the
  -- description prefix (not on "everything for this contract") means a real
  -- invoice you entered by hand survives; excluding 'paid' means a row you have
  -- already banked can never be deleted by a careless re-run.
  delete from public.payments
  where contract_id = v_contract_id
    and description like 'Invoice %B Division 2026/27%'
    and status <> 'paid';
  get diagnostics v_removed = row_count;

  select count(*) into v_kept
  from public.payments
  where contract_id = v_contract_id;

  -- Descriptions follow the house style seen on the Receivables page
  -- ("<Client> — <Agreement> — payment due <date>"), so these rows read the same
  -- as every other scheduled payment in the book.
  insert into public.payments
    (contract_id, description, due_date, amount, vat_rate, vat_amount, total_amount,
     currency, status, notes)
  values
    (v_contract_id,
     'Invoice 1 — B Division 2026/27 filming, Sep+Oct 2026',
     date '2026-12-01', 6300.00, 19, 1197.00,  7497.00, 'EUR', 'pending',
     'Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 42 billable matches x EUR 150 (48 fixtures less 6 televised). Invoice expected 01/11/2026, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 2 — B Division 2026/27 filming, Nov+Dec 2026',
     date '2027-01-31', 7350.00, 19, 1396.50,  8746.50, 'EUR', 'pending',
     'Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 49 billable matches x EUR 150 (56 fixtures less 7 televised). Invoice expected 01/01/2027, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 3 — B Division 2026/27 filming, Jan+Feb 2027',
     date '2027-04-02', 9450.00, 19, 1795.50, 11245.50, 'EUR', 'pending',
     'Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 63 billable matches x EUR 150 (72 fixtures less 9 televised) — the peak period: Round A ends and both Round B groups begin. Invoice expected 01/03/2027, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.'),
    (v_contract_id,
     'Invoice 4 — B Division 2026/27 filming, Mar+Apr 2027',
     date '2027-05-31', 7500.00, 19, 1425.00,  8925.00, 'EUR', 'pending',
     'Bi-monthly invoice per Cl. 3.1, raised in arrears on matches actually filmed. Projected 50 billable matches x EUR 150 (56 fixtures less 6 televised). Season ends late April. Invoice expected 01/05/2027, payable within 30 days (Cl. 3.2). ADJUST to the actual match count before invoicing.');

  -- Belt and braces: if 0025 is present, make sure these four are explicitly
  -- NOT estimates, so they count as receivables regardless of column default.
  if v_has_est then
    update public.payments
    set is_estimate = false
    where contract_id = v_contract_id
      and description like 'Invoice %B Division 2026/27%';
  end if;

  raise notice 'CFA B-Division 2026/27 schedule loaded: 4 scheduled receivables, EUR 30,600 net / EUR 36,414 gross (204 projected matches). Removed % previous unpaid row(s) from this script; contract now has % payment row(s) in total.',
    v_removed, v_kept + 4;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify.
-- ---------------------------------------------------------------------------
-- Does NOT select is_estimate: this script works with or without migration
-- 0025, and naming a missing column would fail the whole verification.
select p.description, p.due_date, p.amount as net, p.vat_amount as vat,
       p.total_amount as gross, p.status
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%'
order by p.due_date;

select
  count(*)            as payment_rows,
  sum(p.amount)       as total_net,
  sum(p.vat_amount)   as total_vat,
  sum(p.total_amount) as total_gross
from public.payments p
join public.contracts c on c.id = p.contract_id
where c.description like '%2026-0005319-Championships-0000716%';
