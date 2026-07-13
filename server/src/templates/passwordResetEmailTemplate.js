/**
 * File purpose: Builds the responsive StockPulse password-reset email sent through Resend.
 */
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from '../utils/passwordReset.js';

/**
 * Escapes user-controlled text before inserting it into email HTML.
 * @param {string} value - Text that may contain HTML-sensitive characters.
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
 * Creates the subject, HTML body, and plain-text fallback for a password-reset message.
 * @param {object} options - Template values.
 * @param {string} options.name - Account display name.
 * @param {string} options.resetUrl - One-time frontend reset link.
 * @returns {{subject:string, html:string, text:string}} Complete email content for Resend.
 */
export function renderPasswordResetEmail({ name, resetUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset your StockPulse Learn password',
    text: [
      `Hello ${name || 'there'},`,
      '',
      'Use this secure link to reset your StockPulse Learn password:',
      resetUrl,
      '',
      `This link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes and can be used once.`,
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>Reset your StockPulse Learn password</title>
    <style>
      :root { color-scheme: dark light; supported-color-schemes: dark light; }
      .email-body, .email-canvas { background-color: #07101f !important; }
      .email-card { background-color: #0b1730 !important; background-image: none !important; border-color: #20365d !important; box-shadow: none !important; }
      .email-brand, .email-title { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
      .email-copy { color: #b8c7dd !important; -webkit-text-fill-color: #b8c7dd !important; }
      .email-muted { color: #91a4be !important; -webkit-text-fill-color: #91a4be !important; }
      .email-footer { color: #7f91aa !important; -webkit-text-fill-color: #7f91aa !important; border-color: #1a2b49 !important; }
      .email-action { color: #03101f !important; -webkit-text-fill-color: #03101f !important; }
      [data-ogsc] .email-body, [data-ogsc] .email-canvas { background-color: #07101f !important; }
      [data-ogsc] .email-card { background-color: #0b1730 !important; background-image: none !important; border-color: #20365d !important; box-shadow: none !important; }
      @media (prefers-color-scheme: dark) {
        .email-body, .email-canvas { background-color: #07101f !important; }
        .email-card { background-color: #0b1730 !important; background-image: none !important; border-color: #20365d !important; box-shadow: none !important; }
      }
      @media only screen and (max-width: 480px) {
        .email-canvas { padding: 16px 8px !important; }
        .email-content { padding-left: 20px !important; padding-right: 20px !important; }
        .email-title { font-size: 26px !important; }
      }
    </style>
  </head>
  <body class="email-body" bgcolor="#07101f" style="margin:0;background-color:#07101f;color:#edf7ff;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
    <table class="email-canvas" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#07101f" style="background-color:#07101f;padding:28px 12px;">
      <tr>
        <td align="center">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#0b1730" style="max-width:620px;border:1px solid #20365d;border-radius:28px;background-color:#0b1730;background-image:none;box-shadow:none;overflow:hidden;">
            <tr>
              <td class="email-content" style="padding:34px 32px 18px;">
                <strong class="email-brand" style="display:block;color:#ffffff;font-size:22px;line-height:1.2;">StockPulse Learn</strong>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:8px 32px 12px;">
                <h1 class="email-title" style="margin:0;color:#ffffff;font-size:30px;line-height:1.16;">Reset your password</h1>
                <p class="email-copy" style="margin:14px 0 0;color:#b8c7dd;font-size:16px;line-height:1.65;">Hello ${safeName}. Use the button below to choose a new password for your account.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 24px 10px;">
                <a class="email-action" href="${safeUrl}" style="display:block;box-sizing:border-box;width:100%;max-width:320px;padding:15px 18px;border-radius:999px;background-color:#5e8df6;background-image:linear-gradient(100deg,#38bdf8,#7c5cff 58%,#a855f7);color:#03101f;-webkit-text-fill-color:#03101f;text-align:center;text-decoration:none;font-size:16px;font-weight:800;box-shadow:none;">Reset password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 30px;">
                <p class="email-muted" style="margin:0;color:#91a4be;font-size:13px;line-height:1.55;text-align:center;">This link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes and can be used once.</p>
              </td>
            </tr>
            <tr>
              <td class="email-content email-footer" style="padding:18px 32px 28px;border-top:1px solid #1a2b49;color:#7f91aa;font-size:12px;line-height:1.55;">If you did not request this change, you can safely ignore this email. Your current password will remain unchanged.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
