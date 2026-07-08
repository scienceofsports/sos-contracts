-- ============================================================================
-- DIAGNOSTIC ONLY — makes no changes. Run in the Supabase SQL Editor.
-- Reports, for each migration 0002–0020, whether its signature schema object
-- exists in the LIVE database. 'MISSING' = that migration was never applied.
-- (0001 is the base schema; if the app runs at all it's applied.)
-- ============================================================================
with checks(mig, applied) as (
  select '0004 protect_signed (delete trigger)',
         exists(select 1 from pg_trigger where tgname = 'contracts_block_signed_delete')
  union all select '0005 authorised_signatory (contracts.signatory_name)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='signatory_name')
  union all select '0006 decline (signing_requests allows ''declined'')',
         (select pg_get_constraintdef(oid) like '%declined%'
            from pg_constraint where conname='signing_requests_status_check')
  union all select '0007 recipients (clients.cc_emails)',
         exists(select 1 from information_schema.columns where table_name='clients' and column_name='cc_emails')
  union all select '0008 analysis_scope (contracts.analysis_teams)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='analysis_teams')
  union all select '0009 commercial_model (contracts.billing_basis)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='billing_basis')
  union all select '0010 min_players (contracts.min_players)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='min_players')
  union all select '0011 sla_bands (contracts.sla_bands)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='sla_bands')
  union all select '0012 sla_hours (contracts.sla_hours)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='sla_hours')
  union all select '0013 otp_hardening (signing_requests.otp_total_attempts)',
         exists(select 1 from information_schema.columns where table_name='signing_requests' and column_name='otp_total_attempts')
  union all select '0014 contract_events (table exists)',
         exists(select 1 from information_schema.tables where table_name='contract_events')
  union all select '0015 commercial_projection (contracts.club_fixed_fee)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='club_fixed_fee')
  union all select '0016 signing_hardening (claim_signing_request fn)',
         exists(select 1 from pg_proc where proname='claim_signing_request')
  union all select '0016 signing_hardening (contracts.certificate_status)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='certificate_status')
  union all select '0017 lock_signed_edits (edit trigger)',
         exists(select 1 from pg_trigger where tgname = 'contracts_block_signed_edit')
  union all select '0018 vat_inclusive (contracts.vat_inclusive)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='vat_inclusive')
  union all select '0019 annual_value_override (contracts.annual_value_override)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='annual_value_override')
  union all select '0020 signer_on_behalf (contracts.signer_on_behalf)',
         exists(select 1 from information_schema.columns where table_name='contracts' and column_name='signer_on_behalf')
)
select mig,
       case when applied then 'ok' else '>>> MISSING <<<' end as status
from checks
order by mig;
