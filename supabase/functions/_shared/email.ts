// Resend email sender for Edge Functions. The API key is a SECRET and lives in
// the RESEND_API_KEY function secret — never in frontend code or git.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// From-address for all signing emails. Overridable via the SIGNING_FROM_EMAIL
// secret; defaults to the branded contracts address.
function fromAddress(): string {
  return Deno.env.get('SIGNING_FROM_EMAIL') || 'Science of Sports <info@scienceofsports.net>';
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: string }[]; // content = base64
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
      ...(opts.attachments && opts.attachments.length ? { attachments: opts.attachments } : {}),
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
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;">
    <!-- Navy header band -->
    <div style="background:#0A1A3F;padding:22px 30px;">
      <span style="color:#fff;font-weight:800;font-size:19px;letter-spacing:.02em;">SCIENCE OF SPORTS</span>
    </div>
    <!-- Signature rainbow hairline -->
    <div style="height:4px;background:linear-gradient(90deg,#22C7E6 0%,#2563EB 32%,#8B5CF6 62%,#EC4899 100%);"></div>
    <!-- Body -->
    <div style="padding:30px;color:#0f172a;font-size:14px;line-height:1.65;">
      ${inner}
    </div>
    <!-- Navy footer band -->
    <div style="background:#0A1A3F;padding:18px 30px;color:#A9B6CC;font-size:12px;line-height:1.5;">
      <div style="color:#fff;font-weight:600;margin-bottom:2px;">C.C. Science of Sports Ltd</div>
      Michalaki Karaoli, Anemomylos Building, Floor 5, 1095 Nicosia, Cyprus<br/>
      info@scienceofsports.net · +357 22 396997 · HE 449875
      <div style="color:#22C7E6;font-style:italic;font-weight:600;margin-top:10px;">Transforming matches into knowledge.</div>
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
      <a href="${opts.signUrl}" style="background:#22C7E6;color:#0A1A3F;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block;">Review &amp; Sign Contract</a>
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
    <p>The Certificate of Completion (with the full evidence record) is attached to this email, and the signed record is available in SOS Contracts.</p>
  `);
}

// Notification sent to STAFF when a signer declines / requests changes.
export function declinedNotificationEmail(opts: {
  contractTitle: string;
  signerEmail: string;
  reason: string;
}): string {
  return WRAP(`
    <p>⚠️ A contract was <strong>declined</strong> by the client.</p>
    <p style="background:#F1F5F9;padding:12px 16px;border-radius:8px;">
      <strong>${opts.contractTitle}</strong><br/>
      Declined by: ${opts.signerEmail}
    </p>
    ${opts.reason ? `<p><strong>Reason / changes requested:</strong><br/>${opts.reason}</p>` : `<p style="color:#64748b;font-size:13px;">No reason was provided.</p>`}
    <p>Open SOS Contracts to resend a fresh link or recall the contract to draft to revise it.</p>
  `);
}

// Confirmation sent to the SIGNER after they sign, with the certificate PDF.
export function signerConfirmationEmail(opts: {
  signerName: string;
  companyName: string;
  contractTitle: string;
  signedAt: string;
}): string {
  return WRAP(`
    <p>Dear ${opts.signerName || 'Sir/Madam'},</p>
    <p>Thank you — you have successfully signed the following agreement with <strong>${opts.companyName}</strong>:</p>
    <p style="background:#F1F5F9;padding:12px 16px;border-radius:8px;font-weight:600;">${opts.contractTitle}</p>
    <p>Signed on <strong>${opts.signedAt}</strong> (UTC).</p>
    <p>Your <strong>Certificate of Completion</strong> is attached to this email for your records. It contains the full signature evidence, including the document integrity hash. Please keep it safe.</p>
    <p>If you have any questions about this agreement, simply reply to this email.</p>
    <p>With thanks,<br/>The Science of Sports team</p>
  `);
}
