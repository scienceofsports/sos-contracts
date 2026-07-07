-- ============================================================================
-- 0016_signing_hardening
--
-- Post-audit hardening of the signing evidence path. Three defences, all at the
-- database level so application-logic regressions cannot bypass them:
--
--  1. Partial UNIQUE index: a contract can have AT MOST ONE 'signed' event.
--     Backstops record-signature against a double-submit / retry-after-partial-
--     failure writing a second, conflicting, un-deletable signature into the
--     tamper-evident ledger.
--
--  2. claim_signing_request(): an atomic, row-locked status flip from 'sent' to
--     'signed'. record-signature calls this FIRST; only the caller that wins the
--     lock proceeds to append the signature. Two concurrent calls => exactly one
--     signs.
--
--  3. Restore the append-only DELETE guard on signature_events that migration
--     0003 removed, so the evidence ledger cannot be silently erased by a
--     contract cascade-delete. Deleting a contract that has ANY signature_events
--     is now blocked outright (test data must be cleaned via the documented
--     force-delete path that lifts the guard deliberately).
-- ============================================================================

-- 1. At most one 'signed' event per contract. -------------------------------
create unique index if not exists signature_events_one_signed_per_contract
  on public.signature_events (contract_id)
  where event_type = 'signed';

-- 2. Atomic claim of a signing request. Returns true only for the ONE caller
--    that flips a still-in-progress request to 'signed'; everyone else gets
--    false (already signed / declined / cancelled / expired). The signing
--    lifecycle is 'sent' -> 'otp_sent' -> 'otp_verified' -> 'signed', so any of
--    the first three is claimable (record-signature separately enforces that OTP
--    was verified). Terminal states are rejected. SECURITY DEFINER so the public
--    function can call it without broad table grants. The row lock + single-row
--    update is the concurrency guarantee against double-submit.
create or replace function public.claim_signing_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  -- Lock the row so a concurrent claim blocks here until we commit/rollback.
  select status into v_status
    from public.signing_requests
    where id = p_request_id
    for update;

  if v_status is null then
    return false;                                   -- no such request
  end if;
  if v_status not in ('sent', 'otp_sent', 'otp_verified') then
    return false;                                   -- terminal: signed/declined/…
  end if;

  update public.signing_requests
     set status = 'signed'
   where id = p_request_id;

  return true;
end;
$$;

-- 3. Restore the DELETE guard on the tamper-evident ledger (dropped in 0003).
--    forbid_mutation() already exists from 0001.
drop trigger if exists signature_events_no_delete on public.signature_events;
create trigger signature_events_no_delete
  before delete on public.signature_events
  for each row execute function public.forbid_mutation();

-- 4. Track whether the Certificate of Completion / signed PDF was produced. Set
--    to 'failed' by record-signature if generation errored after signing, so
--    staff can spot and regenerate a signed contract missing its evidence PDF.
alter table public.contracts add column if not exists certificate_status text;

-- 5. Cumulative count of OTP codes sent for a signing request, so send-otp can
--    enforce an absolute resend cap (anti email-bomb / anti quota-burn on a
--    leaked link) on top of the existing 30-second floor.
alter table public.signing_requests add column if not exists otp_send_count integer not null default 0;
