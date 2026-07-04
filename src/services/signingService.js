/* =========================================================================
   SIGNING SERVICE (Stage 4-5)
   -------------------------------------------------------------------------
   Thin client wrapper over the Supabase Edge Functions that run the
   evidence-grade signing flow. The admin app calls createSigningRequest;
   the public signing page calls the get/otp/verify/record functions with a
   token (no login required — the token IS the scope).

   All calls go through supabase.functions.invoke, which targets
   <project>.functions.supabase.co and passes the anon key automatically.
   ========================================================================= */

import { supabase } from '../lib/supabase.js';

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Edge Functions return { error: message } with a 400 on failure; supabase
    // surfaces that as a FunctionsHttpError whose context holds the response.
    let msg = error.message || 'Request failed';
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) msg = parsed.error;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const signingService = {
  // ADMIN: create a signing request for a contract and email the client.
  // appOrigin is the public origin the ?req= link should point at.
  createSigningRequest: async (contractId, appOrigin) =>
    invoke('create-signing-request', { contractId, appOrigin }),

  // PUBLIC: fetch the frozen document snapshot for a signing token.
  getSigningRequest: async (token) =>
    invoke('get-signing-request', { token }),

  // PUBLIC: email the signer a 6-digit verification code.
  sendOtp: async (token) => invoke('send-otp', { token }),

  // PUBLIC: verify the 6-digit code.
  verifyOtp: async (token, code) => invoke('verify-otp', { token, code }),

  // PUBLIC: record the signature (the core evidence write).
  recordSignature: async (token, payload) =>
    invoke('record-signature', { token, ...payload }),
};
