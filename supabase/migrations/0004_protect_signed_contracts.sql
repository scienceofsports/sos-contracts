-- ============================================================================
-- Protect signed/active contracts from deletion (evidence preservation).
--
-- Migration 0003 allowed contract deletion to cascade-remove signature_events
-- so DRAFT/test contracts could be cleaned up. But that also let a signed or
-- active contract — and its tamper-evident signature ledger + certificate — be
-- destroyed by one admin action. For a real signed agreement that is spoliation
-- of legal evidence.
--
-- This adds a BEFORE DELETE trigger on contracts that BLOCKS deletion when the
-- contract is in 'signed' or 'active' status, or when any 'signed'
-- signature_event exists for it. Drafts, sent (unsigned), expired and cancelled
-- contracts remain deletable. To remove a signed contract from active views,
-- set its status to 'cancelled' instead (a soft cancel that keeps the record).
-- ============================================================================

create or replace function public.block_signed_contract_delete()
returns trigger
language plpgsql
as $$
declare
  has_signed boolean;
begin
  if old.status in ('signed', 'active') then
    raise exception 'Cannot delete a % contract. Signed agreements and their signature evidence must be retained. Set the status to cancelled instead.', old.status;
  end if;
  select exists (
    select 1 from public.signature_events
    where contract_id = old.id and event_type = 'signed'
  ) into has_signed;
  if has_signed then
    raise exception 'Cannot delete this contract: it has a recorded signature. Signature evidence must be retained.';
  end if;
  return old;
end;
$$;

drop trigger if exists contracts_block_signed_delete on public.contracts;
create trigger contracts_block_signed_delete
  before delete on public.contracts
  for each row execute function public.block_signed_contract_delete();
