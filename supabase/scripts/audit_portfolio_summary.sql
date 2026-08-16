-- ============================================================================
-- PORTFOLIO AUDIT — compact summary. Read-only.
--
-- Collapses the full audit to ONE row per issue type plus the affected contract
-- refs, so the whole answer fits on screen without scrolling. Use this when the
-- full listing (audit_portfolio_oneshot.sql) is too long to read comfortably.
--
-- A count of 0 with '— none —' means that check found nothing wrong.
-- ============================================================================

with money as (
  select
    p.contract_id,
    count(*)                                                           as rows,
    coalesce(sum(p.total_amount), 0)                                   as gross,
    coalesce(sum(p.total_amount) filter (where p.status <> 'paid'), 0) as open_gross,
    coalesce(sum(p.total_amount) filter (where p.status <> 'paid'
             and p.due_date < current_date), 0)                        as overdue_gross
  from public.payments p
  group by p.contract_id
),
base as (
  select
    c.id, c.contract_number, c.status, c.value, c.vat_inclusive,
    c.start_date, c.end_date, c.client_id, c.attachment_url,
    cl.company_name as client,
    coalesce(m.rows,0) as pay_rows, coalesce(m.gross,0) as pay_gross,
    coalesce(m.open_gross,0) as open_gross, coalesce(m.overdue_gross,0) as overdue_gross
  from public.contracts c
  left join public.clients cl on cl.id = c.client_id
  left join money m on m.contract_id = c.id
),
checks as (
  select 1 as ord, 'Executed contracts' as "check",
         count(*)::text as count,
         to_char(coalesce(sum(value),0),'FM999G999G990D00') || ' EUR net' as amount,
         'the live portfolio' as note
  from base where status in ('signed','active')

  union all
  select 2, 'EXECUTED, NO PAYMENT ROWS', count(*)::text,
         to_char(coalesce(sum(value),0),'FM999G999G990D00') || ' EUR unscheduled',
         coalesce(string_agg(contract_number || ' (' || coalesce(client,'?') || ')', ', '
                  order by contract_number), '— none —')
  from base where status in ('signed','active') and pay_rows = 0

  union all
  select 3, 'SCHEDULE <> VALUE+VAT', count(*)::text,
         to_char(coalesce(sum(pay_gross - value*1.19),0),'FM999G999G990D00') || ' EUR net diff',
         coalesce(string_agg(contract_number || ' (' ||
                  case when pay_gross < value*1.19 then 'under ' else 'over ' end ||
                  to_char(abs(pay_gross - value*1.19),'FM999G999G990D00') || ')', ', '
                  order by contract_number), '— none —')
  from base
  where status in ('signed','active') and coalesce(vat_inclusive,false) = false
    and coalesce(value,0) > 0 and pay_rows > 0
    and abs(pay_gross - value*1.19) >= 1

  union all
  select 4, 'MISSING DATES / VALUE / CLIENT', count(*)::text, '',
         coalesce(string_agg(contract_number || ' (' ||
           trim(both ' ;' from
             case when client_id is null then 'no client; ' else '' end ||
             case when coalesce(value,0)=0 then 'no value; ' else '' end ||
             case when start_date is null then 'no start; ' else '' end ||
             case when end_date is null then 'no end; ' else '' end) || ')', ', '
           order by contract_number), '— none —')
  from base
  where client_id is null or coalesce(value,0)=0 or start_date is null or end_date is null

  union all
  select 5, 'EXECUTED, NO SIGNED DOC ATTACHED', count(*)::text, '',
         coalesce(string_agg(contract_number || ' (' || coalesce(client,'?') || ')', ', '
                  order by contract_number), '— none —')
  from base
  where status in ('signed','active') and attachment_url is null

  union all
  select 6, 'NOT EXECUTED (draft/sent)', count(*)::text,
         to_char(coalesce(sum(value),0),'FM999G999G990D00') || ' EUR in pipeline',
         coalesce(string_agg(contract_number || ' ' || status || ' (' || coalesce(client,'?') || ')', ', '
                  order by contract_number), '— none —')
  from base where status not in ('signed','active','cancelled')

  union all
  select 7, 'OVERDUE MONEY', count(*)::text,
         to_char(coalesce(sum(overdue_gross),0),'FM999G999G990D00') || ' EUR gross',
         coalesce(string_agg(coalesce(client,'?') || ' ' ||
                  to_char(overdue_gross,'FM999G999G990D00'), ', '
                  order by overdue_gross desc), '— none —')
  from base where overdue_gross > 0

  union all
  select 8, 'TOTAL OUTSTANDING (gross)', '',
         to_char(coalesce(sum(open_gross),0),'FM999G999G990D00') || ' EUR',
         'all unpaid rows on executed contracts'
  from base where status in ('signed','active')
)
select "check", count, amount, note from checks order by ord;

-- ---------------------------------------------------------------------------
-- Who owes the overdue money, line by line.
-- ---------------------------------------------------------------------------
select
  cl.company_name                                as client,
  c.contract_number                              as ref,
  p.description,
  p.due_date,
  (current_date - p.due_date)                    as days_late,
  to_char(p.total_amount,'FM999G999G990D00')     as gross_eur
from public.payments p
join public.contracts c on c.id = p.contract_id
left join public.clients cl on cl.id = c.client_id
where c.status in ('signed','active')
  and p.status <> 'paid'
  and p.due_date < current_date
order by p.due_date;
