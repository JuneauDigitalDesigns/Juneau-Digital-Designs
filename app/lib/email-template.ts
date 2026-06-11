import "server-only";

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
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0f2f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#07101e;border-radius:12px 12px 0 0;padding:20px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <img
                            src="https://juneaudigitaldesigns.com/JDs_nobg.png"
                            alt="JDD"
                            width="28"
                            height="28"
                            style="display:block;width:28px;height:28px;object-fit:contain;"
                          />
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:15px;font-weight:600;color:#F5EDD6;letter-spacing:-0.01em;white-space:nowrap;">Juneau Digital Designs</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent rule -->
          <tr>
            <td style="background:#F5EDD6;height:2px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 32px;border-radius:0;">
              <h2 style="margin:0 0 6px;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:20px;font-weight:600;color:#0d1b2a;letter-spacing:-0.015em;line-height:1.2;">${title}</h2>
              ${subtitle ? `<p style="margin:0 0 20px;font-size:13px;color:#64748b;">${subtitle}</p>` : ""}
              <div style="color:#0d1b2a;font-size:14px;line-height:1.6;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#07101e;border-radius:0 0 12px 12px;padding:20px 32px;">
              <p style="margin:0 0 4px;font-size:12px;color:#F5EDD6;font-weight:500;">Juneau Digital Designs LLC</p>
              <p style="margin:0 0 ${footerNote ? "10px" : "0"};font-size:11px;color:rgba(244,246,251,0.45);">juneaudigitaldesigns.com</p>
              ${footerNote ? `<p style="margin:0;font-size:10px;color:rgba(244,246,251,0.35);line-height:1.6;border-top:1px solid rgba(244,246,251,0.10);padding-top:10px;">${footerNote}</p>` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
