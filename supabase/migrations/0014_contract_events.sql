-- ============================================================================
-- 0014_contract_events
--
-- A commercial / operational activity log for contracts, SEPARATE from the
-- tamper-evident signature_events ledger. signature_events is append-only and
-- reserved for signing evidence (identity, IP, consents, hashes); writing
-- routine operational events there would pollute the evidence record.
--
-- contract_events captures staff actions that are useful history but NOT legal
-- evidence: a payment marked paid, an invoice reference set, a client detail
-- corrected, a status change. Staff can insert + read; nobody updates/deletes
-- (kept as a faithful log, though not hash-chained like signature_events).
-- ============================================================================

create table if not exists public.contract_events (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  event_type   text,                                  -- 'payment' | 'client_update' | 'status' | 'note' | …
  message      text,
  actor_id     uuid references public.app_users(id) on delete set null,
  actor_type   text default 'admin',                  -- 'admin' | 'system'
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists contract_events_contract_id_idx on public.contract_events(contract_id);

alter table public.contract_events enable row level security;

-- Staff (admin or member) may read; any authenticated staff may append.
drop policy if exists contract_events_staff_read on public.contract_events;
create policy contract_events_staff_read on public.contract_events
  for select using (public.is_staff());

drop policy if exists contract_events_staff_insert on public.contract_events;
create policy contract_events_staff_insert on public.contract_events
  for insert with check (public.is_staff());

-- No updates or deletes: keep the operational log faithful.
create or replace function public.contract_events_no_mutate()
returns trigger language plpgsql as $$
begin
  raise exception 'contract_events is append-only; % is not allowed', tg_op;
end;
$$;

drop trigger if exists contract_events_no_update on public.contract_events;
create trigger contract_events_no_update
  before update on public.contract_events
  for each row execute function public.contract_events_no_mutate();

drop trigger if exists contract_events_no_delete on public.contract_events;
create trigger contract_events_no_delete
  before delete on public.contract_events
  for each row execute function public.contract_events_no_mutate();
