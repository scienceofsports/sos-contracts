-- ============================================================================
-- Authorised signatory for the Service Provider (SOS), so every contract is
-- executed as a genuine TWO-PARTY agreement. The company sets its signatory
-- once (name, title, signature image); the document, PDF and certificate then
-- always show BOTH the client's signature and SOS's counter-signature.
-- ============================================================================
alter table public.company
  add column if not exists signatory_name        text,
  add column if not exists signatory_title        text,
  add column if not exists signatory_signature    text;   -- base64 PNG data URL
