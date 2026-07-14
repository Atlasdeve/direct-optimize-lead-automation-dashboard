import OpenAI from "openai";
import nodemailer from "nodemailer";
import { getRegion } from "@/lib/regions";
import { getSavedRegion } from "@/lib/regionStore";
import { businessDiscoveryCategories, getDefaultCityForRegion } from "@/lib/discoveryTargets";
import { buildGmbAuditPdf, buildWebsiteAuditPdf, type AuditAttachment } from "@/lib/auditPdf";
import { renderBrandedEmailHtml, renderPlainTextEmail } from "@/lib/brandedEmailTemplate";
import { auditGmbProfile, type GmbAudit } from "@/lib/gmbAudit";
import { auditLeadWebsite, type LeadIntelligenceAudit } from "@/lib/leadIntelligence";
import type { Lead, PlaceLeadCandidate, RegionConfig } from "@/lib/types";

const placesCategories = businessDiscoveryCategories;

export const defaultPlacesCategories = businessDiscoveryCategories;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
};

type LegacyTextSearchResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
};

type LegacyDetailsResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

function cityForRegion(region: string) {
  return getDefaultCityForRegion(region);
}

function countryFromComponents(place: GooglePlace, fallback: string) {
  return place.addressComponents?.find((component) => component.types?.includes("country"))?.longText ?? fallback;
}

function cityFromComponents(place: GooglePlace, fallback: string) {
  return (
    place.addressComponents?.find((component) => component.types?.includes("locality"))?.longText ??
    place.addressComponents?.find((component) => component.types?.includes("administrative_area_level_2"))?.longText ??
    fallback
  );
}

function legacyCountryFromComponents(place: LegacyDetailsResult, fallback: string) {
  return place.address_components?.find((component) => component.types?.includes("country"))?.long_name ?? fallback;
}

function legacyCityFromComponents(place: LegacyDetailsResult, fallback: string) {
  return (
    place.address_components?.find((component) => component.types?.includes("locality"))?.long_name ??
    place.address_components?.find((component) => component.types?.includes("administrative_area_level_2"))?.long_name ??
    fallback
  );
}

async function fetchLegacyPlaceDetails(placeId: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY ?? "");
  url.searchParams.set("fields", [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "url",
    "rating",
    "user_ratings_total",
    "business_status",
    "types",
    "address_components"
  ].join(","));

  const response = await fetch(url);
  const data = (await response.json()) as {
    status?: string;
    error_message?: string;
    result?: LegacyDetailsResult;
  };

  if (!response.ok || data.status !== "OK" || !data.result) {
    throw new Error(data.error_message ?? `Place Details failed with status ${data.status ?? response.status}`);
  }

  return data.result;
}

async function fetchLegacyPlacesLeads(region: string, config: RegionConfig, maxResults: number, categories: string[], cityOverride?: string) {
  const city = cityOverride || cityForRegion(region);
  const records = new Map<string, PlaceLeadCandidate>();
  const errors: string[] = [];

  for (const category of categories) {
    const textQuery = `${category} in ${city}, ${config.country}`;
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", textQuery);
    url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY ?? "");
    url.searchParams.set("language", "en");

    const response = await fetch(url);
    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      results?: LegacyTextSearchResult[];
    };

    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status ?? "")) {
      errors.push(`${textQuery}: ${data.status ?? response.status} ${data.error_message ?? ""}`.trim());
      continue;
    }

    for (const item of data.results ?? []) {
      if (!item.place_id || !item.name) continue;
      try {
        const details = await fetchLegacyPlaceDetails(item.place_id);
        records.set(item.place_id, {
          placeId: item.place_id,
          companyName: details.name ?? item.name,
          region,
          country: legacyCountryFromComponents(details, config.country),
          city: legacyCityFromComponents(details, city),
          category: details.types?.[0]?.replaceAll("_", " ") ?? item.types?.[0]?.replaceAll("_", " ") ?? category,
          businessType: details.types?.[0]?.replaceAll("_", " ") ?? category,
          website: details.website ?? null,
          googleMapsUrl: details.url ?? null,
          phone: details.international_phone_number ?? details.formatted_phone_number ?? null,
          rating: details.rating ?? item.rating ?? null,
          reviewCount: details.user_ratings_total ?? item.user_ratings_total ?? null,
          businessStatus: details.business_status ?? null,
          sourceQuery: textQuery
        });
      } catch (error) {
        errors.push(`${item.name}: ${error instanceof Error ? error.message : "details failed"}`);
      }
      if (records.size >= maxResults) break;
    }
    if (records.size >= maxResults) break;
  }

  return {
    provider: "google_places_legacy",
    warning: errors.length ? `Some legacy Places queries failed: ${errors.slice(0, 3).join(" | ")}` : null,
    records: [...records.values()]
  };
}

export async function fetchPlacesLeads(region: string, options?: { city?: string; categories?: string[]; maxResults?: number }) {
  const config = await getSavedRegion(region) ?? getRegion(region);
  const maxResults = Math.max(1, Math.min(options?.maxResults ?? Number(process.env.GOOGLE_PLACES_MAX_RESULTS || 6), 20));
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return {
      provider: "demo_google_places",
      warning: "GOOGLE_PLACES_API_KEY is not configured; using demo-safe lead generation.",
      requestedResults: maxResults,
      records: [] as PlaceLeadCandidate[]
    };
  }

  const candidateLimit = Math.min(60, maxResults * 3);
  const queryCount = Math.max(1, Math.min(Number(process.env.GOOGLE_PLACES_QUERY_COUNT || 2), placesCategories.length));
  const categories = (options?.categories?.length ? options.categories : placesCategories.slice(0, queryCount))
    .map((category) => category.trim())
    .filter(Boolean)
    .slice(0, 6);
  const city = options?.city?.trim() || getDefaultCityForRegion(region, config.country);
  const records = new Map<string, PlaceLeadCandidate>();
  const errors: string[] = [];
  let permissionDenied = false;

  for (const category of categories) {
    const textQuery = `${category} in ${city}, ${config.country}`;
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.websiteUri",
          "places.googleMapsUri",
          "places.rating",
          "places.userRatingCount",
          "places.businessStatus",
          "places.primaryTypeDisplayName",
          "places.types",
          "places.addressComponents"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery,
        pageSize: Math.min(20, Math.max(1, candidateLimit - records.size)),
        languageCode: "en"
      })
    });

    if (!response.ok) {
      const details = await response.text();
      if (response.status === 403 && details.includes("PERMISSION_DENIED")) {
        permissionDenied = true;
      }
      errors.push(`${textQuery}: ${response.status} ${details.slice(0, 180)}`);
      continue;
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    for (const place of data.places ?? []) {
      const companyName = place.displayName?.text;
      if (!place.id || !companyName) continue;
      records.set(place.id, {
        placeId: place.id,
        companyName,
        region,
        country: countryFromComponents(place, config.country),
        city: cityFromComponents(place, city),
        category: place.primaryTypeDisplayName?.text ?? category,
        businessType: place.types?.[0]?.replaceAll("_", " ") ?? category,
        website: place.websiteUri ?? null,
        googleMapsUrl: place.googleMapsUri ?? null,
        phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        businessStatus: place.businessStatus ?? null,
        sourceQuery: textQuery
      });
      if (records.size >= candidateLimit) break;
    }
    if (records.size >= candidateLimit) break;
  }

  if (records.size === 0 && permissionDenied) {
    const legacy = await fetchLegacyPlacesLeads(region, config, candidateLimit, categories, city);
    return {
      ...legacy,
      requestedResults: maxResults,
      warning: [
        "Places API (New) Text Search is blocked for this key, so legacy Places endpoints were used.",
        legacy.warning
      ].filter(Boolean).join(" ")
    };
  }

  return {
    provider: "google_places",
    warning: errors.length ? `Some Places queries failed: ${errors.join(" | ")}` : null,
    requestedResults: maxResults,
    records: [...records.values()]
  };
}

export async function discoverWebsiteWithApprovedSearch(companyName: string, region: string) {
  if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_CX) {
    return { website: null, source: "not_configured" };
  }
  return { website: null, source: "google_custom_search" };
}

export async function findPublicContactEmail(website?: string | null) {
  if (!website) return null;
  return null;
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function shortList(items: string[], fallback: string, limit = 4) {
  return items.length ? items.slice(0, limit).join("; ") : fallback;
}

function publicAction(value: string) {
  return value
    .replace(/^Pitch\s+/i, "")
    .replace(/^Lead with a\s+/i, "start with a ")
    .replace(/^Lead with an\s+/i, "start with an ")
    .replace(/^Lead with\s+/i, "start with ")
    .replace(/\.$/, "");
}

function websiteAuditSummary(lead: Lead, websiteAudit?: LeadIntelligenceAudit) {
  if (!websiteAudit) return "";
  if (!lead.website) {
    return [
      "Current website performance:",
      "- Website status: no dedicated website detected from the public business profile.",
      "- Visibility impact: this can limit local search traffic, trust signals, service-page ranking, and quote requests.",
      "- Recommended website structure: fast homepage, service pages, city/local landing content, visible call/quote actions, review proof, and Google Business Profile connection.",
      "- Priority proposal: create a lightweight conversion-focused website first, then expand SEO pages around the services and locations that bring buyers.",
      "",
      "I attached a website creation proposal PDF showing the first structure I would recommend."
    ].join("\n");
  }

  const flags = websiteAudit.seoFlags.slice(0, 3);
  return [
    "Current website performance:",
    `- Website reviewed: ${websiteAudit.website ?? lead.website}.`,
    `- Homepage speed signal: ${websiteAudit.roughSpeedScore}/100 quick score.`,
    `- Title tag: ${websiteAudit.title || "missing or not detected"}.`,
    `- Meta description: ${websiteAudit.metaDescription ? "present" : "missing or weak"}.`,
    `- H1 headline: ${websiteAudit.h1 || "missing or not detected"}.`,
    `- Technical basics: mobile viewport ${yesNo(websiteAudit.hasViewportMeta)}, schema ${yesNo(websiteAudit.hasSchema)}, sitemap ${yesNo(websiteAudit.hasSitemapXml)}, robots.txt ${yesNo(websiteAudit.hasRobotsTxt)}.`,
    `- Conversion signals: phone visible ${yesNo(websiteAudit.hasPhoneOnPage)}, email visible ${yesNo(websiteAudit.hasEmailOnPage)}, forms found ${websiteAudit.formsCount}.`,
    `- Detected technology: ${shortList(websiteAudit.techStack, "no major platform signals detected")}.`,
    `- Main website opportunities: ${shortList(flags, "conversion and local visibility improvements")}.`,
    `- Suggested website next step: ${publicAction(websiteAudit.recommendedPitch)}.`,
    "",
    "I attached a website audit PDF with the full details."
  ].join("\n");
}

function gmbAuditSummary(gmbAudit?: GmbAudit) {
  if (!gmbAudit) return "";
  const flags = gmbAudit.gmbFlags.slice(0, 3);
  return [
    "Current Google Business Profile performance:",
    `- Profile completeness: ${gmbAudit.profileCompleteness}/100 quick score.`,
    `- Business status: ${gmbAudit.businessStatus || "not returned"}.`,
    `- Rating and reviews: ${gmbAudit.rating ? `${gmbAudit.rating} stars` : "rating not returned"} with ${gmbAudit.reviewCount ?? "unknown"} reviews.`,
    `- Profile media: ${gmbAudit.photosCount} photo${gmbAudit.photosCount === 1 ? "" : "s"} returned.`,
    `- Hours: ${gmbAudit.weekdayText.length ? "business hours are listed" : "business hours were not returned"}.`,
    `- Categories: ${shortList(gmbAudit.categories, "categories not returned")}.`,
    `- Main GMB opportunities: ${shortList(flags, "profile conversion and local visibility improvements")}.`,
    `- Review performance: ${gmbAudit.reviewSummary}`,
    `- Suggested GMB next step: ${publicAction(gmbAudit.recommendedAction)}.`,
    "",
    "I attached a GMB audit PDF with the full details."
  ].join("\n");
}

export function buildPersonalizedEmail(
  lead: Lead,
  templateCategory = "SEO services",
  audits?: { website?: LeadIntelligenceAudit; gmb?: GmbAudit }
) {
  const missingWebsite = !lead.website;
  const subject = missingWebsite
    ? `${lead.company_name}: website and local visibility idea`
    : `${lead.company_name}: quick local visibility wins`;
  const auditDetails = [gmbAuditSummary(audits?.gmb), websiteAuditSummary(lead, audits?.website)].filter(Boolean);
  const body = [
    `Hi ${lead.manager_name ?? lead.owner_name ?? "there"},`,
    "",
    `I was reviewing ${lead.company_name} in ${lead.city}, ${lead.region} and noticed a few opportunities around ${templateCategory}.`,
    missingWebsite
      ? "Because I could not find a live website, there may be a strong opportunity to capture more search traffic with a fast service-focused site connected to your Google Business Profile."
      : "Your existing website gives us a foundation, but there may be room to improve local SEO metadata, search intent coverage, and Google Business Profile conversion.",
    ...auditDetails.flatMap((detail) => ["", detail]),
    "Would you be open to a short audit with the first few fixes I would prioritize?",
    "",
    "Best,",
    "Direct Optimize",
    "",
    "To opt out of future messages, reply with Unsubscribe."
  ].join("\n");
  return { subject, body };
}

function appBaseUrl() {
  return (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function publicTrackingBaseUrl() {
  const configuredUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" || isLocalHost) return undefined;
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function buildTrackedEmailHtml(body: string, logId?: string) {
  const trackingBaseUrl = publicTrackingBaseUrl();
  return renderBrandedEmailHtml({
    heading: "Quick local visibility wins",
    body,
    ctaLabel: "View Direct Optimize",
    ctaUrl: appBaseUrl(),
    trackingPixelUrl: logId && trackingBaseUrl ? `${trackingBaseUrl}/api/email/open/${encodeURIComponent(logId)}` : undefined,
    clickTrackingBaseUrl: logId && trackingBaseUrl ? `${trackingBaseUrl}/api/email/click/${encodeURIComponent(logId)}` : undefined
  });
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function brevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY);
}

function parseSender() {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "Direct Optimize <hello@directoptimize.com>";
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1]?.replace(/^"|"$/g, "").trim() || "Direct Optimize",
      email: match[2]?.trim()
    };
  }
  return {
    name: process.env.SMTP_FROM_NAME || "Direct Optimize",
    email: from.trim()
  };
}

async function sendViaBrevo(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  tags?: string[];
  attachments?: AuditAttachment[];
}) {
  const sender = parseSender();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY ?? "",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      htmlContent: input.html,
      tags: input.tags,
      attachment: input.attachments?.map((attachment) => ({
        name: attachment.filename,
        content: attachment.content.toString("base64")
      }))
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : `Brevo API failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    messageId: typeof data?.messageId === "string" ? data.messageId : undefined,
    response: `Brevo API accepted ${input.to}`
  };
}

export async function sendComposedEmail(
  input: { to: string; subject: string; heading: string; body: string; ctaLabel?: string; ctaUrl?: string },
  options?: { trackingLogId?: string }
) {
  if (!brevoConfigured() && !smtpConfigured()) {
    return { sent: false, status: "failed", reason: "BREVO_API_KEY or SMTP_HOST, SMTP_USER, and SMTP_PASS is missing." };
  }

  const trackingBaseUrl = publicTrackingBaseUrl();
  const trackingEnabled = Boolean(options?.trackingLogId && trackingBaseUrl);
  const html = renderBrandedEmailHtml({
    heading: input.heading,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    trackingPixelUrl: options?.trackingLogId && trackingBaseUrl ? `${trackingBaseUrl}/api/email/open/${encodeURIComponent(options.trackingLogId)}` : undefined,
    clickTrackingBaseUrl: options?.trackingLogId && trackingBaseUrl ? `${trackingBaseUrl}/api/email/click/${encodeURIComponent(options.trackingLogId)}` : undefined
  });
  const text = renderPlainTextEmail({
    heading: input.heading,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl
  });

  try {
    if (brevoConfigured()) {
      const info = await sendViaBrevo({
        to: input.to,
        subject: input.subject,
        text,
        html,
        tags: ["manual-compose"]
      });
      return {
        sent: true,
        status: "sent",
        provider: "brevo",
        providerId: info.messageId,
        trackingEnabled,
        accepted: [input.to],
        rejected: [],
        pending: [],
        response: info.response
      };
    }

    const info = await createSmtpTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text,
      html,
      headers: {
        "X-Entity-Ref-ID": "manual-compose",
        "X-Direct-Optimize-Log-ID": options?.trackingLogId ?? "manual-compose"
      }
    });
    return {
      sent: true,
      status: "sent",
      provider: "smtp",
      providerId: info.messageId,
      trackingEnabled,
      accepted: (info.accepted ?? []).map(String),
      rejected: (info.rejected ?? []).map(String),
      pending: (info.pending ?? []).map(String),
      response: info.response
    };
  } catch (error) {
    return {
      sent: false,
      status: "failed",
      trackingEnabled,
      reason: error instanceof Error ? error.message : "SMTP send failed"
    };
  }
}

function emailSendingEnabled() {
  return process.env.OUTREACH_EMAIL_SEND_ENABLED === "true";
}

function isDemoRecipient(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "example.com" || domain.endsWith(".example");
}

function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const timeout = Number(process.env.SMTP_TIMEOUT_MS || 30000);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    requireTLS: port === 587,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout
  });
}

export async function sendEmailOutreach(lead: Lead, options?: { trackingLogId?: string }) {
  if (lead.unsubscribed || !lead.email) {
    return { sent: false, status: "skipped", reason: "Missing email or unsubscribed" };
  }

  if (!emailSendingEnabled()) {
    const message = buildPersonalizedEmail(lead);
    return { sent: false, status: "skipped", reason: "Live email sending is disabled by OUTREACH_EMAIL_SEND_ENABLED", message };
  }

  if (isDemoRecipient(lead.email)) {
    const message = buildPersonalizedEmail(lead);
    return { sent: false, status: "skipped", reason: "Demo/reserved recipient domain", message };
  }

  if (!brevoConfigured() && !smtpConfigured() && !process.env.GMAIL_CLIENT_ID) {
    const message = buildPersonalizedEmail(lead);
    return { sent: true, status: "simulated", providerId: `demo_email_${lead.id}`, message };
  }

  if (!brevoConfigured() && !smtpConfigured()) {
    const message = buildPersonalizedEmail(lead);
    return { sent: false, status: "skipped", reason: "SMTP is not configured; Gmail API sending is not implemented in this cPanel setup", message };
  }

  try {
    const [websiteAudit, gmbAudit] = await Promise.all([
      auditLeadWebsite(lead),
      auditGmbProfile(lead)
    ]);
    const message = buildPersonalizedEmail(lead, "local SEO and website conversion", { website: websiteAudit, gmb: gmbAudit });
    const attachments = await Promise.all([
      buildGmbAuditPdf(lead, gmbAudit),
      buildWebsiteAuditPdf(lead, websiteAudit)
    ]);
    if (brevoConfigured()) {
      const info = await sendViaBrevo({
        to: lead.email,
        subject: message.subject,
        text: message.body,
        html: buildTrackedEmailHtml(message.body, options?.trackingLogId),
        attachments,
        tags: ["lead-outreach"]
      });
      return {
        sent: true,
        status: "sent",
        provider: "brevo",
        providerId: info.messageId,
        message,
        auditAttachments: attachments.map((attachment) => attachment.filename),
        websiteAudit,
        gmbAudit
      };
    }

    const info = await createSmtpTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: lead.email,
      subject: message.subject,
      text: message.body,
      html: buildTrackedEmailHtml(message.body, options?.trackingLogId),
      attachments,
      headers: {
        "X-Entity-Ref-ID": lead.id,
        "X-Direct-Optimize-Log-ID": options?.trackingLogId ?? lead.id,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    });
    return {
      sent: true,
      status: "sent",
      provider: "smtp",
      providerId: info.messageId,
      message,
      auditAttachments: attachments.map((attachment) => attachment.filename),
      websiteAudit,
      gmbAudit
    };
  } catch (error) {
    return {
      sent: false,
      status: "failed",
      reason: error instanceof Error ? error.message : "SMTP send failed",
      message: buildPersonalizedEmail(lead)
    };
  }
}

export async function sendEmailFollowUp(lead: Lead, stage: 1 | 2, options?: { trackingLogId?: string }) {
  if (lead.unsubscribed || lead.do_not_contact || !lead.email) {
    return { sent: false, status: "skipped", reason: "Missing email, unsubscribed, or do-not-contact" };
  }
  if (!emailSendingEnabled()) {
    return { sent: false, status: "skipped", reason: "Live email sending is disabled by OUTREACH_EMAIL_SEND_ENABLED" };
  }
  if (isDemoRecipient(lead.email)) {
    return { sent: false, status: "skipped", reason: "Demo/reserved recipient domain" };
  }
  if (!brevoConfigured() && !smtpConfigured()) {
    return { sent: false, status: "skipped", reason: "Brevo or SMTP is not configured" };
  }

  const greetingName = lead.manager_name ?? lead.owner_name ?? lead.decision_maker_name ?? "there";
  const original = buildPersonalizedEmail(lead);
  const subject = `Re: ${original.subject}`;
  const body = stage === 1
    ? [
        `Hi ${greetingName},`,
        "",
        `I wanted to follow up on the visibility audit I sent for ${lead.company_name}.`,
        "The audit highlights the website and Google Business Profile improvements most likely to strengthen local enquiries.",
        "",
        "Would a short call this week be useful to review the highest-priority fixes?",
        "",
        "Best,",
        "Direct Optimize",
        "",
        "To opt out of future messages, reply with Unsubscribe."
      ].join("\n")
    : [
        `Hi ${greetingName},`,
        "",
        `I am closing the loop on the audit for ${lead.company_name}.`,
        "If improving local search visibility, the website, or Google Business Profile becomes a priority, I would be happy to walk you through the recommendations.",
        "",
        "Should I keep this open for a future conversation?",
        "",
        "Best,",
        "Direct Optimize",
        "",
        "To opt out of future messages, reply with Unsubscribe."
      ].join("\n");

  try {
    if (brevoConfigured()) {
      const info = await sendViaBrevo({
        to: lead.email,
        subject,
        text: body,
        html: buildTrackedEmailHtml(body, options?.trackingLogId),
        tags: [`lead-follow-up-${stage}`]
      });
      return { sent: true, status: "sent", provider: "brevo", providerId: info.messageId, message: { subject, body } };
    }

    const info = await createSmtpTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: lead.email,
      subject,
      text: body,
      html: buildTrackedEmailHtml(body, options?.trackingLogId),
      headers: {
        "X-Entity-Ref-ID": lead.id,
        "X-Direct-Optimize-Log-ID": options?.trackingLogId ?? lead.id,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    });
    return { sent: true, status: "sent", provider: "smtp", providerId: info.messageId, message: { subject, body } };
  } catch (error) {
    return { sent: false, status: "failed", reason: error instanceof Error ? error.message : "Follow-up email failed", message: { subject, body } };
  }
}

export async function verifySmtpConnection() {
  if (!smtpConfigured()) {
    return { ok: false, reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS is missing" };
  }
  try {
    await createSmtpTransport().verify();
    return { ok: true, reason: "SMTP connection verified" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "SMTP verification failed"
    };
  }
}

export async function draftAiReply(lead: Lead, replyBody: string) {
  if (!process.env.OPENAI_API_KEY) {
    return `Hi ${lead.manager_name ?? "there"}, thanks for your reply. Based on what you shared, I would recommend starting with a focused local visibility audit and a short list of priority fixes.`;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Draft concise B2B outreach replies. Do not claim actions were completed. Do not auto-send." },
      { role: "user", content: `Lead: ${lead.company_name}\nReply: ${replyBody}\nDraft a helpful response.` }
    ]
  });
  return response.choices[0]?.message.content ?? "";
}
