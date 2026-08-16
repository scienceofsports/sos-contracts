-- ============================================================================
-- PORTFOLIO AUDIT — single result table. Read-only, changes nothing.
--
-- Same checks as audit_portfolio_completeness.sql, but UNIONed into ONE result
-- so the Supabase SQL Editor (which only displays the last statement's output)
-- shows the whole picture at once.
--
-- Read the `section` column: PORTFOLIO lists every contract; the ISSUE rows are
-- the ones that need action.
-- ============================================================================

with money as (
  select
    p.contract_id,
    count(*)                                                        as rows,
    coalesce(sum(p.total_amount), 0)                                as gross,
    coalesce(sum(p.total_amount) filter (where p.status <> 'paid'), 0) as open_gross,
    coalesce(sum(p.total_amount) filter (where p.status <> 'paid'
             and p.due_date < current_date), 0)                     as overdue_gross
  from public.payments p
  group by p.contract_id
),
base as (
  select
    c.id, c.contract_number, c.title, c.status, c.value, c.vat_inclusive,
    c.start_date, c.end_date, c.client_id, c.attachment_url,
    cl.company_name as client,
    coalesce(m.rows, 0)          as pay_rows,
    coalesce(m.gross, 0)         as pay_gross,
    coalesce(m.open_gross, 0)    as open_gross,
    coalesce(m.overdue_gross, 0) as overdue_gross
  from public.contracts c
  left join public.clients cl on cl.id = c.client_id
  left join money m on m.contract_id = c.id
)
select * from (
  -- 1 — every contract
  select
    '1 PORTFOLIO'                                     as section,
    contract_number                                   as ref,
    coalesce(client, '(no client)')                   as client,
    status,
    to_char(coalesce(value,0), 'FM999G999G990D00')    as value_net,
    pay_rows::text                                    as pay_rows,
    to_char(open_gross, 'FM999G999G990D00')           as open_gross,
    left(coalesce(title,''), 40)                      as detail,
    1 as ord, contract_number as ord2
  from base

  union all
  -- 2 — executed but nothing scheduled
  select '2 NO SCHEDULE', contract_number, coalesce(client,'(no client)'), status,
         to_char(coalesce(value,0), 'FM999G999G990D00'), '0', '0.00',
         'EXECUTED, NO PAYMENT ROWS — invisible in Receivables',
         2, contract_number
  from base
  where status in ('signed','active') and pay_rows = 0

  union all
  -- 3 — schedule vs value + VAT (skips vat_inclusive, whose value is gross)
  select '3 RECONCILE', contract_number, coalesce(client,'(no client)'), status,
         to_char(coalesce(value,0), 'FM999G999G990D00'),
         pay_rows::text,
         to_char(pay_gross, 'FM999G999G990D00'),
         case when pay_gross < value * 1.19
              then 'UNDER by ' || to_char(value*1.19 - pay_gross, 'FM999G999G990D00')
              else 'OVER by '  || to_char(pay_gross - value*1.19, 'FM999G999G990D00') end
         || ' vs value+VAT19',
         3, contract_number
  from base
  where status in ('signed','active')
    and coalesce(vat_inclusive,false) = false
    and coalesce(value,0) > 0
    and pay_rows > 0
    and abs(pay_gross - value * 1.19) >= 1

  union all
  -- 4 — missing fields the board depends on
  select '4 GAPS', contract_number, coalesce(client,'(no client)'), status,
         to_char(coalesce(value,0), 'FM999G999G990D00'), pay_rows::text,
         to_char(open_gross, 'FM999G999G990D00'),
         trim(both ' ;' from
           case when client_id  is null then 'no client; ' else '' end ||
           case when coalesce(value,0) = 0 then 'no value; ' else '' end ||
           case when start_date is null then 'no start; ' else '' end ||
           case when end_date   is null then 'no end date; ' else '' end ||
           case when attachment_url is null and status in ('signed','active')
                then 'no signed doc; ' else '' end),
         4, contract_number
  from base
  where client_id is null or coalesce(value,0) = 0 or start_date is null
     or end_date is null
     or (attachment_url is null and status in ('signed','active'))

  union all
  -- 5 — not executed
  select '5 PIPELINE', contract_number, coalesce(client,'(no client)'), status,
         to_char(coalesce(value,0), 'FM999G999G990D00'), pay_rows::text, '0.00',
         'Not executed — excluded from Receivables & Annual Revenue',
         5, contract_number
  from base
  where status not in ('signed','active','cancelled')

  union all
  -- 6 — overdue money, worst first
  select '6 OVERDUE', contract_number, coalesce(client,'(no client)'), status,
         to_char(coalesce(value,0), 'FM999G999G990D00'), pay_rows::text,
         to_char(overdue_gross, 'FM999G999G990D00'),
         'PAST DUE — needs chasing',
         6, contract_number
  from base
  where overdue_gross > 0

  union all
  -- 7 — totals
  select '7 TOTALS', '—', '—', '—',
         to_char((select coalesce(sum(value),0) from base where status in ('signed','active')), 'FM999G999G990D00'),
         (select count(*)::text from base where status in ('signed','active')),
         to_char((select coalesce(sum(open_gross),0) from base where status in ('signed','active')), 'FM999G999G990D00'),
         'executed value net | executed count | outstanding gross',
         7, '0'
) x
order by ord, ord2;
