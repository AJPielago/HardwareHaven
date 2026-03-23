const nodemailer = require('nodemailer');

let transporter = null;
let warnedAboutMailConfig = false;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtmlParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function hasFullHtmlDocument(html) {
  return /<html[\s>]|<body[\s>]/i.test(String(html || ''));
}

function buildEmailLayout({ subject, bodyHtml }) {
  const safeSubject = escapeHtml(subject || 'ShopApp Notification');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:24px 28px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">ShopApp</div>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:700;">${safeSubject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 12px;font-size:15px;line-height:1.6;color:#111827;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 26px;font-size:12px;line-height:1.5;color:#6b7280;">
                This is an automated message from ShopApp. If you need help, please contact support.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildHtmlForMail({ subject, text, html }) {
  if (html && hasFullHtmlDocument(html)) {
    return html;
  }

  const innerHtml = html || textToHtmlParagraphs(text);
  return buildEmailLayout({ subject, bodyHtml: innerHtml || '<p>No content</p>' });
}

function readMailConfig() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 2525);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const mailFrom = process.env.MAIL_FROM || 'ShopApp <no-reply@shopapp.local>';

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    mailFrom,
  };
}

function isSandboxSmtpHost(host) {
  const normalized = String(host || '').toLowerCase();
  return normalized.includes('sandbox.smtp.mailtrap.io');
}

function isPlaceholderCredential(value) {
  if (!value) return true;

  const normalized = String(value).trim().toLowerCase();
  return (
    normalized.includes('your_') ||
    normalized.includes('changeme') ||
    normalized.includes('example')
  );
}

function getTransporter() {
  const config = readMailConfig();
  const configured =
    config.smtpHost &&
    config.smtpPort &&
    config.smtpUser &&
    config.smtpPass &&
    !isPlaceholderCredential(config.smtpUser) &&
    !isPlaceholderCredential(config.smtpPass);

  if (!configured) {
    if (!warnedAboutMailConfig) {
      warnedAboutMailConfig = true;
      console.warn('[Mail] SMTP not configured with real credentials. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in backend/.env.');
    }
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!to) {
    console.warn('[Mail] Missing recipient. Skipping email.');
    return { sent: false, reason: 'missing-recipient' };
  }

  const config = readMailConfig();
  console.log(
    `[Mail] Attempting send to=${to} subject="${subject || '(no-subject)'}" host=${config.smtpHost || '(none)'} port=${config.smtpPort}`
  );
  if (isSandboxSmtpHost(config.smtpHost)) {
    console.log('[Mail] Using Mailtrap sandbox. Emails are delivered to Mailtrap inbox, not to real recipient inboxes like Gmail.');
  }

  const mailer = getTransporter();
  if (!mailer) {
    console.log(`[Mail] SMTP not configured. Skipping email: ${subject}`);
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const formattedHtml = buildHtmlForMail({ subject, text, html });
    await mailer.sendMail({
      from: config.mailFrom,
      to,
      subject,
      text,
      html: formattedHtml,
    });
    console.log(`[Mail] Sent successfully to=${to} subject="${subject || '(no-subject)'}"`);
  } catch (err) {
    if (err?.code === 'EAUTH' || err?.responseCode === 535) {
      console.error('[Mail] SMTP authentication failed. Check SMTP_USER/SMTP_PASS in backend/.env.');
      return { sent: false, reason: 'smtp-auth-failed' };
    }
    console.error('[Mail] Send failed:', err.message);
    throw err;
  }

  return { sent: true };
}

module.exports = { sendMail };