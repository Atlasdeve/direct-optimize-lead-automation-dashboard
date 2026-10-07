export type BrandedEmailInput = {
  brandName?: string;
  companyName?: string;
  preheader?: string;
  heading: string;
  body: string;
  highlightParagraph?: string;
  attachmentLabel?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctas?: Array<{ label: string; url: string; variant?: "primary" | "secondary" }>;
  defaultCtas?: Array<{ label: string; url: string; variant?: "primary" | "secondary" }>;
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

function trackingLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "link";
}

function trackedUrl(url: string, clickTrackingBaseUrl?: string, label = "link") {
  return clickTrackingBaseUrl
    ? `${clickTrackingBaseUrl}?url=${encodeURIComponent(url)}&link=${encodeURIComponent(trackingLabel(label))}`
    : url;
}

function linkifyText(text: string, clickTrackingBaseUrl?: string) {
  const escaped = escapeHtml(text);
  return escaped.replace(/https?:\/\/[^\s<>()]+/g, (url) => {
    const cleanUrl = url.replace(/&amp;/g, "&");
    const href = trackedUrl(cleanUrl, clickTrackingBaseUrl, "body link");
    return `<a href="${escapeHtml(href)}" style="color:#176baf;text-decoration:underline;">${url}</a>`;
  });
}

export const DIRECT_OPTIMIZE_OFFER = "We’re offering a complimentary 14-day Google Business Profile optimization. We’ll agree on priorities first and make changes only with your approval.";
export const SPECIALIST_WORK_ATTACHMENT_LINE = "I’ve attached examples of Google Business Profile work completed by our specialists.";

function paragraphHtml(body: string, clickTrackingBaseUrl?: string, highlightParagraph?: string, attachmentLabel?: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => Boolean(paragraph) && paragraph !== "To opt out of future messages, reply with Unsubscribe.")
    .map((paragraph) => paragraph === highlightParagraph
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e7f2fc" style="width:100%;table-layout:fixed;margin:21px 0;border:1px solid #ffffff;border-radius:16px;background-color:#e7f2fc;background-image:linear-gradient(125deg,rgba(219,242,252,.9),rgba(248,251,255,.92) 53%,rgba(238,234,255,.9));box-shadow:0 12px 28px rgba(77,123,169,.18);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);"><tr><td style="padding:19px 21px;overflow-wrap:break-word;"><div style="margin:0 0 8px;color:#336f9f;font-size:10px;line-height:1.4;font-weight:800;letter-spacing:.15em;text-transform:uppercase;">YOUR COMPLIMENTARY OFFER</div><p style="margin:0;color:#163650;font-size:17px;line-height:1.55;font-weight:700;">${linkifyText(paragraph, clickTrackingBaseUrl).replaceAll("\n", "<br />")}</p></td></tr></table>`
      : `<p style="margin:0 0 17px;color:#344d63;font-size:15px;line-height:1.7;overflow-wrap:break-word;">${linkifyText(paragraph, clickTrackingBaseUrl).replaceAll("\n", "<br />")}</p>${attachmentLabel && paragraph.includes(SPECIALIST_WORK_ATTACHMENT_LINE) ? `<div style="display:inline-block;max-width:100%;box-sizing:border-box;overflow-wrap:break-word;margin:0 0 18px;padding:10px 13px;border:1px solid #ffffff;border-radius:10px;background-color:#edf5fc;color:#365b74;font-size:12px;line-height:1.4;">PDF attached: ${escapeHtml(attachmentLabel)}</div>` : ""}`)
    .join("");
}

const defaultCtas = [
  { label: "Visit Direct Optimize", url: "https://directoptimize.com", variant: "primary" as const },
  { label: "Create Your Portal", url: "https://directoptimize.com/client-portal/", variant: "secondary" as const }
];

function emailCtas(input: BrandedEmailInput) {
  const fallbackCtas = input.defaultCtas ?? defaultCtas;
  const provided = [
    ...(input.ctas ?? []),
    input.ctaLabel && input.ctaUrl ? { label: input.ctaLabel, url: input.ctaUrl, variant: "primary" as const } : null
  ].filter((item): item is { label: string; url: string; variant?: "primary" | "secondary" } => Boolean(item));

  const merged = [...provided, ...fallbackCtas];
  const seen = new Set<string>();
  return merged
    .map((cta) => ({ ...cta, url: normalizeUrl(cta.url) }))
    .filter((cta): cta is { label: string; url: string; variant?: "primary" | "secondary" } => {
      if (!cta.url || seen.has(cta.url)) return false;
      seen.add(cta.url);
      return true;
    });
}

export function renderBrandedEmailHtml(input: BrandedEmailInput) {
  const brandName = input.brandName || "Direct Optimize";
  const companyName = input.companyName || brandName;
  const preheader = input.preheader || input.heading;
  const ctaButtons = emailCtas(input);
  const cta = ctaButtons.length
    ? `
      <tr>
        <td style="padding:10px 0 4px;">
          ${ctaButtons.map((button) => {
            const isSecondary = button.variant === "secondary";
            const style = isSecondary
              ? "display:inline-block;background-color:#f4f9fd;border:1px solid #ffffff;color:#265b80;text-decoration:none;font-weight:700;border-radius:11px;padding:13px 18px;font-size:14px;line-height:1.3;margin:0 10px 10px 0;"
              : "display:inline-block;background-color:#348fd4;background-image:linear-gradient(135deg,#2b83cf,#4b9bdd);border:1px solid #87c3ee;color:#ffffff;text-decoration:none;font-weight:700;border-radius:11px;padding:13px 18px;font-size:14px;line-height:1.3;margin:0 10px 10px 0;";
            return `<a href="${escapeHtml(trackedUrl(button.url, input.clickTrackingBaseUrl, button.label))}" style="${style}">${escapeHtml(button.label)}</a>`;
          }).join("")}
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
  <body style="margin:0;padding:0;background-color:#daeafa;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#daeafa" style="width:100%;table-layout:fixed;background-color:#daeafa;background-image:linear-gradient(145deg,#d6edfb,#e8e5f7);">
      <tr>
        <td align="center" style="padding:28px 12px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f8fd" style="width:100%;max-width:640px;table-layout:fixed;background-color:#f1f8fd;background-color:rgba(255,255,255,.76);background-image:linear-gradient(145deg,rgba(232,247,252,.83),rgba(248,252,255,.74) 55%,rgba(241,237,252,.82));border:1px solid #ffffff;border-radius:24px;overflow:hidden;box-shadow:0 26px 70px rgba(58,92,128,.24);backdrop-filter:blur(26px) saturate(160%);-webkit-backdrop-filter:blur(26px) saturate(160%);">
            <tr>
              <td height="4" bgcolor="#63b8fa" style="height:4px;background-color:#63b8fa;background-image:linear-gradient(90deg,#63b8fa,#9cdbed,#9b8bec);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:25px 30px 23px;border-bottom:1px solid #ffffff;background-color:#edf7fc;">
                <div style="color:#16314c;font-size:18px;line-height:1.3;font-weight:800;">${escapeHtml(brandName)}</div>
                <div style="margin-top:5px;color:#6c859a;font-size:10px;line-height:1.5;letter-spacing:.15em;text-transform:uppercase;font-weight:700;">A personal note for your business</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 30px 20px;">
                <div style="display:inline-block;padding:7px 11px;background-color:#f8fcff;border:1px solid #ffffff;border-radius:999px;color:#31688c;font-size:10px;line-height:1.3;letter-spacing:.13em;text-transform:uppercase;font-weight:700;">Local growth</div>
                <h1 style="margin:18px 0 0;color:#132f49;font-size:29px;line-height:1.25;font-weight:800;">${escapeHtml(input.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 18px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fbff" style="width:100%;table-layout:fixed;background-color:#f8fbff;background-color:rgba(255,255,255,.82);border:1px solid #ffffff;border-radius:17px;box-shadow:0 15px 34px rgba(84,128,164,.14);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);">
                  <tr><td style="padding:24px 23px 10px;">
                    ${paragraphHtml(input.body, input.clickTrackingBaseUrl, input.highlightParagraph, input.attachmentLabel)}
                  </td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:21px 30px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#eef6fc" style="padding:21px 30px 25px;background-color:#eef6fc;border-top:1px solid #ffffff;">
                <div style="color:#517087;font-size:13px;line-height:1.6;">
                  <strong style="color:#16314c;">${escapeHtml(companyName)}</strong><br />
                  Local growth, made more personal.
                </div>
                <div style="margin-top:13px;color:#6b8499;font-size:11px;line-height:1.6;">
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
    ...emailCtas(input).flatMap((cta) => ["", `${cta.label}: ${trackedUrl(cta.url, input.clickTrackingBaseUrl, cta.label)}`]),
    "",
    input.companyName || input.brandName || "Direct Optimize",
    "To opt out, reply with Unsubscribe."
  ].filter(Boolean).join("\n");
}
