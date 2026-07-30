-- ============================================================================
-- Verify the regenerated certificate for SOS-C-2026-005 (Omonoia Aradippou),
-- and explain the integrityOk=false result.
--
-- READ-ONLY. Nothing here writes.
--
-- Context: record-signature computes
--     integrityOk = (document_hash_after == document_hash_before)
-- and deliberately does NOT block signing on a mismatch. A mismatch is
-- EXPECTED and benign when the signer fills in previously-blank party details
-- at signing (legal name / VAT / registration / country) — that edits the
-- document, so its hash legitimately changes. The mismatch is recorded as
-- evidence rather than hidden.
--
-- This query shows whether that is what happened here: if the executed
-- snapshot's client block carries details the sent snapshot lacked, the
-- mismatch is explained and harmless.
-- ============================================================================

with c as (
  select * from public.contracts where contract_number = 'SOS-C-2026-005'
),
sr as (
  select * from public.signing_requests
  where contract_id = (select id from c) and executed_snapshot is not null
  order by created_at desc limit 1
),
ev as (
  select * from public.signature_events
  where contract_id = (select id from c) and event_type = 'signed'
  order by created_at desc limit 1
)
select * from (
  -- 1. Did a certificate land?
  select 1 as n, 'certificate now exists' as check,
         (select count(*)::text from public.certificates where contract_id = (select id from c)) as value,
         coalesce((select to_char(generated_at,'DD/MM/YYYY HH24:MI') || ' · ' || left(pdf_sha256,16)
                   from public.certificates where contract_id = (select id from c)
                   order by generated_at desc limit 1), '(none)') as detail

  union all
  select 2, 'contract certificate_status',
         coalesce((select certificate_status from c), '(null)'),
         'was "failed" before regeneration'

  -- 2. The hash comparison behind integrityOk.
  union all
  select 3, 'hash before (at Send)',
         left((select document_hash_before from sr), 24),
         'frozen when the contract was sent'
  union all
  select 4, 'hash after (at Sign)',
         left(coalesce((select document_hash_after from ev), '(null)'), 24),
         'recomputed over the document actually signed'
  union all
  select 5, 'integrity match',
         case when (select document_hash_after from ev) = (select document_hash_before from sr)
              then 'MATCH' else 'DIFFER (expected if party details were completed at signing)' end,
         'record-signature records the mismatch as evidence; it never blocks signing'

  -- 3. THE EXPLANATION: did the signer complete party details at signing?
  --    If these differ between sent and executed snapshots, the hash change is
  --    fully accounted for and the document is intact.
  union all
  select 6, 'client legal name — sent',
         coalesce((select document_snapshot->'client'->>'companyName' from sr), '(blank)'),
         'from the SENT snapshot'
  union all
  select 7, 'client legal name — executed',
         coalesce((select executed_snapshot->'client'->>'companyName' from sr), '(blank)'),
         'from the EXECUTED snapshot'
  union all
  select 8, 'registration no. — sent',
         coalesce((select document_snapshot->'client'->>'registrationNumber' from sr),
                  (select document_snapshot->'client'->>'registration_number' from sr), '(blank)'),
         'blank at send => signer supplied it'
  union all
  select 9, 'registration no. — executed',
         coalesce((select executed_snapshot->'client'->>'registrationNumber' from sr),
                  (select executed_snapshot->'client'->>'registration_number' from sr), '(blank)'),
         'value the client confirmed when signing'
  union all
  select 10, 'VAT no. — sent',
         coalesce((select document_snapshot->'client'->>'vatNumber' from sr),
                  (select document_snapshot->'client'->>'vat_number' from sr), '(blank)'), ''
  union all
  select 11, 'VAT no. — executed',
         coalesce((select executed_snapshot->'client'->>'vatNumber' from sr),
                  (select executed_snapshot->'client'->>'vat_number' from sr), '(blank)'), ''
  union all
  select 12, 'country — sent',
         coalesce((select document_snapshot->'client'->>'country' from sr), '(blank)'), ''
  union all
  select 13, 'country — executed',
         coalesce((select executed_snapshot->'client'->>'country' from sr), '(blank)'), ''

  -- 4. The contract money terms must be IDENTICAL in both. If these differ,
  --    that is a genuine concern rather than a benign party-details edit.
  union all
  select 14, 'contract value — sent vs executed',
         coalesce((select document_snapshot->'contract'->>'value' from sr),'?') || ' vs ' ||
         coalesce((select executed_snapshot->'contract'->>'value' from sr),'?'),
         'these MUST match — a difference here would be serious'
  union all
  select 15, 'contract title — sent vs executed',
         case when (select document_snapshot->'contract'->>'title' from sr)
                 = (select executed_snapshot->'contract'->>'title' from sr)
              then 'IDENTICAL' else 'DIFFERENT — investigate' end,
         coalesce((select executed_snapshot->'contract'->>'title' from sr), '')
) rows
order by n;
