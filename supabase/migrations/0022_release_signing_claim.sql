-- ============================================================================
-- 0022_release_signing_claim
--
-- Closes an evidence-integrity BLOCKER on the signing success path.
--
-- record-signature calls claim_signing_request() (0016) FIRST — it atomically
-- flips signing_requests.status 'sent'/'otp_sent'/'otp_verified' -> 'signed' and
-- COMMITS on its own. Only AFTER that does the handler append the tamper-evident
-- 'signed' ledger row and mark the contract 'active'. If anything in between
-- throws (a transient DB error, a chain-tip read failure, or a malformed signer
-- IP failing the inet cast), the request is permanently 'signed' but NO
-- signature_events row exists and the contract never activates — an unrecoverable
-- state: the signer cannot retry ('signed' is not claimable) and there is zero
-- evidence. For a real €8K–€48K deal that defeats the entire evidence model.
--
-- This function lets the handler COMPENSATE: on any failure after a successful
-- claim, roll the request status back to 'otp_verified' so the signer can retry.
--
-- SAFETY: it flips 'signed' -> 'otp_verified' ONLY when the contract has NO
-- 'signed' event in the ledger yet. So it can NEVER un-sign a signature that was
-- actually recorded — if the append succeeded, the guard below refuses to reset.
-- The 0016 partial-unique index (one 'signed' event per contract) means a retry
-- after a successful reset still cannot create a duplicate signature.
--
-- SECURITY DEFINER so the public record-signature function can call it without
-- broad table grants, mirroring claim_signing_request.
-- ============================================================================

create or replace function public.release_signing_claim(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status     text;
  v_contract   uuid;
  v_has_signed boolean;
begin
  -- Lock the request row so this cannot race a concurrent claim/sign.
  select status, contract_id
    into v_status, v_contract
    from public.signing_requests
    where id = p_request_id
    for update;

  if v_status is null then
    return false;                     -- no such request
  end if;
  if v_status <> 'signed' then
    return false;                     -- nothing to release (not in the claimed state)
  end if;

  -- HARD GUARD: never reset if a signature was actually recorded for this
  -- contract. If the 'signed' ledger row exists, the signing genuinely completed
  -- and must stay immutable.
  select exists (
    select 1 from public.signature_events
     where contract_id = v_contract
       and event_type = 'signed'
  ) into v_has_signed;

  if v_has_signed then
    return false;                     -- real signature present — refuse to un-sign
  end if;

  update public.signing_requests
     set status = 'otp_verified'      -- back to the last pre-sign, still-claimable state
   where id = p_request_id;

  return true;
end;
$$;
