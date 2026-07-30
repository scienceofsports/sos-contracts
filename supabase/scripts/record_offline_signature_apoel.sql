-- ============================================================================
-- Record the APOEL wet-ink (offline) signature — SOS-C-2026-004
--
-- APOEL printed the sent contract, signed it by hand (CFO/General Manager,
-- club stamp, dated 30/07/2026) and returned a scanned PDF by email. There is
-- therefore NO platform e-signature: no OTP identity check, no signer IP, no
-- drawn signature image, no click-through consents.
--
-- We record that HONESTLY rather than simulating an e-signature:
--   * event_type = 'imported'  (reserved for exactly this in 0001)
--   * signer identity + the date they signed ARE recorded
--   * signer_ip / consent_* / signature_image_url stay NULL because those
--     events did not happen. Writing false values into a tamper-evident
--     ledger would devalue the evidence of every OTHER contract in it.
--   * the scanned PDF is the evidence artefact (contracts.attachment_url),
--     which migration 0017 deliberately leaves writable after signing.
--
-- The row_hash is computed EXACTLY as supabase/functions/_shared/audit.ts +
-- evidence.ts do it, so this event chains into the same ledger:
--     row_hash = sha256_hex( coalesce(prev_hash,'') || '::' || canonical_json )
-- where canonical_json is JSON.stringify() over the material fields with keys
-- sorted deep — compact separators, no whitespace.
--
-- RUN AS: Supabase SQL Editor (service role). Required — the 0017 trigger and
-- the append-only ledger block this from the app/anon path by design.
-- Wrapped in a transaction: it either lands completely or not at all.
-- ============================================================================

begin;

-- digest() lives in pgcrypto (already present on Supabase, but be explicit).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Canonical JSON encoder matching JavaScript's JSON.stringify + sortKeysDeep.
--
-- Do NOT be tempted to use `payload::text` here. Postgres jsonb differs from
-- JSON.stringify in two ways that would BOTH corrupt the hash:
--   1. jsonb::text inserts spaces after ':' and ',';  JSON.stringify does not.
--   2. jsonb orders keys by LENGTH first, then bytewise — not alphabetically.
-- Either difference yields a row_hash that silently fails future chain
-- verification. This encoder emits keys sorted with the "C" collation (plain
-- bytewise = JS's Array.sort on ASCII keys) and compact separators, and routes
-- strings through to_json() so quotes/backslashes/Unicode escape identically.
--
-- Verified against the JS implementation on the real material object: both the
-- chain-start (prev = null) and chained (prev = <hash>) cases produce the same
-- SHA-256 as supabase/functions/_shared/audit.ts.
--
-- The material object is flat and scalar-only, so a one-level encoder suffices
-- (sortKeysDeep's recursion is never exercised).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.canonical_json(payload jsonb)
returns text language sql immutable as $$
  select '{' || coalesce(string_agg(
           to_json(kv.key)::text || ':' ||
           case when jsonb_typeof(kv.value) = 'string'
                then to_json(kv.value #>> '{}')::text  -- re-escape exactly as JS
                else kv.value::text                    -- null / bool / number
           end,
           ',' order by kv.key collate "C"), '') || '}'
  from jsonb_each(payload) kv;
$$;

create or replace function pg_temp.compute_row_hash(material jsonb, prev text)
returns text language sql immutable as $$
  select encode(
    digest(coalesce(prev, '') || '::' || pg_temp.canonical_json(material), 'sha256'),
    'hex'
  );
$$;

do $$
declare
  v_contract_id   uuid;
  v_request_id    uuid;
  v_status        text;
  v_prev_hash     text;
  v_material      jsonb;
  v_row_hash      text;
  v_signed_at     timestamptz := timestamptz '2026-07-30 12:00:00+03';  -- date on the wet signature
  v_admin_id      uuid;
begin
  -- Locate the contract by its number (stable, human-verifiable identifier).
  select id, status into v_contract_id, v_status
  from public.contracts
  where contract_number = 'SOS-C-2026-004';

  if v_contract_id is null then
    raise exception 'Contract SOS-C-2026-004 not found — check the contract number before running.';
  end if;

  if v_status in ('signed', 'active') then
    raise exception 'Contract SOS-C-2026-004 is already %; nothing to do (this script is not idempotent by design).', v_status;
  end if;

  -- Most recent signing request for this contract, if one was ever sent. There
  -- may be none (if the PDF was mailed manually) — that is fine, the event then
  -- carries a NULL signing_request_id.
  select id into v_request_id
  from public.signing_requests
  where contract_id = v_contract_id
  order by created_at desc
  limit 1;

  -- The admin recording this (you). Falls back to NULL if no match.
  select id into v_admin_id
  from public.app_users
  where lower(email) = 'cc@scienceofsports.net'
  limit 1;

  -- Chain tip: the row_hash of the newest existing event for this contract.
  select row_hash into v_prev_hash
  from public.signature_events
  where contract_id = v_contract_id
  order by created_at desc
  limit 1;

  -- Material fields, in the SAME shape audit.ts hashes. Every key present,
  -- absent evidence explicitly null. jsonb_build_object keeps nulls as `null`.
  v_material := jsonb_build_object(
    'contract_id',                 v_contract_id,
    'signing_request_id',          v_request_id,
    'event_type',                  'imported',
    'message',                     'Signed offline (wet ink). APOEL printed the sent agreement, signed by hand under company stamp and returned a scanned PDF by email on 30/07/2026. Recorded by SOS admin; the scanned countersigned PDF is filed as the evidence artefact on this contract. No platform e-signature took place: no OTP identity verification, no signer IP capture, no drawn signature image and no click-through consents — those fields are intentionally null.',
    'actor_type',                  'admin',
    'actor_id',                    v_admin_id,
    'signer_name',                 'Iacovos Onisiforou',
    'signer_title',                'CFO / General Manager',
    'signer_company',              'APOEL',
    'signer_email',                null,
    'signer_ip',                   null,
    'user_agent',                  null,
    'signature_image_url',         null,
    'document_hash_after',         null,
    'consent_electronic',          null,
    'consent_authorized',          null,
    'consent_read',                null,
    'signer_on_behalf',            null,
    'representative_company',      null,
    'representative_registration', null,
    'signer_authority_basis',      null
  );

  v_row_hash := pg_temp.compute_row_hash(v_material, v_prev_hash);

  insert into public.signature_events (
    contract_id, signing_request_id, event_type, message,
    actor_type, actor_id,
    signer_name, signer_title, signer_company, signer_email,
    server_timestamp, signer_ip, user_agent, signature_image_url,
    document_hash_after, consent_electronic, consent_authorized, consent_read,
    prev_hash, row_hash
  -- Every value is read back OUT of v_material — the object that was hashed —
  -- rather than repeated as a literal. If the two ever drifted (e.g. correcting
  -- the signer's name in one place only), the stored row would no longer match
  -- its own row_hash and the chain would fail verification with no visible
  -- symptom today. Sourcing both from one object makes that impossible.
  ) values (
    v_contract_id, v_request_id, 'imported',
    v_material ->> 'message',
    v_material ->> 'actor_type', v_admin_id,
    v_material ->> 'signer_name', v_material ->> 'signer_title',
    v_material ->> 'signer_company', v_material ->> 'signer_email',
    v_signed_at, null, null, null,
    null, null, null, null,
    v_prev_hash, v_row_hash
  );

  -- Execute the contract. start_date 23/07/2026 has already passed, so it goes
  -- straight to 'active'. This UPDATE touches only status (0017 permits it even
  -- post-signature; here the row is still pre-signature anyway).
  update public.contracts
  set status = 'active'
  where id = v_contract_id;

  -- Close out any open signing request so the signing link cannot still be used.
  if v_request_id is not null then
    update public.signing_requests
    set status = 'signed'
    where id = v_request_id
      and status not in ('signed', 'cancelled', 'expired');
  end if;

  -- -------------------------------------------------------------------------
  -- Payment schedule — the three instalments printed in the signed contract.
  --
  -- The contract states instalments INCL. VAT (8,000 + 8,000 + 7,800 = 23,800).
  -- The money model stores amount = NET and total_amount = net + VAT, so net is
  -- backed out at 19%. 8,000/1.19 = 6,722.689... twice and 7,800/1.19 =
  -- 6,554.621..., which round to a net sum of 19,999.99 — one cent short of the
  -- 20,000.00 contract value. The stray cent is placed on the FINAL instalment
  -- so the schedule reconciles exactly to the contract value while every
  -- instalment's gross total still matches the figure APOEL signed.
  --
  -- Only inserted if no payments exist yet, so re-running cannot duplicate them.
  -- -------------------------------------------------------------------------
  if not exists (select 1 from public.payments where contract_id = v_contract_id) then
    insert into public.payments
      (contract_id, description, due_date, amount, vat_rate, vat_amount, total_amount, currency, status)
    values
      (v_contract_id, 'Instalment 1', date '2026-10-01', 6722.69, 19, 1277.31, 8000.00, 'EUR', 'pending'),
      (v_contract_id, 'Instalment 2', date '2026-12-01', 6722.69, 19, 1277.31, 8000.00, 'EUR', 'pending'),
      (v_contract_id, 'Instalment 3', date '2027-04-01', 6554.62, 19, 1245.38, 7800.00, 'EUR', 'pending');
  else
    raise notice 'Payments already exist for this contract — schedule left untouched.';
  end if;

  raise notice 'APOEL SOS-C-2026-004 recorded as active. event prev_hash=% row_hash=%',
    coalesce(v_prev_hash, '(chain start)'), v_row_hash;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify: contract state + the full event chain in order.
-- ---------------------------------------------------------------------------
select contract_number, status, value, start_date, end_date, attachment_name
from public.contracts
where contract_number = 'SOS-C-2026-004';

select event_type, signer_name, signer_title, server_timestamp,
       signer_ip, consent_electronic,
       left(prev_hash, 12) as prev, left(row_hash, 12) as row
from public.signature_events
where contract_id = (select id from public.contracts where contract_number = 'SOS-C-2026-004')
order by created_at;
