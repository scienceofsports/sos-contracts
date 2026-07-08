-- ============================================================================
-- 0023_executed_snapshot
--
-- Guarantees that the EXECUTED document (as the client confirmed it at signing)
-- is shown 100% identically everywhere after signing: the signed PDF, the admin
-- "View Contract Document", and both parties' copies.
--
-- Until now signing_requests held only document_snapshot — the SEND-TIME frozen
-- document. If the client corrected their legal details (company name, address,
-- VAT, registration), signatory/representative, or contact people at signing,
-- the signed PDF captured those corrections but the on-screen frozen view still
-- rendered the send-time snapshot (or a live-client overlay that could DRIFT if
-- the client record was later edited). Two views of the same executed contract
-- could disagree.
--
-- executed_snapshot stores the COMPLETE final document object exactly as rendered
-- into the signed PDF — the same object whose SHA-256 is document_hash_after — so
-- every post-sign view renders from one immutable source. It is written once by
-- record-signature at signing and never changed. The send-time document_snapshot
-- is retained UNTOUCHED alongside it as the send-time evidence anchor.
--
-- Nullable: pre-existing signed contracts have no executed_snapshot; readers fall
-- back to document_snapshot for those. Drafts are unaffected (they render live).
-- ============================================================================

alter table public.signing_requests
  add column if not exists executed_snapshot jsonb;
