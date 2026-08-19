-- ============================================================================
-- 0029_contract_partner_logos
--
-- Co-branding logos shown in the contract header, alongside SCIOS and the
-- client.
--
-- WHY
-- The 2nd Division programme is run with the Cyprus Football Coaches
-- Association, whose collaboration is what funds the €700 discount. The
-- agreement is presented to clubs as a joint programme, so the association's
-- mark belongs in the header next to SCIOS and the club badge.
--
-- SHAPE
-- jsonb array of { name, logoUrl } (a file shipped in the app's public/ folder)
-- or { name, logoBase64 } (an inline image, like client logos). A file
-- reference is right for a partner that recurs on every contract in a
-- programme; base64 suits a one-off.
--
-- Defaults to an empty array, so every existing contract renders exactly the
-- two-logo header it renders today.
--
-- ORDER: apply after 0028.
-- ============================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS partner_logos jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Extra signature columns beyond Provider + Client: the 2nd Division
  -- agreement is countersigned by the coaches association's representative.
  -- [{organisation, name, title}] — they sign ON PAPER, so the name/title are
  -- pre-filled and the signature/date lines are left blank to complete by hand.
  -- This is NOT an e-signing party: it does not create a signing request and
  -- does not affect the evidence chain, which stays Provider + Client.
  ADD COLUMN IF NOT EXISTS extra_signatories jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contracts.extra_signatories IS
  'Additional signature columns on the document: [{organisation, name, title}]. '
  'Wet-ink only — not e-signing parties, and not part of the evidence chain.';

COMMENT ON COLUMN public.contracts.partner_logos IS
  'Co-branding logos in the contract header: [{name, logoUrl}] or '
  '[{name, logoBase64}]. Empty array = SCIOS x client only.';

-- ----------------------------------------------------------------------------
-- EVIDENCE LOCK
--
-- Who is presented as a partner ON the agreement is part of the document the
-- counterparty signed, so it joins the 0017 guard. The full guard list from
-- 0017/0027/0028 is carried over VERBATIM — CREATE OR REPLACE overwrites the
-- whole body, so omitting a column would silently unlock it.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contracts_block_signed_edit'
  ) THEN
    RAISE EXCEPTION
      '0017 has not been applied to this database (trigger '
      'contracts_block_signed_edit is missing). Apply 0017 before 0029.';
  END IF;
END $$;

create or replace function public.block_signed_contract_edit()
returns trigger
language plpgsql
as $$
begin
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
  or (new.language             is distinct from old.language)   -- 0027
  or (new.discount_amount      is distinct from old.discount_amount)  -- 0028
  or (new.discount_label       is distinct from old.discount_label)   -- 0028
  or (new.partner_logos        is distinct from old.partner_logos)    -- 0029
  or (new.extra_signatories    is distinct from old.extra_signatories) -- 0029
  then
    raise exception
      'Cannot edit a % contract. The terms of an executed agreement are locked as legal evidence. Cancel it and issue an amendment/new contract instead.',
      old.status;
  end if;

  return new;
end;
$$;
