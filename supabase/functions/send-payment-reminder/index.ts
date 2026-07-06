// ============================================================================
// send-payment-reminder  (ADMIN only)
//
// Sends a REAL payment-reminder email to the client via Resend, with a tone
// that escalates by how overdue the payment is, and logs it to the payment's
// reminders_sent array. The caller must be an authenticated admin (JWT + role).
// ============================================================================
import { handleOptions, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { sendEmail, paymentReminderEmail } from '../_shared/email.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function fmtMoney(amount: unknown, currency = 'EUR'): string {
  const n = Number(amount || 0);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}
function fmtDate(iso: unknown): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  try {
    // --- Authorise: caller must be an authenticated ADMIN. ------------------
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Not authorised.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authorised.');

    const admin = getAdminClient();
    const { data: profile } = await admin.from('app_users').select('role').eq('id', userData.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') throw new Error('Only admins can send reminders.');

    const body = await req.json();
    const { paymentId } = body;
    if (!paymentId) throw new Error('paymentId is required');

    // Load the payment + its contract + client + company.
    const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
    if (!payment) throw new Error('Payment not found.');
    if (payment.status === 'paid') throw new Error('This payment is already paid.');

    const { data: contract } = await admin.from('contracts').select('client_id, title, currency').eq('id', payment.contract_id).maybeSingle();
    if (!contract) throw new Error('Contract not found.');
    const { data: client } = await admin.from('clients').select('*').eq('id', contract.client_id).maybeSingle();
    if (!client) throw new Error('Client not found.');
    const toEmail = client.contact_email;
    if (!toEmail) throw new Error('This client has no contact email on file.');

    const { data: company } = await admin.from('company').select('*').limit(1).maybeSingle();

    // Compute how overdue (whole days; <=0 means not yet due).
    const due = payment.due_date ? new Date(payment.due_date) : null;
    const daysOverdue = due ? Math.floor((Date.now() - due.getTime()) / 86400000) : 0;

    const currency = payment.currency || contract.currency || 'EUR';
    const bankLine = company && (company.bank_name || company.bank_iban)
      ? `Bank transfer — Account Name: ${company.name || 'C.C. Science of Sports Ltd'}${company.bank_name ? ` · Bank: ${company.bank_name}` : ''}${company.bank_iban ? ` · IBAN: ${company.bank_iban}` : ''}${company.bank_swift ? ` · SWIFT/BIC: ${company.bank_swift}` : ''}`
      : undefined;

    const html = paymentReminderEmail({
      contactName: client.contact_name || '',
      description: payment.description || contract.title || 'your outstanding payment',
      amount: fmtMoney(payment.total_amount ?? payment.amount, currency),
      dueDate: fmtDate(payment.due_date),
      daysOverdue,
      bankLine,
    });

    const subject = daysOverdue > 0 ? `Overdue payment notice — ${contract.title || 'Science of Sports'}` : `Payment reminder — ${contract.title || 'Science of Sports'}`;
    await sendEmail({ to: toEmail, subject, html });

    // Log the reminder to the payment (append to reminders_sent).
    const current = Array.isArray(payment.reminders_sent) ? payment.reminders_sent : [];
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), daysOverdue, to: toEmail, sent: true };
    await admin.from('payments').update({ reminders_sent: [...current, entry] }).eq('id', paymentId);

    return json({ ok: true, sentTo: toEmail, daysOverdue });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
