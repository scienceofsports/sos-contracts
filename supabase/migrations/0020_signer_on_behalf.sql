-- ============================================================================
-- Signing via an AUTHORISED REPRESENTATIVE company.
--
-- Sometimes the party bound by the contract (the Client — e.g. a club like
-- Olympiakos) does not sign directly. Instead a separate company that holds the
-- right to act on the Client's behalf (e.g. "Excel Co Ltd", a management/
-- representative company) signs the agreement AS AUTHORISED REPRESENTATIVE.
--
-- Legal shape captured here:
--   * The Client (the club) remains the contracting party — bound + liable + payer.
--     The party clause and "For and on behalf of <Client>" heading are UNCHANGED.
--   * The representative company + the signer's authority basis are recorded as
--     SIGNATURE EVIDENCE (who actually put pen to paper, and under what authority),
--     shown in the signature block and Certificate of Completion.
--
-- These live on signature_events (the append-only, tamper-evident ledger) — the
-- authoritative record of the signing act — NOT on contracts, because they are
-- facts about the signature, established at signing time by the signer.
-- ============================================================================

alter table public.signature_events
  add column if not exists signer_on_behalf          boolean not null default false, -- signer acted for a different entity
  add column if not exists representative_company    text,   -- e.g. "Excel Co Ltd"
  add column if not exists representative_registration text,  -- rep company reg no. (optional)
  add column if not exists signer_authority_basis    text;   -- e.g. "Management agreement dated 01/01/2026" (optional)
