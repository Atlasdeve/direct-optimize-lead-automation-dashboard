import * as cheerio from "cheerio";
import type { Lead } from "@/lib/types";

export type LeadIntelligenceAudit = {
  auditedAt: string;
  website?: string | null;
  title?: string;
  metaDescription?: string;
  h1?: string;
  hasViewportMeta: boolean;
  hasRobotsTxt: boolean;
  hasSitemapXml: boolean;
  hasSchema: boolean;
  hasPhoneOnPage: boolean;
  hasEmailOnPage: boolean;
  formsCount: number;
  imagesCount: number;
  scriptsCount: number;
  internalLinksCount: number;
  socialLinks: string[];
  techStack: string[];
  roughSpeedScore: number;
  seoFlags: string[];
  fitSummary: string;
  recommendedPitch: string;
  error?: string;
};

function normalizeWebsite(raw: string) {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol);
}

async function fetchText(url: URL, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DirectOptimizeLeadIntelligence/1.0 (+https://directoptimize.com)",
        "Accept": "text/html,application/xhtml+xml,text/plain"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = response.ok ? await response.text() : "";
    return {
      ok: response.ok,
      status: response.status,
      contentType,
      text,
      elapsedMs: Date.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

function detectTech($: cheerio.CheerioAPI, html: string) {
  const lower = html.toLowerCase();
  const tech = new Set<string>();
  if (lower.includes("wp-content") || lower.includes("wordpress")) tech.add("WordPress");
  if (lower.includes("shopify")) tech.add("Shopify");
  if (lower.includes("wixstatic") || lower.includes("wix.com")) tech.add("Wix");
  if (lower.includes("squarespace")) tech.add("Squarespace");
  if (lower.includes("gtag(") || lower.includes("google-analytics") || lower.includes("googletagmanager")) tech.add("Google Analytics/Tag Manager");
  if (lower.includes("calendly")) tech.add("Calendly");
  if (lower.includes("jotform")) tech.add("Jotform");
  if (lower.includes("hubspot")) tech.add("HubSpot");
  if ($("form").length > 0) tech.add("Website forms");
  return [...tech];
}

function socialLinks($: cheerio.CheerioAPI) {
  const hosts = ["facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com", "youtube.com", "tiktok.com"];
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    if (hosts.some((host) => href.includes(host))) links.add(href);
  });
  return [...links].slice(0, 8);
}

function buildSeoFlags(input: {
  title?: string;
  metaDescription?: string;
  h1?: string;
  hasViewportMeta: boolean;
  hasSchema: boolean;
  hasPhoneOnPage: boolean;
  hasEmailOnPage: boolean;
  formsCount: number;
  roughSpeedScore: number;
  hasSitemapXml: boolean;
}) {
  const flags: string[] = [];
  if (!input.title || input.title.length < 20) flags.push("Weak or missing title tag");
  if (!input.metaDescription || input.metaDescription.length < 70) flags.push("Weak or missing meta description");
  if (!input.h1) flags.push("Missing H1 headline");
  if (!input.hasViewportMeta) flags.push("Missing mobile viewport meta tag");
  if (!input.hasSchema) flags.push("No schema markup detected");
  if (!input.hasPhoneOnPage) flags.push("Phone number not visible on homepage");
  if (!input.hasEmailOnPage && input.formsCount === 0) flags.push("No obvious email or contact form on homepage");
  if (input.roughSpeedScore < 55) flags.push("Homepage may be heavy or slow");
  if (!input.hasSitemapXml) flags.push("Sitemap not detected");
  return flags;
}

function buildFitSummary(lead: Lead, flags: string[], contactSignals: number) {
  const strengths = [
    lead.rating ? `${lead.rating} rating` : null,
    lead.review_count ? `${lead.review_count} reviews` : null,
    lead.website ? "has a website to audit" : "may need website help",
    contactSignals > 0 ? "has reachable contact paths" : null
  ].filter(Boolean).join(", ");

  const topFlags = flags.slice(0, 3).join(", ").toLowerCase();
  const issueText = topFlags ? ` Main visible opportunities: ${topFlags}.` : " No major homepage issues were detected from the quick scan.";
  return `${lead.company_name} looks like a ${lead.category || lead.business_type || "local business"} lead in ${lead.city || lead.region}.${strengths ? ` Signals: ${strengths}.` : ""}${issueText}`;
}

function recommendedPitch(lead: Lead, flags: string[]) {
  if (flags.some((flag) => flag.toLowerCase().includes("meta") || flag.toLowerCase().includes("schema") || flag.toLowerCase().includes("h1"))) {
    return "Lead with a quick local SEO and homepage metadata audit.";
  }
  if (flags.some((flag) => flag.toLowerCase().includes("phone") || flag.toLowerCase().includes("contact"))) {
    return "Lead with conversion fixes around contact visibility and enquiry flow.";
  }
  if (!lead.website) return "Lead with a fast website and Google Business Profile visibility offer.";
  return "Lead with a local visibility and conversion audit.";
}

export async function auditLeadWebsite(lead: Lead): Promise<LeadIntelligenceAudit> {
  if (!lead.website) {
    const flags = ["No website detected"];
    return {
      auditedAt: new Date().toISOString(),
      website: null,
      hasViewportMeta: false,
      hasRobotsTxt: false,
      hasSitemapXml: false,
      hasSchema: false,
      hasPhoneOnPage: false,
      hasEmailOnPage: false,
      formsCount: 0,
      imagesCount: 0,
      scriptsCount: 0,
      internalLinksCount: 0,
      socialLinks: [],
      techStack: [],
      roughSpeedScore: 0,
      seoFlags: flags,
      fitSummary: buildFitSummary(lead, flags, 0),
      recommendedPitch: recommendedPitch(lead, flags)
    };
  }

  try {
    const base = normalizeWebsite(lead.website);
    const [home, robots, sitemap] = await Promise.all([
      fetchText(base),
      fetchText(new URL("/robots.txt", base), 5000).catch(() => null),
      fetchText(new URL("/sitemap.xml", base), 5000).catch(() => null)
    ]);

    if (!home.ok || !home.contentType.includes("text/html")) {
      throw new Error(`Website returned HTTP ${home.status || "unknown"} or non-HTML content`);
    }

    const $ = cheerio.load(home.text);
    const title = $("title").first().text().trim();
    const metaDescription = $("meta[name='description']").attr("content")?.trim() ?? "";
    const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
    const pageText = $.text();
    const hasViewportMeta = $("meta[name='viewport']").length > 0;
    const hasSchema = $("script[type='application/ld+json']").length > 0 || home.text.includes("schema.org");
    const hasPhoneOnPage = /(\+?\d[\d().\-\s]{7,}\d)/.test(pageText);
    const hasEmailOnPage = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(pageText);
    const formsCount = $("form").length;
    const imagesCount = $("img").length;
    const scriptsCount = $("script[src]").length;
    const internalLinksCount = $("a[href^='/'], a[href^='./'], a[href^='../']").length;
    const roughSpeedScore = Math.max(10, Math.min(100, 100 - Math.round(home.elapsedMs / 120) - Math.round(home.text.length / 50000) - Math.max(0, imagesCount - 8) * 2 - Math.max(0, scriptsCount - 10)));
    const detectedSocialLinks = socialLinks($);
    const techStack = detectTech($, home.text);
    const hasRobotsTxt = Boolean(robots?.ok && robots.text.trim());
    const hasSitemapXml = Boolean(sitemap?.ok && sitemap.text.trim());
    const seoFlags = buildSeoFlags({
      title,
      metaDescription,
      h1,
      hasViewportMeta,
      hasSchema,
      hasPhoneOnPage,
      hasEmailOnPage,
      formsCount,
      roughSpeedScore,
      hasSitemapXml
    });

    return {
      auditedAt: new Date().toISOString(),
      website: base.href,
      title,
      metaDescription,
      h1,
      hasViewportMeta,
      hasRobotsTxt,
      hasSitemapXml,
      hasSchema,
      hasPhoneOnPage,
      hasEmailOnPage,
      formsCount,
      imagesCount,
      scriptsCount,
      internalLinksCount,
      socialLinks: detectedSocialLinks,
      techStack,
      roughSpeedScore,
      seoFlags,
      fitSummary: buildFitSummary(lead, seoFlags, Number(hasPhoneOnPage) + Number(hasEmailOnPage) + formsCount),
      recommendedPitch: recommendedPitch(lead, seoFlags)
    };
  } catch (error) {
    const flags = ["Website audit failed"];
    return {
      auditedAt: new Date().toISOString(),
      website: lead.website,
      hasViewportMeta: false,
      hasRobotsTxt: false,
      hasSitemapXml: false,
      hasSchema: false,
      hasPhoneOnPage: false,
      hasEmailOnPage: false,
      formsCount: 0,
      imagesCount: 0,
      scriptsCount: 0,
      internalLinksCount: 0,
      socialLinks: [],
      techStack: [],
      roughSpeedScore: 0,
      seoFlags: flags,
      fitSummary: buildFitSummary(lead, flags, 0),
      recommendedPitch: recommendedPitch(lead, flags),
      error: error instanceof Error ? error.message : "Website audit failed"
    };
  }
}
