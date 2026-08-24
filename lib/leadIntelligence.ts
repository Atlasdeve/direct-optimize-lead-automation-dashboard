import * as cheerio from "cheerio";
import type { Lead } from "@/lib/types";

export type LeadIntelligenceAudit = {
  auditedAt: string;
  website?: string | null;
  finalUrl?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  pageSizeKb?: number;
  title?: string;
  metaDescription?: string;
  h1?: string;
  hasViewportMeta: boolean;
  hasRobotsTxt: boolean;
  hasSitemapXml: boolean;
  hasSchema: boolean;
  schemaTypes?: string[];
  hasCanonical?: boolean;
  hasIndexableRobotsMeta?: boolean;
  hasOpenGraph?: boolean;
  hasPhoneOnPage: boolean;
  hasEmailOnPage: boolean;
  formsCount: number;
  imagesCount: number;
  imagesMissingAlt?: number;
  scriptsCount: number;
  internalLinksCount: number;
  externalLinksCount?: number;
  pagesScanned?: Array<{ url: string; title?: string; status?: number; issueCount: number }>;
  scoreBreakdown?: Array<{ label: string; score: number; detail: string }>;
  overallScore?: number;
  contentWordCount?: number;
  headingsCount?: number;
  contactPageFound?: boolean;
  bookingSignalFound?: boolean;
  localSignalsCount?: number;
  trustSignalsCount?: number;
  securityHeaders?: Array<{ label: string; present: boolean }>;
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
      url: response.url,
      contentType,
      text,
      headers: response.headers,
      elapsedMs: Date.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

type FetchedPage = Awaited<ReturnType<typeof fetchText>>;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseJsonLdItems($: cheerio.CheerioAPI) {
  return $("script[type='application/ld+json']").toArray().flatMap((element) => {
    try {
      const parsed = JSON.parse($(element).text() || "{}");
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
    } catch {
      return [];
    }
  });
}

function schemaTypesFromItems(items: Array<Record<string, unknown>>) {
  return [...new Set(items.flatMap((item) => {
    const type = item?.["@type"];
    if (Array.isArray(type)) return type.map(String);
    return type ? [String(type)] : [];
  }))].slice(0, 10);
}

function visibleText($: cheerio.CheerioAPI) {
  $("script, style, noscript, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function wordCount(text: string) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function absoluteInternalUrl(raw: string, base: URL) {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function scoreMeta(title: string, metaDescription: string, h1Count: number, hasCanonical: boolean, hasIndexableRobotsMeta: boolean, hasOpenGraph: boolean) {
  let score = 100;
  if (!title) score -= 25;
  else if (title.length < 30 || title.length > 65) score -= 12;
  if (!metaDescription) score -= 25;
  else if (metaDescription.length < 90 || metaDescription.length > 170) score -= 12;
  if (h1Count === 0) score -= 18;
  if (h1Count > 1) score -= 8;
  if (!hasCanonical) score -= 8;
  if (!hasIndexableRobotsMeta) score -= 12;
  if (!hasOpenGraph) score -= 7;
  return clampScore(score);
}

function scoreTechnical(input: { hasViewportMeta: boolean; hasSchema: boolean; hasRobotsTxt: boolean; hasSitemapXml: boolean; securityHeadersPresent: number; securityHeadersTotal: number }) {
  let score = 100;
  if (!input.hasViewportMeta) score -= 20;
  if (!input.hasSchema) score -= 20;
  if (!input.hasRobotsTxt) score -= 12;
  if (!input.hasSitemapXml) score -= 15;
  score -= Math.max(0, input.securityHeadersTotal - input.securityHeadersPresent) * 5;
  return clampScore(score);
}

function scoreContent(input: { words: number; headings: number; images: number; imagesMissingAlt: number; internalLinks: number; localSignals: number }) {
  let score = 100;
  if (input.words < 250) score -= 25;
  else if (input.words < 500) score -= 10;
  if (input.headings < 3) score -= 12;
  if (input.images > 0 && input.imagesMissingAlt / input.images > 0.35) score -= 15;
  if (input.internalLinks < 5) score -= 12;
  if (input.localSignals < 2) score -= 12;
  return clampScore(score);
}

function scoreConversion(input: { hasPhoneOnPage: boolean; hasEmailOnPage: boolean; formsCount: number; contactPageFound: boolean; bookingSignalFound: boolean; trustSignalsCount: number }) {
  let score = 100;
  if (!input.hasPhoneOnPage) score -= 22;
  if (!input.hasEmailOnPage && input.formsCount === 0) score -= 22;
  if (!input.contactPageFound) score -= 14;
  if (!input.bookingSignalFound) score -= 14;
  if (input.trustSignalsCount < 2) score -= 12;
  return clampScore(score);
}

function issue(label: string, severity: "critical" | "medium" | "low" = "medium") {
  return severity === "critical" ? `${label} (high priority)` : label;
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
  h1Count?: number;
  hasCanonical?: boolean;
  hasIndexableRobotsMeta?: boolean;
  hasOpenGraph?: boolean;
  hasViewportMeta: boolean;
  hasSchema: boolean;
  schemaTypes?: string[];
  hasPhoneOnPage: boolean;
  hasEmailOnPage: boolean;
  formsCount: number;
  roughSpeedScore: number;
  hasSitemapXml: boolean;
  hasRobotsTxt?: boolean;
  imagesCount?: number;
  imagesMissingAlt?: number;
  contactPageFound?: boolean;
  bookingSignalFound?: boolean;
  contentWordCount?: number;
  localSignalsCount?: number;
  overallScore?: number;
}) {
  const flags: string[] = [];
  if (!input.title) flags.push(issue("Missing title tag", "critical"));
  else if (input.title.length < 30) flags.push("Title tag is too short for strong search snippets");
  else if (input.title.length > 65) flags.push("Title tag may be too long for search snippets");
  if (!input.metaDescription) flags.push(issue("Missing meta description", "critical"));
  else if (input.metaDescription.length < 90) flags.push("Meta description is too short to sell the service clearly");
  else if (input.metaDescription.length > 170) flags.push("Meta description may be truncated in search results");
  if (!input.h1) flags.push(issue("Missing H1 headline", "critical"));
  if ((input.h1Count ?? 1) > 1) flags.push("Multiple H1 headlines detected");
  if (input.hasCanonical === false) flags.push("Canonical URL tag not detected");
  if (input.hasIndexableRobotsMeta === false) flags.push(issue("Robots meta may block indexing", "critical"));
  if (input.hasOpenGraph === false) flags.push("Open Graph/social preview metadata not detected");
  if (!input.hasViewportMeta) flags.push(issue("Missing mobile viewport meta tag", "critical"));
  if (!input.hasSchema) flags.push(issue("No structured schema markup detected", "critical"));
  if (input.hasSchema && input.schemaTypes?.length && !input.schemaTypes.some((type) => /localbusiness|organization|restaurant|store|medicalbusiness|dentist|professionalservice/i.test(type))) {
    flags.push("Schema exists but local business schema was not detected");
  }
  if (!input.hasPhoneOnPage) flags.push(issue("Phone number not visible on scanned pages", "critical"));
  if (!input.hasEmailOnPage && input.formsCount === 0) flags.push(issue("No obvious email or contact form on scanned pages", "critical"));
  if (input.contactPageFound === false) flags.push("Dedicated contact page not detected");
  if (input.bookingSignalFound === false) flags.push("Clear booking/quote call-to-action not detected");
  if (input.roughSpeedScore < 55) flags.push(issue("Homepage may be heavy or slow", "critical"));
  else if (input.roughSpeedScore < 75) flags.push("Homepage performance could be improved");
  if (!input.hasSitemapXml) flags.push("Sitemap not detected");
  if (input.hasRobotsTxt === false) flags.push("Robots.txt not detected");
  if ((input.imagesCount ?? 0) > 0 && (input.imagesMissingAlt ?? 0) / (input.imagesCount ?? 1) > 0.35) flags.push("Many images are missing alt text");
  if ((input.contentWordCount ?? 0) > 0 && (input.contentWordCount ?? 0) < 250) flags.push("Homepage has thin written content");
  if ((input.localSignalsCount ?? 0) < 2) flags.push("Local city/service signals are weak");
  if ((input.overallScore ?? 100) < 55) flags.unshift("Website needs a deep SEO and conversion cleanup");
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
      externalLinksCount: 0,
      scoreBreakdown: [
        { label: "SEO metadata", score: 0, detail: "No website to inspect." },
        { label: "Technical SEO", score: 0, detail: "No website to inspect." },
        { label: "Content depth", score: 0, detail: "No website to inspect." },
        { label: "Conversion path", score: 0, detail: "No website to inspect." }
      ],
      overallScore: 0,
      contentWordCount: 0,
      headingsCount: 0,
      contactPageFound: false,
      bookingSignalFound: false,
      localSignalsCount: 0,
      trustSignalsCount: 0,
      securityHeaders: [],
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
    const h1Count = $("h1").length;
    const headingsCount = $("h1,h2,h3").length;
    const pageText = visibleText($);
    const contentWordCount = wordCount(pageText);
    const hasViewportMeta = $("meta[name='viewport']").length > 0;
    const jsonLdItems = parseJsonLdItems($) as Array<Record<string, unknown>>;
    const schemaTypes = schemaTypesFromItems(jsonLdItems);
    const hasSchema = jsonLdItems.length > 0 || home.text.includes("schema.org");
    const hasCanonical = Boolean($("link[rel='canonical']").attr("href"));
    const robotsMeta = ($("meta[name='robots']").attr("content") || "").toLowerCase();
    const hasIndexableRobotsMeta = !/(noindex|none)/.test(robotsMeta);
    const hasOpenGraph = $("meta[property^='og:']").length > 0;
    const hasPhoneOnPage = /(\+?\d[\d().\-\s]{7,}\d)/.test(pageText);
    const hasEmailOnPage = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(pageText);
    const formsCount = $("form").length;
    const imagesCount = $("img").length;
    const imagesMissingAlt = $("img").toArray().filter((element) => !($(element).attr("alt") || "").trim()).length;
    const scriptsCount = $("script[src]").length;
    const allLinks = $("a[href]").toArray().map((element) => $(element).attr("href") || "");
    const internalUrls = allLinks.map((href) => absoluteInternalUrl(href, base)).filter((url): url is URL => Boolean(url));
    const internalLinksCount = internalUrls.length;
    const externalLinksCount = allLinks.length - internalLinksCount;
    const contactCandidates = [...new Set(internalUrls.filter((url) => /contact|appointment|book|quote|estimate|service|about/i.test(url.pathname)).map((url) => url.href))].slice(0, 3);
    const secondaryPages = (await Promise.all(contactCandidates.map((url) => fetchText(new URL(url), 6000).catch(() => null)))).filter((item): item is FetchedPage => Boolean(item?.ok && item.contentType.includes("text/html")));
    const secondaryText = secondaryPages.map((page) => cheerio.load(page.text).text()).join(" ");
    const combinedText = `${pageText} ${secondaryText}`.replace(/\s+/g, " ");
    const hasPhoneOnScannedPages = hasPhoneOnPage || /(\+?\d[\d().\-\s]{7,}\d)/.test(secondaryText);
    const hasEmailOnScannedPages = hasEmailOnPage || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(secondaryText);
    const contactPageFound = contactCandidates.some((url) => /contact/i.test(url));
    const bookingSignalFound = /book|appointment|schedule|quote|estimate|consultation|call now|get started|request/i.test(combinedText);
    const localTerms = [lead.city, lead.country, lead.region, lead.category, lead.business_type].filter(Boolean).map((term) => String(term).toLowerCase());
    const lowerCombinedText = combinedText.toLowerCase();
    const localSignalsCount = localTerms.filter((term) => lowerCombinedText.includes(term)).length;
    const detectedSocialLinks = socialLinks($);
    const trustSignalsCount = [
      /review|testimonial|case stud|portfolio/i.test(combinedText),
      /licensed|insured|certified|award|guarantee/i.test(combinedText),
      /years? (of )?experience|since \d{4}/i.test(combinedText),
      detectedSocialLinks.length > 0
    ].filter(Boolean).length;
    const roughSpeedScore = clampScore(100 - Math.round(home.elapsedMs / 120) - Math.round(home.text.length / 45000) - Math.max(0, imagesCount - 10) * 2 - Math.max(0, scriptsCount - 12));
    const techStack = detectTech($, home.text);
    const hasRobotsTxt = Boolean(robots?.ok && robots.text.trim());
    const hasSitemapXml = Boolean(sitemap?.ok && sitemap.text.trim()) || Boolean(robots?.text.match(/sitemap:\s*\S+/i));
    const securityHeaders = [
      { label: "HTTPS", present: base.protocol === "https:" || new URL(home.url || base.href).protocol === "https:" },
      { label: "HSTS", present: Boolean(home.headers.get("strict-transport-security")) },
      { label: "CSP", present: Boolean(home.headers.get("content-security-policy")) },
      { label: "X-Frame-Options", present: Boolean(home.headers.get("x-frame-options")) }
    ];
    const metadataScore = scoreMeta(title, metaDescription, h1Count, hasCanonical, hasIndexableRobotsMeta, hasOpenGraph);
    const technicalScore = scoreTechnical({
      hasViewportMeta,
      hasSchema,
      hasRobotsTxt,
      hasSitemapXml,
      securityHeadersPresent: securityHeaders.filter((header) => header.present).length,
      securityHeadersTotal: securityHeaders.length
    });
    const contentScore = scoreContent({
      words: contentWordCount,
      headings: headingsCount,
      images: imagesCount,
      imagesMissingAlt,
      internalLinks: internalLinksCount,
      localSignals: localSignalsCount
    });
    const conversionScore = scoreConversion({
      hasPhoneOnPage: hasPhoneOnScannedPages,
      hasEmailOnPage: hasEmailOnScannedPages,
      formsCount,
      contactPageFound,
      bookingSignalFound,
      trustSignalsCount
    });
    const scoreBreakdown = [
      { label: "SEO metadata", score: metadataScore, detail: "Title, meta description, H1, canonical, and social preview tags." },
      { label: "Technical SEO", score: technicalScore, detail: "Mobile viewport, schema, sitemap, robots.txt, and core security headers." },
      { label: "Content depth", score: contentScore, detail: "Written content depth, headings, internal links, alt text, and local relevance." },
      { label: "Conversion path", score: conversionScore, detail: "Phone, email/form, contact page, booking/quote CTA, and trust signals." },
      { label: "Performance", score: roughSpeedScore, detail: "Server response, HTML size, images, and script weight approximation." }
    ];
    const overallScore = clampScore(scoreBreakdown.reduce((sum, item) => sum + item.score, 0) / scoreBreakdown.length);
    const pagesScanned = [
      { url: home.url || base.href, title, status: home.status, issueCount: 0 },
      ...secondaryPages.map((page) => {
        const page$ = cheerio.load(page.text);
        return {
          url: page.url || "",
          title: page$("title").first().text().trim(),
          status: page.status,
          issueCount: 0
        };
      })
    ].slice(0, 4);
    const seoFlags = buildSeoFlags({
      title,
      metaDescription,
      h1,
      h1Count,
      hasCanonical,
      hasIndexableRobotsMeta,
      hasOpenGraph,
      hasViewportMeta,
      hasSchema,
      schemaTypes,
      hasPhoneOnPage: hasPhoneOnScannedPages,
      hasEmailOnPage: hasEmailOnScannedPages,
      formsCount,
      roughSpeedScore,
      hasSitemapXml,
      hasRobotsTxt,
      imagesCount,
      imagesMissingAlt,
      contactPageFound,
      bookingSignalFound,
      contentWordCount,
      localSignalsCount,
      overallScore
    });
    pagesScanned[0].issueCount = seoFlags.length;

    return {
      auditedAt: new Date().toISOString(),
      website: base.href,
      finalUrl: home.url || base.href,
      httpStatus: home.status,
      responseTimeMs: home.elapsedMs,
      pageSizeKb: Math.round(home.text.length / 1024),
      title,
      metaDescription,
      h1,
      hasViewportMeta,
      hasRobotsTxt,
      hasSitemapXml,
      hasSchema,
      schemaTypes,
      hasCanonical,
      hasIndexableRobotsMeta,
      hasOpenGraph,
      hasPhoneOnPage: hasPhoneOnScannedPages,
      hasEmailOnPage: hasEmailOnScannedPages,
      formsCount,
      imagesCount,
      imagesMissingAlt,
      scriptsCount,
      internalLinksCount,
      externalLinksCount,
      pagesScanned,
      scoreBreakdown,
      overallScore,
      contentWordCount,
      headingsCount,
      contactPageFound,
      bookingSignalFound,
      localSignalsCount,
      trustSignalsCount,
      securityHeaders,
      socialLinks: detectedSocialLinks,
      techStack,
      roughSpeedScore,
      seoFlags,
      fitSummary: buildFitSummary(lead, seoFlags, Number(hasPhoneOnScannedPages) + Number(hasEmailOnScannedPages) + formsCount),
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
      externalLinksCount: 0,
      scoreBreakdown: [
        { label: "SEO metadata", score: 0, detail: "Website could not be loaded." },
        { label: "Technical SEO", score: 0, detail: "Website could not be loaded." },
        { label: "Content depth", score: 0, detail: "Website could not be loaded." },
        { label: "Conversion path", score: 0, detail: "Website could not be loaded." }
      ],
      overallScore: 0,
      contentWordCount: 0,
      headingsCount: 0,
      contactPageFound: false,
      bookingSignalFound: false,
      localSignalsCount: 0,
      trustSignalsCount: 0,
      securityHeaders: [],
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
