-- ============================================================================
-- 0028_contract_discount
--
-- Adds a visible DISCOUNT line to the contract document.
--
-- WHY
-- The 2nd Division programme lists at €3,000 and carries a €700 discount from
-- SCIOS's collaboration with the Cyprus Football Coaches Association, giving
-- €2,300. Until now the package simply set the platform price to €2,300, so the
-- discount existed only as a sentence in the Special Terms: the club saw a
-- €2,300 line item and no evidence it had been given anything. The discount is
-- a selling point and belongs in the numbers, not in a footnote.
--
-- HOW
-- Two nullable columns. `discount_amount` is a NET (ex-VAT) amount subtracted
-- from the services total; `discount_label` is the reason shown on the row
-- (e.g. "Έκπτωση συνεργασίας ΠΑΣΠ"). Both NULL = no discount row = exactly
-- today's document, so every existing contract is untouched.
--
-- The discount is applied to the NET total BEFORE VAT, which is how a trade
-- discount works: VAT is charged on the discounted consideration actually
-- payable, not on the list price. €3,000 − €700 = €2,300 net, VAT €437,
-- gross €2,737 — identical to what the 2nd Division contracts already bill.
--
-- ---------------------------------------------------------------------------
-- SAFETY — existing contracts are NOT impacted:
--   * Both columns are NULLable with no default, and every renderer skips the
--     discount row when the amount is null or zero.
--   * Sent/active/signed contracts render from the frozen document_snapshot /
--     executed_snapshot, so this cannot alter an executed document.
--
-- ORDER: apply after 0027.
-- ============================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS discount_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_label  text;

-- A discount is a reduction, never a surcharge. Guard against a negative value
-- silently INCREASING the contract value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_discount_amount_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_discount_amount_check
      CHECK (discount_amount IS NULL OR discount_amount >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.discount_amount IS
  'NET (ex-VAT) discount subtracted from the services total before VAT. NULL or '
  '0 = no discount row on the document.';
COMMENT ON COLUMN public.contracts.discount_label IS
  'Reason shown on the discount row, e.g. "Έκπτωση συνεργασίας ΠΑΣΠ".';

-- ----------------------------------------------------------------------------
-- EVIDENCE LOCK — the discount is a legal/commercial column
--
-- 0017 installed public.block_signed_contract_edit(), which rejects UPDATEs to
-- the legally-operative columns of a signed/active contract. What the client was
-- charged, and the discount they were granted, are exactly such columns.
--
-- Re-created here with the discount columns added. Every other guarded column
-- from 0017 and 0027 is carried over VERBATIM — CREATE OR REPLACE overwrites the
-- whole body, so omitting one would silently unlock it.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contracts_block_signed_edit'
  ) THEN
    RAISE EXCEPTION
      '0017 has not been applied to this database (trigger '
      'contracts_block_signed_edit is missing). Apply 0017 before 0028.';
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
  -- 0028: the discount granted, and the reason shown for it.
  or (new.discount_amount      is distinct from old.discount_amount)
  or (new.discount_label       is distinct from old.discount_label)
  then
    raise exception
      'Cannot edit a % contract. The terms of an executed agreement are locked as legal evidence. Cancel it and issue an amendment/new contract instead.',
      old.status;
  end if;

  return new;
end;
$$;
