-- ============================================================================
-- Diagnose SOS-C-2026-005 (Omonoia Aradippou) — signed, but the Certificate of
-- Completion failed to render ("WinAnsi cannot encode H (0x0397)").
--
-- READ-ONLY. Nothing here writes.
--
-- Single result grid: the Supabase SQL Editor only shows the LAST statement's
-- output, so every check is folded into one union'd answer sheet rather than
-- four separate selects.
--
-- Column locations verified against the migrations:
--   * certificate_status  -> contracts        (0016_signing_hardening)
--   * executed_snapshot   -> signing_requests (0023_executed_snapshot)
--   * document_hash_after -> signature_events (0001; NOT on signing_requests)
--   * signing time        -> signature_events.server_timestamp of 'signed'
-- ============================================================================

with c as (
  select * from public.contracts where contract_number = 'SOS-C-2026-005'
),
sr as (
  select * from public.signing_requests
  where contract_id = (select id from c)
  order by created_at desc
  limit 1
)
select * from (
  -- 1. Contract state + the failure flag record-signature sets.
  select 1 as n,
         'contract status' as check,
         (select status from c) as value,
         'certificate_status=' || coalesce((select certificate_status from c), '(null)')
           || '  value=' || coalesce((select value::text from c), '?')
           || ' ' || coalesce((select currency from c), '') as detail

  -- 2. THE DECISIVE ONE: did the frozen executed document survive?
  --    It is written BEFORE certificate generation, so it should be present.
  union all
  select 2,
         'executed_snapshot present',
         case when (select executed_snapshot from sr) is not null
              then 'YES' else 'NO' end,
         'executed=' || coalesce((select length(executed_snapshot::text) from sr)::text, '0')
           || ' bytes · sent-snapshot='
           || coalesce((select length(document_snapshot::text) from sr)::text, '0') || ' bytes'

  -- 3. Is the binding signature event actually in the ledger?
  union all
  select 3,
         'signed event in ledger',
         case when exists (
           select 1 from public.signature_events
           where contract_id = (select id from c) and event_type = 'signed'
         ) then 'YES' else 'NO' end,
         coalesce((
           select 'by ' || coalesce(signer_name, '?')
                  || ' <' || coalesce(signer_email, '?') || '>'
                  || ' at ' || to_char(server_timestamp, 'DD/MM/YYYY HH24:MI')
                  || ' · ip=' || case when signer_ip is not null then 'yes' else 'no' end
                  || ' · consents='
                  || coalesce(consent_electronic::text, '-')
                  || '/' || coalesce(consent_authorized::text, '-')
                  || '/' || coalesce(consent_read::text, '-')
           from public.signature_events
           where contract_id = (select id from c) and event_type = 'signed'
           order by created_at desc limit 1
         ), 'no signed event found')

  -- 4. Does a certificate row exist? (expected: none — that is the bug)
  union all
  select 4,
         'certificate rows',
         (select count(*)::text from public.certificates
          where contract_id = (select id from c)),
         coalesce((
           select 'latest ' || to_char(generated_at, 'DD/MM/YYYY HH24:MI')
                  || ' · ' || coalesce(pdf_url, '(no path)')
           from public.certificates
           where contract_id = (select id from c)
           order by generated_at desc limit 1
         ), 'none — certificate never generated')

  -- 5. Full ledger chain length, for context.
  union all
  select 5,
         'ledger events total',
         (select count(*)::text from public.signature_events
          where contract_id = (select id from c)),
         coalesce((
           select string_agg(event_type, ' → ' order by created_at)
           from public.signature_events
           where contract_id = (select id from c)
         ), '(none)')
) rows
order by n;
