-- ============================================================================
-- PORTFOLIO AUDIT — read-only. Changes nothing.
--
-- Answers: is every signed CFA/club agreement actually in the platform, and is
-- each one complete enough for the Dashboard, Contracts and Receivables views
-- to report it correctly?
--
-- The app's money and status logic depends on specific fields being present:
--   * status 'signed'/'active'  -> the ONLY statuses that create a receivable
--                                  (isReceivableContract). A deal left on
--                                  'draft'/'sent' contributes nothing anywhere.
--   * value + start/end dates   -> drive Annual Revenue (annualisedValue =
--                                  value / term years, or annual_value_override)
--   * payment rows              -> drive Receivables, Outstanding, Due-now,
--                                  Overdue and the aging buckets
--   * client_id                 -> drives per-client rollups
--
-- So a contract can be "in the system" and still be invisible on the board.
-- Each section below isolates one way that happens.
--
-- RUN AS: Supabase SQL Editor. Safe to run any time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE WHOLE PORTFOLIO, one row per contract.
--    payments_total should broadly match value+VAT for a fully scheduled deal.
-- ---------------------------------------------------------------------------
select
  c.contract_number                                as number,
  cl.company_name                                  as client,
  left(c.title, 46)                                as title,
  c.status,
  c.value                                          as value_net,
  c.annual_value_override                          as annual_override,
  c.start_date,
  c.end_date,
  count(p.id)                                      as payment_rows,
  coalesce(sum(p.total_amount), 0)                 as payments_gross,
  coalesce(sum(p.total_amount) filter (where p.status = 'paid'), 0)     as paid_gross,
  coalesce(sum(p.total_amount) filter (where p.status <> 'paid'), 0)    as open_gross,
  (c.attachment_url is not null)                   as has_signed_doc
from public.contracts c
left join public.clients  cl on cl.id = c.client_id
left join public.payments p  on p.contract_id = c.id
group by c.id, cl.company_name
order by
  case c.status when 'active' then 1 when 'signed' then 2 when 'sent' then 3
                when 'draft' then 4 else 5 end,
  c.contract_number;

-- ---------------------------------------------------------------------------
-- 2. EXECUTED BUT NO MONEY SCHEDULED.
--    These appear in Contracts and in Annual Revenue, but contribute NOTHING to
--    Receivables / Outstanding / Due-now — the most likely reason a real signed
--    deal looks "missing" from the money views.
-- ---------------------------------------------------------------------------
select
  c.contract_number, cl.company_name as client, c.status, c.value,
  'EXECUTED WITH NO PAYMENT ROWS — invisible in Receivables' as issue
from public.contracts c
left join public.clients cl on cl.id = c.client_id
where c.status in ('signed', 'active')
  and not exists (select 1 from public.payments p where p.contract_id = c.id)
order by c.contract_number;

-- ---------------------------------------------------------------------------
-- 3. SCHEDULE DOES NOT RECONCILE TO CONTRACT VALUE.
--    Compares the sum of payment rows against value + VAT. A gap means either
--    an unscheduled remainder (money you will never chase) or over-scheduling.
--    VAT assumed 19% unless the rows say otherwise; vat_inclusive deals are
--    flagged rather than judged, since their value is already gross.
-- ---------------------------------------------------------------------------
select
  c.contract_number, cl.company_name as client, c.status,
  c.value                                    as value_net,
  c.vat_inclusive,
  round(c.value * 1.19, 2)                   as expected_gross_at_19,
  coalesce(sum(p.total_amount), 0)           as scheduled_gross,
  round(coalesce(sum(p.total_amount), 0) - (c.value * 1.19), 2) as difference,
  case
    when c.vat_inclusive then 'VAT-inclusive deal — compare against value itself, not value x 1.19'
    when abs(coalesce(sum(p.total_amount), 0) - (c.value * 1.19)) < 1 then 'reconciles'
    when coalesce(sum(p.total_amount), 0) = 0 then 'nothing scheduled'
    when coalesce(sum(p.total_amount), 0) < (c.value * 1.19) then 'UNDER-scheduled — money not on the books'
    else 'OVER-scheduled — receivables overstated'
  end as verdict
from public.contracts c
left join public.clients cl on cl.id = c.client_id
left join public.payments p on p.contract_id = c.id
where c.status in ('signed', 'active')
group by c.id, cl.company_name
order by abs(coalesce(sum(p.total_amount), 0) - (c.value * 1.19)) desc;

-- ---------------------------------------------------------------------------
-- 4. FIELDS THE DASHBOARD NEEDS, MISSING.
--    Each of these silently degrades a specific figure rather than erroring.
-- ---------------------------------------------------------------------------
select
  c.contract_number, cl.company_name as client, c.status,
  case when c.client_id  is null then 'no client — drops out of per-client rollups; '   else '' end ||
  case when c.value      is null or c.value = 0 then 'no value — contributes 0 to Annual Revenue; ' else '' end ||
  case when c.start_date is null then 'no start date; ' else '' end ||
  case when c.end_date   is null then 'no end date — term years defaults, distorting annualised value; ' else '' end ||
  case when c.attachment_url is null and c.status in ('signed','active')
       then 'no signed document attached; ' else '' end
    as gaps
from public.contracts c
left join public.clients cl on cl.id = c.client_id
where c.client_id is null
   or c.value is null or c.value = 0
   or c.start_date is null
   or c.end_date is null
   or (c.attachment_url is null and c.status in ('signed','active'))
order by c.contract_number;

-- ---------------------------------------------------------------------------
-- 5. STUCK IN DRAFT/SENT.
--    If any of these are in fact agreed, they are missing from every money
--    figure on the board until their status is corrected.
-- ---------------------------------------------------------------------------
select
  c.contract_number, cl.company_name as client, c.status, c.value,
  c.created_at::date as created,
  (select max(se.server_timestamp)::date
     from public.signature_events se where se.contract_id = c.id) as last_event,
  'Not executed — excluded from Receivables and Annual Revenue' as note
from public.contracts c
left join public.clients cl on cl.id = c.client_id
where c.status not in ('signed', 'active', 'cancelled')
order by c.created_at;

-- ---------------------------------------------------------------------------
-- 6. CLIENT-LEVEL ROLLUP — what each client shows on the Clients page.
-- ---------------------------------------------------------------------------
select
  cl.company_name                                                as client,
  cl.entity_type,
  count(distinct c.id)                                           as contracts,
  count(distinct c.id) filter (where c.status in ('signed','active')) as executed,
  coalesce(sum(c.value) filter (where c.status in ('signed','active')), 0) as executed_value_net,
  coalesce((select sum(p.total_amount) from public.payments p
            join public.contracts c2 on c2.id = p.contract_id
            where c2.client_id = cl.id and c2.status in ('signed','active')
              and p.status <> 'paid'), 0)                        as open_gross
from public.clients cl
left join public.contracts c on c.client_id = cl.id
group by cl.id
order by executed_value_net desc nulls last;

-- ---------------------------------------------------------------------------
-- 7. BOARD TOTALS — what the Dashboard hero cards should be showing.
--    Compare these against the app; a mismatch means a front-end bug rather
--    than missing data.
-- ---------------------------------------------------------------------------
select
  count(*) filter (where status = 'active')                          as active_contracts,
  count(*) filter (where status = 'signed')                          as signed_not_started,
  count(*) filter (where status in ('draft','sent'))                 as in_pipeline,
  coalesce(sum(value) filter (where status in ('signed','active')), 0) as executed_value_net,
  (select coalesce(sum(p.total_amount), 0)
     from public.payments p join public.contracts c on c.id = p.contract_id
     where c.status in ('signed','active') and p.status <> 'paid')   as outstanding_gross,
  (select coalesce(sum(p.total_amount), 0)
     from public.payments p join public.contracts c on c.id = p.contract_id
     where c.status in ('signed','active') and p.status <> 'paid'
       and p.due_date < current_date)                                as overdue_gross,
  (select coalesce(sum(p.paid_amount), 0)
     from public.payments p
     where p.status = 'paid'
       and extract(year from p.paid_at) = extract(year from current_date)) as collected_ytd_gross
from public.contracts;
