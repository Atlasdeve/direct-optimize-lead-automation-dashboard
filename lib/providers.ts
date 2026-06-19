import OpenAI from "openai";
import nodemailer from "nodemailer";
import { getRegion } from "@/lib/regions";
import { renderBrandedEmailHtml, renderPlainTextEmail } from "@/lib/brandedEmailTemplate";
import type { Lead, PlaceLeadCandidate } from "@/lib/types";

const placesCategories = [
  "dentists",
  "restaurants",
  "roofing contractors",
  "salons",
  "real estate agencies",
  "law firms"
];

export const defaultPlacesCategories = placesCategories;

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
  types?: string[];
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

function cityForRegion(region: string) {
  const cities: Record<string, string> = {
    Canada: "Toronto",
    USA: "Austin",
    UK: "London",
    UAE: "Dubai",
    Qatar: "Doha"
  };
  return cities[region] ?? region;
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

async function fetchLegacyPlacesLeads(region: string, config: ReturnType<typeof getRegion>, maxResults: number, categories: string[], cityOverride?: string) {
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
  const config = getRegion(region);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return {
      provider: "demo_google_places",
      warning: "GOOGLE_PLACES_API_KEY is not configured; using demo-safe lead generation.",
      records: [] as PlaceLeadCandidate[]
    };
  }

  const maxResults = Math.max(1, Math.min(options?.maxResults ?? Number(process.env.GOOGLE_PLACES_MAX_RESULTS || 6), 20));
  const queryCount = Math.max(1, Math.min(Number(process.env.GOOGLE_PLACES_QUERY_COUNT || 2), placesCategories.length));
  const categories = (options?.categories?.length ? options.categories : placesCategories.slice(0, queryCount))
    .map((category) => category.trim())
    .filter(Boolean)
    .slice(0, 6);
  const city = options?.city?.trim() || cityForRegion(region);
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
          "places.primaryTypeDisplayName",
          "places.types",
          "places.addressComponents"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery,
        pageSize: Math.min(maxResults, 10),
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
        sourceQuery: textQuery
      });
      if (records.size >= maxResults) break;
    }
    if (records.size >= maxResults) break;
  }

  if (records.size === 0 && permissionDenied) {
    const legacy = await fetchLegacyPlacesLeads(region, config, maxResults, categories, city);
    return {
      ...legacy,
      warning: [
        "Places API (New) Text Search is blocked for this key, so legacy Places endpoints were used.",
        legacy.warning
      ].filter(Boolean).join(" ")
    };
  }

  return {
    provider: "google_places",
    warning: errors.length ? `Some Places queries failed: ${errors.join(" | ")}` : null,
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

export function buildPersonalizedEmail(lead: Lead, templateCategory = "SEO services") {
  const missingWebsite = !lead.website;
  const subject = missingWebsite
    ? `${lead.company_name}: website and local visibility idea`
    : `${lead.company_name}: quick local visibility wins`;
  const body = [
    `Hi ${lead.manager_name ?? lead.owner_name ?? "there"},`,
    "",
    `I was reviewing ${lead.company_name} in ${lead.city}, ${lead.region} and noticed a few opportunities around ${templateCategory.toLowerCase()}.`,
    missingWebsite
      ? "Because I could not find a live website, there may be a strong opportunity to capture more search traffic with a fast service-focused site."
      : "Your existing website gives us a foundation, but there may be room to improve local SEO metadata, search intent coverage, and Google Business Profile conversion.",
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

function buildTrackedEmailHtml(body: string, logId?: string) {
  return renderBrandedEmailHtml({
    heading: "Quick local visibility wins",
    body,
    ctaLabel: "View Direct Optimize",
    ctaUrl: appBaseUrl(),
    trackingPixelUrl: logId ? `${appBaseUrl()}/api/email/open/${encodeURIComponent(logId)}` : undefined,
    clickTrackingBaseUrl: logId ? `${appBaseUrl()}/api/email/click/${encodeURIComponent(logId)}` : undefined
  });
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendComposedEmail(
  input: { to: string; subject: string; heading: string; body: string; ctaLabel?: string; ctaUrl?: string },
  options?: { trackingLogId?: string }
) {
  if (!smtpConfigured()) {
    return { sent: false, status: "failed", reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS is missing." };
  }

  const html = renderBrandedEmailHtml({
    heading: input.heading,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    trackingPixelUrl: options?.trackingLogId ? `${appBaseUrl()}/api/email/open/${encodeURIComponent(options.trackingLogId)}` : undefined,
    clickTrackingBaseUrl: options?.trackingLogId ? `${appBaseUrl()}/api/email/click/${encodeURIComponent(options.trackingLogId)}` : undefined
  });
  const text = renderPlainTextEmail({
    heading: input.heading,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl
  });

  try {
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
    return { sent: true, status: "sent", providerId: info.messageId };
  } catch (error) {
    return {
      sent: false,
      status: "failed",
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
  const message = buildPersonalizedEmail(lead);

  if (!emailSendingEnabled()) {
    return { sent: false, status: "skipped", reason: "Live email sending is disabled by OUTREACH_EMAIL_SEND_ENABLED", message };
  }

  if (isDemoRecipient(lead.email)) {
    return { sent: false, status: "skipped", reason: "Demo/reserved recipient domain", message };
  }

  if (!smtpConfigured() && !process.env.GMAIL_CLIENT_ID) {
    return { sent: true, status: "simulated", providerId: `demo_email_${lead.id}`, message };
  }

  if (!smtpConfigured()) {
    return { sent: false, status: "skipped", reason: "SMTP is not configured; Gmail API sending is not implemented in this cPanel setup", message };
  }

  try {
    const info = await createSmtpTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: lead.email,
      subject: message.subject,
      text: message.body,
      html: buildTrackedEmailHtml(message.body, options?.trackingLogId),
      headers: {
        "X-Entity-Ref-ID": lead.id,
        "X-Direct-Optimize-Log-ID": options?.trackingLogId ?? lead.id,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    });
    return {
      sent: true,
      status: "sent",
      providerId: info.messageId,
      message
    };
  } catch (error) {
    return {
      sent: false,
      status: "failed",
      reason: error instanceof Error ? error.message : "SMTP send failed",
      message
    };
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
