-- ============================================================================
-- Freeze the legal fields of a signed/active contract (tamper-proofing).
--
-- Migration 0004 already BLOCKS DELETE of a signed/active contract. But UPDATE
-- was still permitted at the database level — the app only hid the Edit button
-- (App.jsx: "Only draft contracts can be edited"). For an evidence-grade e-sign
-- platform the immutability must be enforced by the DATABASE, so that neither a
-- UI bug, a direct API/PostgREST call, nor a compromised admin session can alter
-- the terms of an executed agreement.
--
-- This adds a BEFORE UPDATE trigger on contracts that, once the row is already
-- 'signed' or 'active', REJECTS any change to the legally-meaningful columns
-- (the contract document itself). Operational columns stay writable so the
-- business workflow keeps working after signing:
--   * status            -> allow moving to 'cancelled'/'expired' (soft close)
--   * renewal_status, renewal_reminder_sent
--   * attachment_url/name (a countersigned scan can still be attached)
--   * version, version_history (audit metadata)
--   * signer_*/signed_at/signer_ip/consent_* if present (set once at signing)
--
-- The signing act itself is UNAFFECTED: record-signature transitions the row
-- from draft/sent -> signed/active. This trigger only fires its freeze when the
-- row was ALREADY signed/active BEFORE the update (old.status), so the initial
-- execution write passes; only LATER edits are rejected.
--
-- To legitimately change an executed agreement, issue an amendment/new contract
-- (as the "Entire Agreement & Amendments" clause requires) — never an in-place
-- edit. The service-role key can still bypass this via the Supabase dashboard
-- if a correction is ever truly required (mirrors the delete-guard model).
-- ============================================================================

create or replace function public.block_signed_contract_edit()
returns trigger
language plpgsql
as $$
begin
  -- Only guard rows that were already executed before this update.
  if old.status not in ('signed', 'active') then
    return new;
  end if;

  -- Any change to a frozen (document-defining) column is rejected. We compare
  -- with `is distinct from` so NULL<->value changes are also caught.
  if (new.title                is distinct from old.title)
  or (new.type                 is distinct from old.type)
  or (new.client_id            is distinct from old.client_id)
  or (new.value                is distinct from old.value)
  or (new.currency             is distinct from old.currency)
  or (new.start_date           is distinct from old.start_date)
  or (new.end_date             is distinct from old.end_date)
  or (new.payment_type         is distinct from old.payment_type)
  or (new.payment_terms_days   is distinct from old.payment_terms_days)
  or (new.late_payment_penalty is distinct from old.late_payment_penalty)
  or (new.governing_law        is distinct from old.governing_law)
  or (new.jurisdiction         is distinct from old.jurisdiction)
  or (new.description          is distinct from old.description)
  or (new.special_terms        is distinct from old.special_terms)
  or (new.services             is distinct from old.services)
  or (new.document_hash_before is distinct from old.document_hash_before)
  or (new.contract_number      is distinct from old.contract_number)
  then
    raise exception
      'Cannot edit a % contract. The terms of an executed agreement are locked as legal evidence. Cancel it and issue an amendment/new contract instead.',
      old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_block_signed_edit on public.contracts;
create trigger contracts_block_signed_edit
  before update on public.contracts
  for each row execute function public.block_signed_contract_edit();
