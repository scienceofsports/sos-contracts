-- ============================================================================
-- SOS Contracts — Initial schema (Stage 1)
--
-- Mirrors the current localStorage data model, but:
--   * payments and audit entries become real tables (were nested arrays)
--   * signer / evidence fields move OUT of contracts into evidence tables
--     (signing_requests, signature_events) so a contract row can never be
--     edited to fake a signature
--   * signature_events is append-only + hash-chained (tamper-evident)
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query),
-- or via the Supabase CLI. It is idempotent-ish: safe to run once on a fresh
-- project. RLS is enabled on every table; staff access is via authenticated
-- policies, and the public signing flow goes through Edge Functions only.
-- ============================================================================

-- Needed for gen_random_bytes / gen_random_uuid.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- COMPANY  (single logical row — "your company" profile)
-- ----------------------------------------------------------------------------
create table if not exists public.company (
  id                    uuid primary key default gen_random_uuid(),
  name                  text,
  registered_address    text,
  vat_number            text,
  registration_number   text,
  contact_email         text,
  website               text,
  bank_name             text,
  bank_iban             text,
  bank_swift            text,
  logo_url              text,             -- was base64; now Storage URL
  updated_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- APP_USERS  (staff — linked 1:1 to Supabase auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text unique not null,
  role        text not null default 'admin' check (role in ('admin','viewer')),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CLIENTS
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  address               text,
  country               text,
  vat_number            text,
  registration_number   text,
  currency              text default 'EUR',
  logo_url              text,             -- was logoBase64
  created_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CONTRACTS
-- Signer/consent/evidence fields intentionally NOT here — see signature_events.
-- ----------------------------------------------------------------------------
create table if not exists public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  contract_number       text unique not null,
  client_id             uuid references public.clients(id) on delete restrict,
  title                 text,
  type                  text,
  status                text not null default 'draft'
                          check (status in ('draft','sent','signed','active','expired','cancelled')),
  value                 numeric,
  currency              text default 'EUR',
  start_date            date,
  end_date              date,
  payment_type          text,
  payment_terms_days    integer,
  late_payment_penalty  numeric,
  governing_law         text,
  jurisdiction          text,
  description           text,
  special_terms         text,
  services              jsonb,            -- the service-builder object
  template_id           text,
  attachment_url        text,             -- was attachmentBase64
  attachment_name       text,
  version               integer not null default 1,
  version_history       jsonb not null default '[]'::jsonb,
  document_hash_before  text,             -- set on Send (full-doc hash)
  renewal_status        text,
  renewal_reminder_sent boolean not null default false,
  created_by            uuid references public.app_users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists contracts_client_id_idx on public.contracts(client_id);
create index if not exists contracts_status_idx on public.contracts(status);

-- Server-side contract-number generation (avoids client-side race).
-- SOS-C-{year}-{seq3} where seq resets per year.
create sequence if not exists public.contract_seq_2026 start 1;

create or replace function public.next_contract_number()
returns text
language plpgsql
as $$
declare
  yr    text := to_char(now(), 'YYYY');
  n     integer;
begin
  -- Count existing contracts for this year and add 1. Simple and correct for
  -- the low volume here; a per-year sequence could replace this later.
  select count(*) + 1 into n
    from public.contracts
    where contract_number like 'SOS-C-' || yr || '-%';
  return 'SOS-C-' || yr || '-' || lpad(n::text, 3, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- PAYMENTS  (was contract.payments[])
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  accounting_ref  text,
  description     text,
  due_date        date,
  amount          numeric,
  vat_rate        numeric,
  vat_amount      numeric,
  total_amount    numeric,
  currency        text default 'EUR',
  status          text not null default 'pending'
                    check (status in ('pending','paid','overdue','disputed')),
  paid_at         timestamptz,
  paid_amount     numeric,
  marked_paid_by  uuid references public.app_users(id) on delete set null,
  reminders_sent  jsonb not null default '[]'::jsonb,
  notes           text default '',
  created_at      timestamptz not null default now()
);

create index if not exists payments_contract_id_idx on public.payments(contract_id);
create index if not exists payments_status_idx on public.payments(status);

-- ----------------------------------------------------------------------------
-- SIGNING_REQUESTS  (one per "Send for signature" — the evidence anchor)
-- ----------------------------------------------------------------------------
create table if not exists public.signing_requests (
  id                    uuid primary key default gen_random_uuid(),
  contract_id           uuid not null references public.contracts(id) on delete cascade,
  token                 text unique not null default encode(gen_random_bytes(32), 'hex'),
  signer_email          text not null,
  status                text not null default 'sent'
                          check (status in ('sent','viewed','otp_sent','otp_verified','signed','expired','cancelled')),
  document_snapshot     jsonb not null,   -- frozen {contract, client, company}
  document_hash_before  text not null,    -- SHA-256 of canonical full-doc serialization
  otp_code_hash         text,             -- hashed 6-digit code (never plaintext)
  otp_sent_at           timestamptz,
  otp_attempts          integer not null default 0,
  otp_verified_at       timestamptz,
  expires_at            timestamptz not null default (now() + interval '7 days'),
  created_by            uuid references public.app_users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists signing_requests_contract_id_idx on public.signing_requests(contract_id);
create index if not exists signing_requests_token_idx on public.signing_requests(token);

-- ----------------------------------------------------------------------------
-- SIGNATURE_EVENTS  (append-only, hash-chained audit trail + the signature)
-- No UPDATE/DELETE is ever allowed (enforced by trigger + absent RLS policies).
-- ----------------------------------------------------------------------------
create table if not exists public.signature_events (
  id                    uuid primary key default gen_random_uuid(),
  contract_id           uuid references public.contracts(id) on delete cascade,
  signing_request_id    uuid references public.signing_requests(id) on delete cascade,
  event_type            text not null,    -- created|sent|viewed|otp_sent|otp_verified|signed|imported|cancelled
  message               text,
  actor_type            text,             -- 'admin' | 'signer' | 'system'
  actor_id              uuid,             -- app_user id when admin
  -- signer identity + evidence (populated on 'signed'):
  signer_name           text,
  signer_title          text,
  signer_company        text,
  signer_email          text,
  server_timestamp      timestamptz not null default now(),  -- SERVER clock
  signer_ip             inet,             -- real, from edge headers
  user_agent            text,
  signature_image_url   text,             -- Storage path of PNG
  document_hash_after   text,             -- full-doc hash at sign time
  consent_electronic    boolean,
  consent_authorized    boolean,
  consent_read          boolean,
  prev_hash             text,             -- row_hash of previous event (chain)
  row_hash              text,             -- sha256(canonical fields + prev_hash)
  created_at            timestamptz not null default now()
);

create index if not exists signature_events_contract_id_idx on public.signature_events(contract_id);
create index if not exists signature_events_request_id_idx on public.signature_events(signing_request_id);

-- Reject any UPDATE or DELETE on signature_events — append-only ledger.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'signature_events is append-only; % is not allowed', tg_op;
end;
$$;

drop trigger if exists signature_events_no_update on public.signature_events;
create trigger signature_events_no_update
  before update on public.signature_events
  for each row execute function public.forbid_mutation();

drop trigger if exists signature_events_no_delete on public.signature_events;
create trigger signature_events_no_delete
  before delete on public.signature_events
  for each row execute function public.forbid_mutation();

-- ----------------------------------------------------------------------------
-- CERTIFICATES  (pointer + hash of the generated evidence PDF)
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid references public.contracts(id) on delete cascade,
  signing_request_id  uuid references public.signing_requests(id) on delete cascade,
  pdf_url             text,
  pdf_sha256          text,
  generated_at        timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.company           enable row level security;
alter table public.app_users         enable row level security;
alter table public.clients           enable row level security;
alter table public.contracts         enable row level security;
alter table public.payments          enable row level security;
alter table public.signing_requests  enable row level security;
alter table public.signature_events  enable row level security;
alter table public.certificates      enable row level security;

-- Helper: is the current authenticated user an admin app_user?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: is the current user any staff member (admin or viewer)?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where id = auth.uid()
  );
$$;

-- app_users: a user can read their own row; admins can read all + manage.
drop policy if exists app_users_self_read on public.app_users;
create policy app_users_self_read on public.app_users
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists app_users_admin_all on public.app_users;
create policy app_users_admin_all on public.app_users
  for all using (public.is_admin()) with check (public.is_admin());

-- Staff-readable / admin-writable tables (same pattern for each).
-- company
drop policy if exists company_staff_read on public.company;
create policy company_staff_read on public.company for select using (public.is_staff());
drop policy if exists company_admin_write on public.company;
create policy company_admin_write on public.company for all using (public.is_admin()) with check (public.is_admin());

-- clients
drop policy if exists clients_staff_read on public.clients;
create policy clients_staff_read on public.clients for select using (public.is_staff());
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients for all using (public.is_admin()) with check (public.is_admin());

-- contracts
drop policy if exists contracts_staff_read on public.contracts;
create policy contracts_staff_read on public.contracts for select using (public.is_staff());
drop policy if exists contracts_admin_write on public.contracts;
create policy contracts_admin_write on public.contracts for all using (public.is_admin()) with check (public.is_admin());

-- payments
drop policy if exists payments_staff_read on public.payments;
create policy payments_staff_read on public.payments for select using (public.is_staff());
drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- signing_requests: staff read; writes happen via Edge Functions (service role,
-- which bypasses RLS). Admins may also insert/cancel from the app.
drop policy if exists signing_requests_staff_read on public.signing_requests;
create policy signing_requests_staff_read on public.signing_requests for select using (public.is_staff());
drop policy if exists signing_requests_admin_write on public.signing_requests;
create policy signing_requests_admin_write on public.signing_requests for all using (public.is_admin()) with check (public.is_admin());

-- signature_events: staff read only. Inserts come from Edge Functions
-- (service role). No UPDATE/DELETE policy exists → those are blocked for
-- everyone (and the trigger blocks them even for service role).
drop policy if exists signature_events_staff_read on public.signature_events;
create policy signature_events_staff_read on public.signature_events for select using (public.is_staff());
drop policy if exists signature_events_admin_insert on public.signature_events;
create policy signature_events_admin_insert on public.signature_events for insert with check (public.is_admin());

-- certificates: staff read; created by Edge Functions (service role).
drop policy if exists certificates_staff_read on public.certificates;
create policy certificates_staff_read on public.certificates for select using (public.is_staff());

-- NOTE: the public signer (anon, no login) is deliberately given NO policies on
-- any table. All signer-facing reads/writes go through Edge Functions using the
-- service-role key, scoped by the signing_requests.token. This keeps the
-- database sealed while still allowing public signing.

-- ============================================================================
-- STORAGE BUCKETS (all private). Create via SQL so this migration is complete.
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('signatures', 'signatures', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('contract-attachments', 'contract-attachments', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('certificates', 'certificates', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('logos', 'logos', false)
  on conflict (id) do nothing;

-- Staff can read objects in these buckets from the app; writes to signatures/
-- certificates come from Edge Functions (service role). Logos/attachments may
-- be written by admins from the app.
drop policy if exists storage_staff_read on storage.objects;
create policy storage_staff_read on storage.objects
  for select using (
    bucket_id in ('signatures','contract-attachments','certificates','logos')
    and public.is_staff()
  );

drop policy if exists storage_admin_write on storage.objects;
create policy storage_admin_write on storage.objects
  for insert with check (
    bucket_id in ('contract-attachments','logos')
    and public.is_admin()
  );

drop policy if exists storage_admin_update on storage.objects;
create policy storage_admin_update on storage.objects
  for update using (
    bucket_id in ('contract-attachments','logos')
    and public.is_admin()
  );

drop policy if exists storage_admin_delete on storage.objects;
create policy storage_admin_delete on storage.objects
  for delete using (
    bucket_id in ('contract-attachments','logos')
    and public.is_admin()
  );
