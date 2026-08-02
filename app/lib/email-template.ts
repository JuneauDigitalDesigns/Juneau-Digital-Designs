import "server-only";
import { EMAIL, EMAIL_FONT, EMAIL_FONT_IMPORT } from "./email-tokens";

export function brandedEmailHtml(opts: {
  title: string;
  subtitle?: string;
  body: string;
  footerNote?: string;
}): string {
  const { title, subtitle, body, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <link rel="stylesheet" href="${EMAIL_FONT_IMPORT}" />
  <style>
    @import url('${EMAIL_FONT_IMPORT}');
  </style>
</head>
<body style="margin:0;padding:0;background:${EMAIL.canvas};font-family:${EMAIL_FONT.body};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${EMAIL.canvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:${EMAIL.accent2};border-radius:12px 12px 0 0;padding:20px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <img
                            src="https://juneaudigitaldesigns.com/JDD_logo.png"
                            alt="JDD"
                            width="32"
                            height="32"
                            style="display:block;width:32px;height:32px;object-fit:contain;"
                          />
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:${EMAIL_FONT.display};font-size:17px;font-weight:500;color:${EMAIL.onChrome};letter-spacing:0.01em;white-space:nowrap;">Juneau Digital Designs</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:${EMAIL.card};padding:36px 32px 32px;border-radius:0;border-left:1px solid ${EMAIL.rule};border-right:1px solid ${EMAIL.rule};">
              <h2 style="margin:0 0 6px;font-family:${EMAIL_FONT.display};font-size:24px;font-weight:500;color:${EMAIL.ink};letter-spacing:0.01em;line-height:1.2;">${title}</h2>
              ${subtitle ? `<p style="margin:0 0 20px;font-family:${EMAIL_FONT.body};font-size:13px;color:${EMAIL.fg3};">${subtitle}</p>` : ""}
              <div style="font-family:${EMAIL_FONT.body};color:${EMAIL.ink};font-size:14px;line-height:1.6;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${EMAIL.accent2};border-radius:0 0 12px 12px;padding:20px 32px;">
              <p style="margin:0 0 4px;font-family:${EMAIL_FONT.display};font-size:14px;color:${EMAIL.onChrome};font-weight:500;letter-spacing:0.01em;">Juneau Digital Designs LLC</p>
              <p style="margin:0 0 ${footerNote ? "10px" : "0"};font-family:${EMAIL_FONT.body};font-size:11px;color:${EMAIL.onChrome};">juneaudigitaldesigns.com</p>
              ${footerNote ? `<p style="margin:0;font-family:${EMAIL_FONT.body};font-size:10px;color:${EMAIL.onChrome};line-height:1.6;border-top:1px solid ${EMAIL.ruleOnChrome};padding-top:10px;">${footerNote}</p>` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
