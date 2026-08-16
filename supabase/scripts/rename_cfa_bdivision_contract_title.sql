-- ============================================================================
-- Rename the CFA B-Division contract title (display only).
--
--   from: 'Technical Filming Services Agreement — Pancyprian Second Division
--          (Β΄ Κατηγορίας) 2026/2027 & 2027/2028'
--   to:   'CFA — B Division Filming Agreement'
--
-- WHY THIS NEEDS A SCRIPT
-- `title` is one of the columns migration 0017 freezes once a contract is
-- signed/active, so a normal UPDATE is rejected by the
-- contracts_block_signed_edit trigger. That guard is doing its job — the terms
-- of an executed agreement must not drift — so this lifts it for ONE statement
-- and restores it immediately, inside a transaction.
--
-- WHY IT IS SAFE HERE
-- The legal record of this agreement is the signed PDF attached to the contract
-- (it was executed on paper; nothing was ever rendered or hashed by the
-- platform). `title` is a label in the admin list, is not part of any
-- document_snapshot, and is not covered by any signature hash — no
-- signing_request exists for this contract. Renaming it changes no term, no
-- money, and no evidence. The audit ledger is untouched.
--
-- Everything else stays: the full legal name, the seasons and the CFA reference
-- remain in `description` and on the signed PDF.
--
-- DO NOT generalise this script. Re-enabling the trigger is inside the same
-- transaction as disabling it, so a failure rolls the whole thing back and the
-- guard can never be left off. Any future use must keep that property.
--
-- RUN AS: Supabase SQL Editor (service role) — required to alter the trigger.
-- ============================================================================

begin;

do $$
declare
  v_id        uuid;
  v_old       text;
  v_new       text := 'CFA — B Division Filming Agreement';
  v_status    text;
begin
  select id, title, status into v_id, v_old, v_status
  from public.contracts
  where description like '%2026-0005319-Championships-0000716%';

  if v_id is null then
    raise exception 'CFA B-Division contract not found (Ref. 2026-0005319-Championships-0000716).';
  end if;

  if v_old = v_new then
    raise notice 'Title is already "%" — nothing to do.', v_new;
    return;
  end if;

  -- Guard: this script is written for THIS contract only. If it ever matched a
  -- contract that had been through the platform signing flow, the title would
  -- appear inside a frozen document_snapshot and renaming it would put the
  -- record out of step with the document the client signed.
  if exists (select 1 from public.signing_requests where contract_id = v_id) then
    raise exception 'This contract has a signing_request: its title appears in a frozen document snapshot. Renaming would desync the record from the signed document. Aborting.';
  end if;

  alter table public.contracts disable trigger contracts_block_signed_edit;

  update public.contracts
  set title = v_new
  where id = v_id;

  alter table public.contracts enable trigger contracts_block_signed_edit;

  raise notice 'Renamed % (%): "%" -> "%"',
    (select contract_number from public.contracts where id = v_id), v_status, v_old, v_new;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify: the new title, and that the guard is back ON ('O' = enabled/origin;
-- 'D' would mean still disabled and must never be the result here).
-- ---------------------------------------------------------------------------
select contract_number, title, status, value
from public.contracts
where description like '%2026-0005319-Championships-0000716%';

select tgname,
       tgenabled,
       case tgenabled when 'O' then 'ENABLED (correct)' else 'DISABLED — INVESTIGATE' end as guard_state
from pg_trigger
where tgrelid = 'public.contracts'::regclass
  and tgname = 'contracts_block_signed_edit';
