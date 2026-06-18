export type BrandedEmailInput = {
  preheader?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  trackingPixelUrl?: string;
  clickTrackingBaseUrl?: string;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function trackedUrl(url: string, clickTrackingBaseUrl?: string) {
  return clickTrackingBaseUrl
    ? `${clickTrackingBaseUrl}?url=${encodeURIComponent(url)}`
    : url;
}

function linkifyText(text: string, clickTrackingBaseUrl?: string) {
  const escaped = escapeHtml(text);
  return escaped.replace(/https?:\/\/[^\s<>()]+/g, (url) => {
    const cleanUrl = url.replace(/&amp;/g, "&");
    const href = trackedUrl(cleanUrl, clickTrackingBaseUrl);
    return `<a href="${escapeHtml(href)}" style="color:#7dd3fc;text-decoration:underline;">${url}</a>`;
  });
}

function paragraphHtml(body: string, clickTrackingBaseUrl?: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#dbeafe;font-size:15px;line-height:1.7;">${linkifyText(paragraph, clickTrackingBaseUrl).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function renderBrandedEmailHtml(input: BrandedEmailInput) {
  const ctaUrl = normalizeUrl(input.ctaUrl);
  const preheader = input.preheader || input.heading;
  const cta = ctaUrl && input.ctaLabel
    ? `
      <tr>
        <td style="padding:10px 0 4px;">
          <a href="${escapeHtml(trackedUrl(ctaUrl, input.clickTrackingBaseUrl))}" style="display:inline-block;background:#38bdf8;color:#020617;text-decoration:none;font-weight:700;border-radius:10px;padding:13px 18px;font-size:14px;">${escapeHtml(input.ctaLabel)}</a>
        </td>
      </tr>`
    : "";
  const pixel = input.trackingPixelUrl
    ? `<img src="${escapeHtml(input.trackingPixelUrl)}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px;" />`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#020617;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px;background:#071426;border:1px solid rgba(148,163,184,.22);border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(2,6,23,.38);">
            <tr>
              <td style="padding:22px 24px;background:#082033;border-bottom:1px solid rgba(148,163,184,.18);">
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td>
                      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;font-weight:700;">Direct Optimize</div>
                      <div style="margin-top:4px;color:#f8fafc;font-size:18px;font-weight:700;">Lead Automation</div>
                    </td>
                    <td align="right">
                      <div style="display:inline-block;background:rgba(56,189,248,.14);border:1px solid rgba(125,211,252,.35);border-radius:999px;color:#bae6fd;font-size:12px;font-weight:700;padding:8px 12px;">Local Growth Audit</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(input.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 24px 18px;">
                ${paragraphHtml(input.body, input.clickTrackingBaseUrl)}
                <table role="presentation" cellPadding="0" cellSpacing="0">${cta}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#06111f;border-top:1px solid rgba(148,163,184,.18);">
                <div style="color:#cbd5e1;font-size:13px;line-height:1.6;">
                  <strong style="color:#f8fafc;">Direct Optimize</strong><br />
                  Local SEO, website audits, and compliant lead outreach.
                </div>
                <div style="margin-top:12px;color:#64748b;font-size:11px;line-height:1.5;">
                  You are receiving this because your business details appear publicly available. To opt out, reply with Unsubscribe.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${pixel}
  </body>
</html>`;
}

export function renderPlainTextEmail(input: BrandedEmailInput) {
  return [
    input.heading,
    "",
    input.body,
    input.ctaLabel && input.ctaUrl ? `\n${input.ctaLabel}: ${input.ctaUrl}` : "",
    "",
    "Direct Optimize",
    "To opt out, reply with Unsubscribe."
  ].filter(Boolean).join("\n");
}
