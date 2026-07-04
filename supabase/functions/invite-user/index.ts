// ============================================================================
// invite-user  (ADMIN only)
//
// Creates a new staff member: a Supabase Auth user (via the admin API) plus a
// matching app_users profile row with the chosen role, then emails them their
// login details via Resend. The caller MUST be an authenticated admin — we
// verify their JWT and check is_admin() before doing anything.
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { sendEmail } from '../_shared/email.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function tempPassword(): string {
  // 16-char random password from a URL-safe alphabet.
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => abc[b % abc.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Not authorised.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    // Client bound to the caller's JWT — used only to identify + authorise them.
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authorised.');
    const callerId = userData.user.id;

    const admin = getAdminClient();
    // Verify the caller is an admin app_user.
    const { data: profile } = await admin.from('app_users').select('role').eq('id', callerId).maybeSingle();
    if (!profile || profile.role !== 'admin') throw new Error('Only admins can add users.');

    const body = await req.json();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const role = body.role === 'viewer' ? 'viewer' : 'admin';
    if (!name || !email) throw new Error('Name and email are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email.');

    // Reject if a profile already exists for this email.
    const { data: existing } = await admin.from('app_users').select('id').eq('email', email).maybeSingle();
    if (existing) throw new Error('A user with this email already exists.');

    // Create the auth user (email pre-confirmed) with a temporary password.
    const password = tempPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message || 'Could not create the user.');

    // Insert the profile row linked to the new auth user.
    const { error: profErr } = await admin.from('app_users').insert({
      id: created.user.id, name, email, role,
    });
    if (profErr) {
      // Roll back the auth user if the profile insert fails.
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profErr.message);
    }

    // Email the new user their login details.
    const appOrigin = body.appOrigin || 'https://contracts.scienceofsports.net';
    try {
      await sendEmail({
        to: email,
        subject: 'Your SOS Contracts account',
        html: `
          <p>Hello ${name},</p>
          <p>An account has been created for you on <strong>SOS Contracts</strong> (${role} access).</p>
          <p>Sign in here: <a href="${appOrigin}">${appOrigin}</a></p>
          <p>Your temporary password is:</p>
          <p style="font-size:20px;font-weight:700;background:#F1F5F9;padding:12px 16px;border-radius:8px;letter-spacing:1px;">${password}</p>
          <p>Please sign in and change it as soon as possible.</p>
        `,
      });
    } catch (_) { /* account still created; surface password to admin below */ }

    // Return the temp password so the admin can pass it on if the email fails.
    return json({ ok: true, id: created.user.id, email, role, tempPassword: password });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
