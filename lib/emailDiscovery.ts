import * as cheerio from "cheerio";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BAD_EMAIL_PARTS = [
  "example.com",
  "sentry.io",
  "wixpress.com",
  "schema.org",
  "domain.com",
  "email.com",
  "yourdomain",
  "placeholder"
];
const CONTACT_PATH_HINTS = ["contact", "about", "team", "office", "location"];
const CONTACT_FORM_PATH_HINTS = ["contact", "appointment", "book", "request", "consultation"];
const BLOCKED_LINK_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "google.ca",
  "maps.google"
];

export type EmailDiscoveryResult = {
  website: string;
  pagesScanned: number;
  emails: string[];
  sourceUrls: string[];
  contactForms: string[];
  contactPages: string[];
  error?: string;
};

function normalizeWebsite(raw: string) {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol);
}

function isUsableEmail(email: string) {
  const lower = email.toLowerCase();
  if (BAD_EMAIL_PARTS.some((part) => lower.includes(part))) return false;
  if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(lower)) return false;
  return true;
}

function addEmail(emails: Map<string, Set<string>>, email: string, sourceUrl: string) {
  const clean = email.toLowerCase().replace(/^mailto:/, "").split("?")[0].trim();
  if (!isUsableEmail(clean)) return;
  if (!emails.has(clean)) emails.set(clean, new Set());
  emails.get(clean)?.add(sourceUrl);
}

function sameSiteUrl(base: URL, href: string) {
  try {
    const url = new URL(href, base);
    const host = url.hostname.replace(/^www\./, "");
    const baseHost = base.hostname.replace(/^www\./, "");
    if (host !== baseHost) return null;
    if (BLOCKED_LINK_HOSTS.some((blocked) => host.includes(blocked))) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

async function fetchHtml(url: URL, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DirectOptimizeLeadAutomation/1.0 (+https://directoptimize.com)",
        "Accept": "text/html,application/xhtml+xml"
      },
      signal: controller.signal,
      redirect: "follow"
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverEmailsFromWebsite(website: string): Promise<EmailDiscoveryResult> {
  const maxPages = Math.max(1, Math.min(Number(process.env.EMAIL_DISCOVERY_MAX_PAGES || 4), 8));
  const timeoutMs = Math.max(1500, Math.min(Number(process.env.EMAIL_DISCOVERY_TIMEOUT_MS || 8000), 15000));

  try {
    const base = normalizeWebsite(website);
    const queue = [base];
    const seen = new Set<string>();
    const emails = new Map<string, Set<string>>();
    const sourceUrls = new Set<string>();
    const contactForms = new Set<string>();
    const contactPages = new Set<string>();

    while (queue.length > 0 && seen.size < maxPages) {
      const current = queue.shift();
      if (!current || seen.has(current.href)) continue;
      seen.add(current.href);

      const html = await fetchHtml(current, timeoutMs);
      if (!html) continue;

      const $ = cheerio.load(html);
      const pageText = $.text();
      for (const match of pageText.match(EMAIL_PATTERN) ?? []) addEmail(emails, match, current.href);
      $("a[href^='mailto:']").each((_, element) => {
        const href = $(element).attr("href");
        if (href) addEmail(emails, href, current.href);
      });

      if (emails.size > 0) sourceUrls.add(current.href);
      if ($("form").length > 0) {
        const pathAndText = `${current.pathname} ${$("form").text()}`.toLowerCase();
        const hasContactHint = CONTACT_FORM_PATH_HINTS.some((hint) => pathAndText.includes(hint));
        const hasContactFields = $("input[type='email'], input[name*='email' i], textarea, input[name*='message' i]").length > 0;
        const isHomePage = current.pathname === "/" || current.pathname === "";
        if (hasContactHint || (isHomePage && hasContactFields)) contactForms.add(current.href);
      }
      if (CONTACT_PATH_HINTS.some((hint) => current.pathname.toLowerCase().includes(hint))) {
        contactPages.add(current.href);
      }

      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        const url = sameSiteUrl(base, href);
        if (!url || seen.has(url.href) || queue.some((item) => item.href === url.href)) return;
        const lowerPath = `${url.pathname} ${$(element).text()}`.toLowerCase();
        if (CONTACT_PATH_HINTS.some((hint) => lowerPath.includes(hint))) {
          contactPages.add(url.href);
          queue.push(url);
        }
      });
    }

    for (const sources of emails.values()) {
      for (const source of sources) sourceUrls.add(source);
    }

    return {
      website: base.href,
      pagesScanned: seen.size,
      emails: [...emails.keys()],
      sourceUrls: [...sourceUrls],
      contactForms: [...contactForms],
      contactPages: [...contactPages]
    };
  } catch (error) {
    return {
      website,
      pagesScanned: 0,
      emails: [],
      sourceUrls: [],
      contactForms: [],
      contactPages: [],
      error: error instanceof Error ? error.message : "Email discovery failed"
    };
  }
}
