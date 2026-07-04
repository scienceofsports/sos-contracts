-- ============================================================================
-- Allow deleting a contract (with a strong UI warning) to cascade-remove its
-- signature_events, while still preventing tampering.
--
-- Problem: signature_events had a BEFORE DELETE trigger (forbid_mutation) that
-- raised on any delete. But contracts -> signature_events is ON DELETE CASCADE,
-- so deleting a contract tried to delete its events and hit the trigger,
-- failing the whole delete.
--
-- Fix: keep the append-only guarantee where it matters (no UPDATE ever — rows
-- can never be edited, so the hash chain stays trustworthy) but drop the
-- DELETE-blocking trigger. Direct row deletion remains blocked for everyone by
-- RLS (there is no DELETE policy on signature_events; only the service role,
-- used by Edge Functions, and an explicit admin contract-cascade can remove
-- rows). This makes "delete the whole contract" possible for test data and
-- genuine cancellations, without allowing selective edits/removals that would
-- forge the record.
-- ============================================================================

-- Remove only the DELETE guard; the UPDATE guard stays (rows remain immutable).
drop trigger if exists signature_events_no_delete on public.signature_events;

-- (signature_events_no_update remains in place — no row can ever be modified.)
