-- ============================================================================
-- OTP hardening — bound total brute-force attempts across code re-requests.
--
-- The per-code attempt cap (otp_attempts, reset on each new code) alone lets an
-- attacker loop {request code -> 5 guesses -> new code}. otp_total_attempts is a
-- cumulative counter that is NEVER reset by send-otp, so a signing request can be
-- locked after an absolute number of failed guesses regardless of re-requests.
-- Combined with a real 10-minute per-code expiry (enforced in verify-otp against
-- otp_sent_at), this bounds the guessing budget.
-- ============================================================================
alter table public.signing_requests
  add column if not exists otp_total_attempts integer not null default 0;
