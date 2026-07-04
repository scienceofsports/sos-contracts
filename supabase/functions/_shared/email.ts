// Resend email sender for Edge Functions. The API key is a SECRET and lives in
// the RESEND_API_KEY function secret — never in frontend code or git.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// From-address for all signing emails. Overridable via the SIGNING_FROM_EMAIL
// secret; defaults to the branded contracts address.
function fromAddress(): string {
  return Deno.env.get('SIGNING_FROM_EMAIL') || 'SOS Contracts <contracts@scienceofsports.net>';
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

// ---- Simple branded email templates (inline styles for mail-client safety) --
const WRAP = (inner: string) => `
<div style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#0A1628;padding:20px 28px;">
      <span style="color:#fff;font-weight:700;font-size:18px;">Science of Sports</span>
    </div>
    <div style="padding:28px;color:#0f172a;font-size:14px;line-height:1.6;">
      ${inner}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:12px;">
      C.C. Science of Sports Ltd · Cyprus · This is an automated message from SOS Contracts.
    </div>
  </div>
</div>`;

export function signRequestEmail(opts: {
  clientContactName: string;
  companyName: string;
  contractTitle: string;
  signUrl: string;
}): string {
  return WRAP(`
    <p>Dear ${opts.clientContactName || 'Sir/Madam'},</p>
    <p><strong>${opts.companyName}</strong> has prepared a contract for your review and electronic signature:</p>
    <p style="background:#F1F5F9;padding:12px 16px;border-radius:8px;font-weight:600;">${opts.contractTitle}</p>
    <p>Please click below to review the full agreement and sign securely. You'll be asked to confirm a short code sent to your email to verify your identity.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${opts.signUrl}" style="background:#2563EB;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">Review &amp; Sign Contract</a>
    </p>
    <p style="color:#64748b;font-size:13px;">This link is unique to you and valid for 7 days. If you weren't expecting this, you can safely ignore it.</p>
  `);
}

export function otpEmail(opts: { code: string; contractTitle: string }): string {
  return WRAP(`
    <p>Your verification code to sign <strong>${opts.contractTitle}</strong> is:</p>
    <p style="text-align:center;font-size:32px;font-weight:700;letter-spacing:6px;background:#F1F5F9;padding:16px;border-radius:8px;margin:20px 0;">${opts.code}</p>
    <p style="color:#64748b;font-size:13px;">This code expires in 10 minutes. Enter it on the signing page to continue. Do not share it with anyone.</p>
  `);
}

export function signedNotificationEmail(opts: {
  contractTitle: string;
  signerName: string;
  signerCompany: string;
  signedAt: string;
}): string {
  return WRAP(`
    <p>✅ A contract has just been <strong>signed</strong>.</p>
    <p style="background:#F1F5F9;padding:12px 16px;border-radius:8px;">
      <strong>${opts.contractTitle}</strong><br/>
      Signed by: ${opts.signerName} (${opts.signerCompany})<br/>
      When: ${opts.signedAt}
    </p>
    <p>The signed record and Certificate of Completion are available in SOS Contracts.</p>
  `);
}
