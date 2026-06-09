import { LOGO_WHITE_URL, COLORS } from "./brand-tokens"

/**
 * Wrap already-rendered body HTML (from the editor) in the Strydr marketing
 * brand shell: dark header band with the wordmark, white rounded body, dark
 * footer band with the Resend unsubscribe link. A string template (not a
 * react-email render) because the body is HTML, not JSX.
 */
export function wrapMarketingHtml(
  bodyHtml: string,
  opts: { preheader?: string } = {}
): string {
  const year = new Date().getFullYear()
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
    : ""
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:${COLORS.surface};font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;">
<tr><td style="background:${COLORS.ink};padding:24px 32px;">
<img src="${LOGO_WHITE_URL}" alt="Strydr" height="26" style="height:26px;width:auto;display:block;border:0;"/>
</td></tr>
<tr><td style="padding:32px;color:${COLORS.body};font-size:15px;line-height:1.6;">
${bodyHtml}
</td></tr>
<tr><td style="background:${COLORS.ink};padding:28px 32px;text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.5;">You're receiving this because you bought from Strydr. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${COLORS.green};text-decoration:underline;">Unsubscribe</a>.</p>
<p style="margin:12px 0 0;color:rgba(255,255,255,0.4);font-size:11px;">© ${year} Strydr · Redefining mobility</p>
</td></tr>
</table></td></tr></table></body></html>`
}
