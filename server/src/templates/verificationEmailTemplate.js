/**
 * File purpose: Builds reusable StockPulse-branded email verification templates.
 */
import { VERIFICATION_TOKEN_TTL_HOURS } from '../utils/emailVerification.js';

/**
 * Escapes dynamic text before placing it in the HTML email.
 * Email clients render raw HTML, so escaping user-controlled names avoids accidental markup injection.
 * @param {string} value - Text value that may contain HTML-sensitive characters.
 * @returns {string} HTML-safe text.
 */
function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Creates the subject, HTML body, and plain-text body for a verification email.
 * Keeping email markup in a template makes the controller easier to read and the design reusable.
 * @param {object} options - Template values used by the email.
 * @param {string} options.name - Account display name.
 * @param {string} options.verificationUrl - One-time email verification link.
 * @returns {{subject:string, html:string, text:string}} Complete email content for Resend.
 */
export function renderVerificationEmail({ name, verificationUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(verificationUrl);
  const expirationText = `${VERIFICATION_TOKEN_TTL_HOURS} hours`;

  return {
    subject: 'Verify your StockPulse Learn email',
    text: [
      `Welcome to StockPulse Learn, ${name || 'there'}!`,
      '',
      'Please verify your email address before logging in:',
      verificationUrl,
      '',
      `This link expires in ${expirationText}. If you did not create a StockPulse account, you can ignore this email.`,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify your StockPulse Learn email</title>
  </head>
  <body style="margin:0;background:#07101f;color:#edf7ff;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at 18% 0%,rgba(56,189,248,.22),transparent 32%),radial-gradient(circle at 82% 18%,rgba(139,92,246,.24),transparent 30%),#07101f;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid rgba(142,190,255,.22);border-radius:28px;background:linear-gradient(145deg,rgba(12,24,50,.88),rgba(5,10,24,.88));box-shadow:0 24px 70px rgba(0,0,0,.32);overflow:hidden;">
            <tr>
              <td style="padding:34px 32px 18px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="42" height="42" align="center" valign="middle" style="width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:15px;background:#6366f1;box-shadow:0 0 28px rgba(99,102,241,.24);">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto;">
                        <tr>
                          <td width="4" height="26" bgcolor="#f8fbff" style="width:4px;height:26px;border-radius:4px;background:#f8fbff;font-size:0;line-height:0;">&nbsp;</td>
                          <td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>
                          <td valign="bottom">
                            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                              <tr valign="bottom">
                                <td width="5" height="10" bgcolor="#f8fbff" style="width:5px;height:10px;border-radius:4px;background:#f8fbff;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="5" height="19" bgcolor="#f8fbff" style="width:5px;height:19px;border-radius:4px;background:#f8fbff;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="5" height="13" bgcolor="#f8fbff" style="width:5px;height:13px;border-radius:4px;background:#f8fbff;font-size:0;line-height:0;">&nbsp;</td>
                              </tr>
                              <tr>
                                <td colspan="5" height="4" bgcolor="#f8fbff" style="height:4px;border-radius:4px;background:#f8fbff;font-size:0;line-height:0;">&nbsp;</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
                    <td valign="middle">
                      <strong style="display:block;font-size:22px;line-height:1;color:#f8fbff;">StockPulse</strong>
                      <span style="display:block;margin-top:4px;color:#aab7ff;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Learn</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 12px;">
                <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.12;letter-spacing:-.03em;">Welcome, ${safeName}.</h1>
                <p style="margin:14px 0 0;color:#b8c7dd;font-size:16px;line-height:1.65;">Verify your email address to activate your StockPulse Learn account and keep your simulator workspace secure.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 8px;">
                <a href="${safeUrl}" style="display:inline-block;width:100%;max-width:320px;padding:15px 20px;border-radius:999px;background:linear-gradient(100deg,#38bdf8,#7c5cff 58%,#a855f7);color:#03101f;text-align:center;text-decoration:none;font-size:16px;font-weight:800;box-shadow:0 18px 42px rgba(56,189,248,.24);">Verify email</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 30px;">
                <p style="margin:0 0 10px;color:#91a4be;font-size:13px;line-height:1.55;">This verification link expires in ${expirationText}. If the button does not work, copy and paste this backup link into your browser:</p>
                <p style="margin:0;padding:14px;border:1px solid rgba(142,190,255,.18);border-radius:16px;background:rgba(255,255,255,.045);color:#7dd3fc;font-size:12px;line-height:1.55;word-break:break-all;">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;border-top:1px solid rgba(142,190,255,.14);color:#7f91aa;font-size:12px;line-height:1.55;">If you did not create a StockPulse Learn account, you can safely ignore this email.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}