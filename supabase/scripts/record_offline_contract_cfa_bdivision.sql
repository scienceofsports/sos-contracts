-- ============================================================================
-- Import the CFA B-Division filming agreement — signed entirely OFF-platform.
--
-- Technical Filming Services Agreement, Pancyprian Second Division (Β΄ Κατηγορίας),
-- seasons 2026/2027 & 2027/2028, dated 11 August 2026 (Ref.
-- 2026-0005319-Championships-0000716). SCIOS has signed; the CFA returns the
-- fully countersigned copy separately. The agreement is in place.
--
-- This differs from record_offline_signature_apoel.sql: APOEL's contract had
-- been drafted and SENT through the platform, so only the signature event was
-- missing. This one was never in the platform at all — it was drafted, printed
-- and signed outside it. So the script CREATES the contract row too, and there
-- is deliberately NO signing_request: no document_snapshot was ever frozen, no
-- signing link ever existed. signature_events.signing_request_id stays NULL,
-- which the schema permits (the column is nullable).
--
-- Recorded HONESTLY, exactly as the APOEL import was:
--   * event_type = 'imported' — how a wet-ink signature enters the ledger.
--   * signer identity + the date signed ARE recorded.
--   * signer_ip / consent_* / signature_image_url stay NULL, because no OTP
--     check, no IP capture, no drawn signature and no click-through consents
--     ever happened. Writing false values into a tamper-evident ledger would
--     devalue the evidence of every OTHER contract in it.
--   * document_hash_after stays NULL: the platform never rendered or hashed
--     this document, so there is no full-document hash to bind it to. The PDF
--     itself (attachment_url) is the evidence artefact.
--
-- The row_hash is computed EXACTLY as supabase/functions/_shared/audit.ts +
-- evidence.ts do it, so this event chains into the same ledger:
--     row_hash = sha256_hex( coalesce(prev_hash,'') || '::' || canonical_json )
--
-- ORDER MATTERS. Migration 0017 freezes every legal column (title, value,
-- dates, description, special_terms, services, …) the moment status becomes
-- 'signed'/'active'. So the contract is INSERTed complete and correct while
-- still 'draft', and only then flipped to 'active'. After that, correcting a
-- typo needs the service-role key. Read section 3 before running.
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
-- Identical to the encoder in record_offline_signature_apoel.sql, which was
-- verified against the JS implementation for both the chain-start (prev = null)
-- and chained (prev = <hash>) cases.
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

-- ---------------------------------------------------------------------------
-- SELF-CHECK: prove this encoder matches JavaScript BEFORE writing anything.
--
-- A wrong encoder does not fail loudly — it writes a row whose row_hash simply
-- cannot be reproduced later, which only surfaces when someone verifies the
-- chain (in front of a counterparty, at the worst moment). So we pin it to a
-- known-good vector instead of trusting it.
--
-- The expected hashes below were produced by the real JS implementation
-- (JSON.stringify(sortKeysDeep(material)) then sha256 of `prev + '::' + json`,
-- exactly as _shared/evidence.ts computeRowHash does) over a material object
-- carrying the characters most likely to break escaping: Greek ("Β΄ Κατηγορίας"),
-- an em-dash, apostrophes, double quotes and a backslash. Both the chain-start
-- (prev = null) and chained (prev = 64×'a') cases are checked.
--
-- If this raises, STOP — do not work around it. The encoder and JS have
-- diverged and any event written would be unverifiable.
-- ---------------------------------------------------------------------------
do $$
declare
  v_vector   jsonb := jsonb_build_object(
    'contract_id',                 '11111111-2222-3333-4444-555555555555',
    'signing_request_id',          null,
    'event_type',                  'imported',
    'message',                     'Signed offline (wet ink). Β΄ Κατηγορίας — CFA''s TV partner; 14 days'' notice. "quoted" \ backslash',
    'actor_type',                  'admin',
    'actor_id',                    '66666666-7777-8888-9999-000000000000',
    'signer_name',                 'Constantinos Charalambides',
    'signer_title',                'Chief Executive Officer',
    'signer_company',              'C.C. Science of Sports Ltd',
    'signer_email',                'cc@scienceofsports.net',
    'signer_ip',                   null,
    'user_agent',                  null,
    'signature_image_url',         null,
    'document_hash_after',         null,
    'consent_electronic',          null,
    'consent_authorized',          null,
    'consent_read',                null,
    'signer_on_behalf',            false,
    'representative_company',      null,
    'representative_registration', null,
    'signer_authority_basis',      null
  );
  v_got_start   text;
  v_got_chained text;
begin
  v_got_start   := pg_temp.compute_row_hash(v_vector, null);
  v_got_chained := pg_temp.compute_row_hash(v_vector, repeat('a', 64));

  if v_got_start <> 'dff75eecb93518220f0046ce8f21cf670b5438c6751b954d02d23ef6bf2ce923' then
    raise exception E'Canonical-JSON encoder does NOT match the JavaScript implementation (chain-start case).\nexpected dff75eecb93518220f0046ce8f21cf670b5438c6751b954d02d23ef6bf2ce923\ngot      %\nencoded  %\nAborting: any event written now would fail future chain verification.',
      v_got_start, pg_temp.canonical_json(v_vector);
  end if;

  if v_got_chained <> '96908b5bf5bb71b911c27e069c2c44c98fa0e689a7deb00d251e91934cb7ba5b' then
    raise exception E'Canonical-JSON encoder does NOT match the JavaScript implementation (chained case).\nexpected 96908b5bf5bb71b911c27e069c2c44c98fa0e689a7deb00d251e91934cb7ba5b\ngot      %\nAborting: any event written now would fail future chain verification.',
      v_got_chained;
  end if;

  raise notice 'Encoder self-check passed — canonical JSON matches evidence.ts on both vectors.';
end $$;

do $$
declare
  v_client_id     uuid;
  v_client_count  integer;
  v_contract_id   uuid;
  v_number        text;
  v_prev_hash     text;
  v_material      jsonb;
  v_row_hash      text;
  v_admin_id      uuid;

  -- === EDIT HERE ============================================================
  -- Date on the wet signature (SCIOS signed 11.08.2026; the agreement itself is
  -- dated 11 August 2026).
  v_signed_at     timestamptz := timestamptz '2026-08-11 12:00:00+03';

  -- Second Division matches filmed PER SEASON. The championship has 230 matches
  -- in total. Clause 1.2 covers ALL of them EXCEPT the one match per matchday
  -- taken for live TV by the CFA's television partner — 26 matchdays, so ~26
  -- matches fall out: 230 − 26 = 204.
  --
  -- This is the planning figure, not a contracted count: the actual excluded
  -- list is supplied by the CFA (Cl. 1.2), and matches moved to a non-camera
  -- venue are still billable at the same €150 (Cl. 1.5). Matches SCIOS fails to
  -- record for its own reasons are not charged at all (Cl. 1.4). CHANGE THIS if
  -- your fixture count differs — it drives the contract value, and after this
  -- script runs the value is FROZEN by migration 0017.
  v_matches_per_season  integer := 204;
  v_rate_per_match      numeric := 150.00;   -- €150 NET per match (Clause 3)
  v_seasons             integer := 2;        -- initial term, before the +1 option
  -- ==========================================================================

  v_season_value  numeric;
  v_total_value   numeric;
begin
  v_season_value := v_matches_per_season * v_rate_per_match;
  v_total_value  := v_season_value * v_seasons;

  -- -------------------------------------------------------------------------
  -- 1. The CFA client (reused — it already exists from the Performance
  --    Analysis contract). Matched on name, not a hard-coded id.
  --
  --    Deliberately NOT `limit 1`: silently taking the first of several matches
  --    could attach a €61K federation agreement to the wrong client, and the
  --    0017 freeze makes client_id uncorrectable afterwards without the
  --    service-role key. Ambiguity must be resolved by a human, so 0 matches
  --    and 2+ matches both abort with the candidates listed.
  -- -------------------------------------------------------------------------
  -- min(id::text)::uuid, not min(id): Postgres has no min() aggregate for the
  -- uuid type (ERROR 42883). Which id wins is irrelevant — it is only read when
  -- exactly one row matched, and 2+ aborts below.
  select count(*), min(id::text)::uuid into v_client_count, v_client_id
  from public.clients
  where company_name ilike '%cyprus football association%'
     or company_name ilike '%Κοπ%'
     or company_name ilike '%KOP%'
     or company_name ilike '%CFA%';

  if v_client_count = 0 then
    raise exception 'CFA client not found in public.clients. Check the exact company_name (run: select id, company_name from public.clients order by company_name) and adjust the match above — this script will not create a duplicate client.';
  end if;

  if v_client_count > 1 then
    raise exception 'Ambiguous CFA client: % rows matched (%). Narrow the match above to the exact company_name before running.',
      v_client_count,
      (select string_agg(company_name, ' | ' order by company_name)
       from public.clients
       where company_name ilike '%cyprus football association%'
          or company_name ilike '%Κοπ%'
          or company_name ilike '%KOP%'
          or company_name ilike '%CFA%');
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Guard: do not import the same agreement twice. Keyed on the CFA's own
  --    tender reference, which appears in the description.
  -- -------------------------------------------------------------------------
  if exists (
    select 1 from public.contracts
    where description like '%2026-0005319-Championships-0000716%'
  ) then
    raise exception 'This agreement (Ref. 2026-0005319-Championships-0000716) is already recorded. This script is not idempotent by design.';
  end if;

  -- The admin recording this (you). Falls back to NULL if no match.
  select id into v_admin_id
  from public.app_users
  where lower(email) = 'cc@scienceofsports.net'
  limit 1;

  v_number := public.next_contract_number();

  -- -------------------------------------------------------------------------
  -- 3. Create the contract — COMPLETE and CORRECT, while still 'draft'.
  --    Migration 0017 freezes title/value/dates/description/special_terms/
  --    services/etc. the instant status becomes 'active' in step 4 below.
  --
  --    value: NET (ex-VAT), per the money model. There is no committed total
  --    in this agreement — it is a €150/match rate billed on matches actually
  --    filmed (Clause 3), with no minimum charge. The value here is therefore
  --    a PLANNING ESTIMATE (matches × rate × seasons), recorded so the deal is
  --    visible in the revenue views; it is NOT a contracted sum. The
  --    description says so explicitly, so nobody later reads it as committed.
  --
  --    billing_basis 'services' / payment_model 'club_all': the CFA pays the
  --    whole fee. The player-funded commercial model does not apply here.
  -- -------------------------------------------------------------------------
  insert into public.contracts (
    contract_number, client_id, title, type, status,
    value, currency, start_date, end_date,
    payment_type, payment_terms_days,
    governing_law, jurisdiction,
    description, special_terms,
    billing_basis, payment_model,
    vat_inclusive, annual_value_override,
    created_by
  ) values (
    v_number,
    v_client_id,
    'Technical Filming Services Agreement — Pancyprian Second Division (Β΄ Κατηγορίας) 2026/2027 & 2027/2028',
    'Filming Services',
    'draft',                       -- flipped to 'active' in step 4
    v_total_value,                 -- NET estimate, see note above
    'EUR',
    date '2026-08-11',             -- entered into 11 August 2026
    date '2028-06-30',             -- end of the second season (2027/2028)
    -- 'milestone' = irregular, invoice-by-invoice billing. NOT a made-up
    -- 'per_match': payment_type has no CHECK constraint, but PAYMENT_TYPES in
    -- src/lib/constants.js only knows one_time/monthly/quarterly/annually/
    -- milestone, and App.jsx renders contract.paymentType unguarded. An unknown
    -- value would show as raw text and drop out of the payment-type filters.
    -- Bi-monthly invoicing in arrears on actual matches is closest to milestone.
    'milestone',
    30,                            -- Clause 3.2 — 30 days from invoice date
    'Republic of Cyprus',
    'Courts of Cyprus',
    -- description: what the deal IS, plus the money basis in plain terms.
    'Technical filming of the Pancyprian Second Division Championship (Β΄ Κατηγορίας) '
      || 'for seasons 2026/2027 and 2027/2028. Ref. 2026-0005319-Championships-0000716, dated 11 August 2026. '
      || 'Fixed unmanned cameras permanently installed at Second Division home venues, full-pitch continuous '
      || 'coverage; all Second Division matches other than the one match per matchday selected for live TV '
      || 'broadcast by the CFA''s television partner. Delivery via the SOS OTT Platform within 24 hours, Full HD '
      || '1080p MP4. '
      || 'MONEY BASIS: this agreement has NO committed contract total. The fee is €150 net per match '
      || '(€178.50 incl. 19% VAT), invoiced every two months in arrears on the matches actually filmed, with no '
      || 'minimum charge and no travel surcharge. The recorded value of '
      || to_char(v_total_value, 'FM999G999G990D00') || ' EUR net is a PLANNING ESTIMATE ONLY ('
      || v_matches_per_season || ' matches per season × €' || to_char(v_rate_per_match, 'FM990D00')
      || ' × ' || v_seasons || ' seasons). The championship has 230 matches per season; the estimate '
      || 'excludes the ~26 taken for live TV broadcast (one per matchday across 26 matchdays), per Clause 1.2. '
      || 'Actual revenue follows the matches actually filmed and the exclusion list supplied by the CFA. '
      || 'Signed on paper outside the platform — see the attached countersigned PDF.',
    -- special_terms: the operationally / financially sharp clauses worth having
    -- on the contract record, not buried in the PDF.
    'Term: 2 seasons (2026/2027, 2027/2028), extendable by mutual written agreement for 1 further season '
      || '(max 3). Camera estate updated before each season for promotion/relegation at no charge (Cl. 2.2). '
      || '100% coverage guarantee (Cl. 1.4): a match not recorded for reasons within SOS''s control is not charged. '
      || 'PENALTY (Cl. 4.2): €1,000 per match for any failure to complete a match recording. '
      || 'PENALTY (Cl. 4.10): €1,000 per unauthorised use of the installed cameras — they may be used ONLY for '
      || 'Second Division matches unless otherwise agreed in writing. '
      || 'TERMINATION (Cl. 8.4): failure to film 3 matches in any one season lets the CFA terminate immediately. '
      || 'Alternative venues (Cl. 1.5): manual/robotic camera at the same €150, no surcharge. '
      || 'Other CFA competitions (Cl. 1.6) billed at the same per-match rate. Live streaming (Cl. 1.7) is NOT '
      || 'included — separate written agreement and pricing. '
      || 'Footage IP belongs to the CFA (Cl. 6.1); SOS''s licence (Cl. 6.2) is limited to analysis/scouting/'
      || 'reporting for the participating clubs and the CFA, subject to prior club approval, and no third-party '
      || 'disclosure without CFA written consent. Full archive hand-over within 20 days of expiry/termination '
      || '(Cl. 6.3). A data-processing addendum is to be entered into alongside this Agreement (Cl. 6.5) — OPEN ACTION. '
      || 'Liability capped at 12 months'' fees (Cl. 7.2), uncapped for fraud, wilful misconduct, gross negligence '
      || 'or any breach of Clause 6; the cap does not limit the contractual penalties above. '
      || 'Cameras installed and operational 2 weeks before each season starts (Cl. 4.13); SOS obtains all stadium '
      || 'permissions itself. Backups retained 12 months (Cl. 4.8). Late payment: statutory interest after 30 days; '
      || 'after 60 days SOS may pause NEW filming on 14 days'' notice, but existing footage and referee/'
      || 'disciplinary/integrity access are never suspended (Cl. 3.4).',
    'services',
    'club_all',
    false,                         -- value is NET; VAT added on top at 19%
    v_season_value,                -- annual run-rate = ONE season, not total/term
    v_admin_id
  )
  returning id into v_contract_id;

  -- -------------------------------------------------------------------------
  -- 4. Record the wet-ink execution in the append-only ledger.
  --    No signing_request exists (never sent through the platform), so
  --    signing_request_id is NULL and this event starts a fresh chain
  --    (prev_hash NULL) for this contract.
  -- -------------------------------------------------------------------------
  select row_hash into v_prev_hash
  from public.signature_events
  where contract_id = v_contract_id
  order by created_at desc
  limit 1;                         -- none yet: new contract, so NULL = chain start

  -- Material fields, in the SAME shape audit.ts hashes. Every key present,
  -- absent evidence explicitly null. jsonb_build_object keeps nulls as `null`.
  v_material := jsonb_build_object(
    'contract_id',                 v_contract_id,
    'signing_request_id',          null,
    'event_type',                  'imported',
    'message',                     'Signed offline (wet ink). Technical Filming Services Agreement for the '
                                     || 'Pancyprian Second Division Championship, seasons 2026/2027 and 2027/2028 '
                                     || '(CFA Ref. 2026-0005319-Championships-0000716), dated 11 August 2026. '
                                     || 'Negotiated, drafted and executed on paper entirely outside this platform: '
                                     || 'C.C. Science of Sports Ltd signed on 11/08/2026 and the Cyprus Football '
                                     || 'Association countersigns separately. Imported by SOS admin so the executed '
                                     || 'agreement is on record; the signed PDF is filed as the evidence artefact on '
                                     || 'this contract. No platform e-signature took place: no signing request was '
                                     || 'ever issued, no OTP identity verification, no signer IP capture, no drawn '
                                     || 'signature image, no click-through consents and no platform document hash — '
                                     || 'those fields are intentionally null.',
    'actor_type',                  'admin',
    'actor_id',                    v_admin_id,
    'signer_name',                 'Constantinos Charalambides',
    'signer_title',                'Chief Executive Officer',
    'signer_company',              'C.C. Science of Sports Ltd',
    'signer_email',                'cc@scienceofsports.net',
    'signer_ip',                   null,
    'user_agent',                  null,
    'signature_image_url',         null,
    'document_hash_after',         null,
    'consent_electronic',          null,
    'consent_authorized',          null,
    'consent_read',                null,
    -- false, NOT null. signer_on_behalf is NOT NULL DEFAULT false (migration
    -- 0020) and audit.ts hashes `event.signer_on_behalf ?? false` — hashing a
    -- null here would produce a row_hash that no future chain verification
    -- could reproduce. (record_offline_signature_apoel.sql predates the 0020
    -- fix in commit acadd6a and has null here; do not copy that.)
    'signer_on_behalf',            false,
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
    v_contract_id, null, 'imported',
    v_material ->> 'message',
    v_material ->> 'actor_type', v_admin_id,
    v_material ->> 'signer_name', v_material ->> 'signer_title',
    v_material ->> 'signer_company', v_material ->> 'signer_email',
    v_signed_at, null, null, null,
    null, null, null, null,
    v_prev_hash, v_row_hash
  );

  -- -------------------------------------------------------------------------
  -- 5. Execute the contract. start_date 11/08/2026 has passed, so it goes
  --    straight to 'active'. From this point migration 0017 freezes the legal
  --    columns above — a correction needs the service-role key.
  -- -------------------------------------------------------------------------
  update public.contracts
  set status = 'active'
  where id = v_contract_id;

  -- -------------------------------------------------------------------------
  -- 6. NO payment schedule.
  --    Invoices are raised every two months in arrears on the matches actually
  --    filmed (Cl. 3.1), so no amount or due date is knowable in advance. The
  --    money rules keep Receivables / Outstanding / Due-now as REAL money owed,
  --    and pre-loading estimated instalments would put uninvoiced guesses into
  --    those figures. Add each payment row as you issue the real invoice.
  -- -------------------------------------------------------------------------

  raise notice 'CFA B-Division agreement imported as % (active). Estimated net value % EUR over % seasons (% matches/season × %). event prev_hash=% row_hash=%',
    v_number, v_total_value, v_seasons, v_matches_per_season, v_rate_per_match,
    coalesce(v_prev_hash, '(chain start)'), v_row_hash;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify: contract state + the full event chain in order.
-- ---------------------------------------------------------------------------
select c.contract_number, c.status, c.value, c.annual_value_override,
       c.start_date, c.end_date, c.attachment_name, cl.company_name
from public.contracts c
join public.clients cl on cl.id = c.client_id
where c.description like '%2026-0005319-Championships-0000716%';

select event_type, signer_name, signer_title, signer_company, server_timestamp,
       signer_ip, consent_electronic,
       left(coalesce(prev_hash, '(start)'), 12) as prev, left(row_hash, 12) as row
from public.signature_events
where contract_id = (
  select id from public.contracts
  where description like '%2026-0005319-Championships-0000716%'
)
order by created_at;
