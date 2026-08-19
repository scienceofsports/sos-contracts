-- ============================================================================
-- 0027_contract_language
--
-- Adds the language the contract DOCUMENT is written in.
--
-- SCIOS signs Cypriot clubs whose officers read Greek far more comfortably than
-- English. The 2nd Division programme in particular is sold to the whole
-- division on identical terms, to club chairmen and technical directors rather
-- than to lawyers — an English document there is a real obstacle to signing.
-- A Greek-language contract is fully enforceable under Cyprus law, so this is
-- a presentation choice, not a legal compromise.
--
-- Language is a property of the DOCUMENT, not of the client: the same club may
-- hold an English federation-facing agreement and a Greek divisional one, and a
-- client's preferred language can change without altering contracts already
-- executed. So it belongs on `contracts`, alongside `contract_kind` (0026),
-- rather than on `clients`.
--
-- ---------------------------------------------------------------------------
-- SAFETY — existing contracts are NOT impacted:
--   * The column DEFAULTs to 'en', which is exactly today's behaviour, so every
--     existing row renders a byte-identical document.
--   * Sent/active/signed contracts render from the frozen document_snapshot /
--     executed_snapshot, so this cannot alter an executed document even if the
--     value were changed later.
--   * The check constraint is additive; it rejects nothing that exists today.
--
-- ORDER: apply AFTER 0026. Section 2 rewrites the 0017 edit-lock function, so
-- 0017 must already be present — see the guard in that section.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONTRACT LANGUAGE
-- ----------------------------------------------------------------------------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Constrain to the languages the document generators can actually render. A
-- value with no translation would silently fall back to English mid-document,
-- which is worse than refusing it at the boundary.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_language_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_language_check
      CHECK (language IN ('en', 'el'));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.language IS
  'Language the contract document is rendered in: en | el. Set per contract, not '
  'per client. Captured in document_snapshot at send time, so an executed '
  'contract always re-renders in the language it was signed in.';

-- ----------------------------------------------------------------------------
-- 2. EVIDENCE LOCK — language joins the frozen columns
--
-- 0017 installed public.block_signed_contract_edit(), which rejects UPDATEs to
-- the legally-operative columns of a contract that is already signed/active.
-- The language the document was presented in is exactly such a column:
-- re-rendering an executed agreement in another language would change the words
-- the counterparty actually agreed to.
--
-- This re-creates that function with `language` added. Every other guarded
-- column from 0017 is carried over VERBATIM — CREATE OR REPLACE overwrites the
-- whole body, so omitting one here would silently unlock it.
--
-- If this raises "0017 has not been applied", run 0017 first: replacing the
-- function when the trigger does not exist would leave the guard uninstalled.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contracts_block_signed_edit'
  ) THEN
    RAISE EXCEPTION
      '0017 has not been applied to this database (trigger '
      'contracts_block_signed_edit is missing). Apply 0017 before 0027.';
  END IF;
END $$;

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
  -- 0027: the language the document was presented and signed in.
  or (new.language             is distinct from old.language)
  then
    raise exception
      'Cannot edit a % contract. The terms of an executed agreement are locked as legal evidence. Cancel it and issue an amendment/new contract instead.',
      old.status;
  end if;

  return new;
end;
$$;
