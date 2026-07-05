import type { Lead } from "@/lib/types";

export type PlaceDetailsEnrichment = {
  provider: "google_places_details";
  configured: boolean;
  placeId?: string | null;
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  categories: string[];
  error?: string;
};

export type HunterEnrichment = {
  provider: "hunter";
  configured: boolean;
  domain?: string | null;
  organization?: string | null;
  emails: Array<{
    value: string;
    type?: string | null;
    confidence?: number | null;
    firstName?: string | null;
    lastName?: string | null;
    position?: string | null;
    linkedinUrl?: string | null;
  }>;
  decisionMaker?: {
    name: string;
    title: string;
    email: string;
    confidence: number;
    linkedinUrl?: string | null;
    roleGroup: "owner" | "executive" | "manager";
  } | null;
  error?: string;
};

export type BuiltWithEnrichment = {
  provider: "builtwith";
  configured: boolean;
  domain?: string | null;
  technologies: string[];
  categories: string[];
  groups: string[];
  hasAnalytics: boolean;
  hasAds: boolean;
  hasCms: boolean;
  hasSeo: boolean;
  error?: string;
};

export type LeadEnrichmentResult = {
  placeDetails: PlaceDetailsEnrichment;
  hunter: HunterEnrichment;
  builtWith: BuiltWithEnrichment;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
};

type LegacyPlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
    types?: string[];
  };
};

type HunterDomainSearchResponse = {
  data?: {
    organization?: string;
    emails?: Array<{
      value?: string;
      type?: string;
      confidence?: number;
      first_name?: string;
      last_name?: string;
      position?: string;
      linkedin?: string;
    }>;
  };
  errors?: Array<{ details?: string; code?: number; id?: string }>;
};

const decisionMakerRoles: Array<{ pattern: RegExp; score: number; group: "owner" | "executive" | "manager" }> = [
  { pattern: /\b(owner|founder|co-founder|proprietor)\b/i, score: 100, group: "owner" },
  { pattern: /\b(chief executive officer|ceo|president)\b/i, score: 90, group: "executive" },
  { pattern: /\b(managing director|director|partner|principal)\b/i, score: 80, group: "executive" },
  { pattern: /\b(general manager|office manager|marketing manager|manager)\b/i, score: 65, group: "manager" }
];

function selectDecisionMaker(emails: HunterEnrichment["emails"]): HunterEnrichment["decisionMaker"] {
  return emails
    .map((contact) => {
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
      const title = contact.position?.trim() ?? "";
      const role = decisionMakerRoles.find((candidate) => candidate.pattern.test(title));
      if (!name || !title || !role) return null;
      return {
        name,
        title,
        email: contact.value,
        confidence: Math.max(0, Math.min(100, contact.confidence ?? 0)),
        linkedinUrl: contact.linkedinUrl ?? null,
        roleGroup: role.group,
        rank: role.score + Math.round((contact.confidence ?? 0) / 10)
      };
    })
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact))
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _rank, ...contact }) => contact)[0] ?? null;
}

function providerTimeoutMs() {
  return Math.max(3000, Math.min(Number(process.env.LEAD_ENRICHMENT_TIMEOUT_MS || 12000), 30000));
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs());
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const json = text ? JSON.parse(text) as T : ({} as T);
    return { response, json, text };
  } finally {
    clearTimeout(timeout);
  }
}

export function placeIdFromLead(lead: Pick<Lead, "source_platform">) {
  const match = lead.source_platform.match(/^google_places:(.+)$/);
  return match?.[1] ?? null;
}

export function domainFromWebsite(website?: string | null) {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function placeDetailsEmpty(placeId: string | null, error?: string): PlaceDetailsEnrichment {
  return {
    provider: "google_places_details",
    configured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    placeId,
    categories: [],
    error
  };
}

export async function fetchGooglePlaceDetails(lead: Lead): Promise<PlaceDetailsEnrichment> {
  const placeId = placeIdFromLead(lead);
  if (!placeId) return placeDetailsEmpty(null, "Lead does not have a Google Places place ID.");
  if (!process.env.GOOGLE_PLACES_API_KEY) return placeDetailsEmpty(placeId, "GOOGLE_PLACES_API_KEY is not configured.");

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "nationalPhoneNumber",
          "internationalPhoneNumber",
          "websiteUri",
          "googleMapsUri",
          "rating",
          "userRatingCount",
          "businessStatus",
          "primaryTypeDisplayName",
          "types"
        ].join(",")
      }
    });

    if (response.ok) {
      const details = await response.json() as GooglePlaceDetailsResponse;
      return {
        provider: "google_places_details",
        configured: true,
        placeId,
        name: details.displayName?.text ?? null,
        website: details.websiteUri ?? null,
        phone: details.internationalPhoneNumber ?? details.nationalPhoneNumber ?? null,
        googleMapsUrl: details.googleMapsUri ?? null,
        rating: details.rating ?? null,
        reviewCount: details.userRatingCount ?? null,
        businessStatus: details.businessStatus ?? null,
        categories: [
          details.primaryTypeDisplayName?.text,
          ...(details.types ?? []).map((type) => type.replaceAll("_", " "))
        ].filter((item): item is string => Boolean(item))
      };
    }
  } catch {
    // Fall through to legacy Place Details below.
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY);
    url.searchParams.set("fields", [
      "place_id",
      "name",
      "formatted_phone_number",
      "international_phone_number",
      "website",
      "url",
      "rating",
      "user_ratings_total",
      "business_status",
      "types"
    ].join(","));
    const { response, json } = await fetchJson<LegacyPlaceDetailsResponse>(url.toString());
    if (!response.ok || json.status !== "OK" || !json.result) {
      return placeDetailsEmpty(placeId, json.error_message ?? `Place Details failed with ${json.status ?? response.status}.`);
    }
    const details = json.result;
    return {
      provider: "google_places_details",
      configured: true,
      placeId,
      name: details.name ?? null,
      website: details.website ?? null,
      phone: details.international_phone_number ?? details.formatted_phone_number ?? null,
      googleMapsUrl: details.url ?? null,
      rating: details.rating ?? null,
      reviewCount: details.user_ratings_total ?? null,
      businessStatus: details.business_status ?? null,
      categories: (details.types ?? []).map((type) => type.replaceAll("_", " "))
    };
  } catch (error) {
    return placeDetailsEmpty(placeId, error instanceof Error ? error.message : "Google Place Details failed.");
  }
}

export async function fetchHunterDomainData(lead: Lead): Promise<HunterEnrichment> {
  const domain = domainFromWebsite(lead.website);
  if (!process.env.HUNTER_API_KEY) {
    return { provider: "hunter", configured: false, domain, emails: [], error: "HUNTER_API_KEY is not configured." };
  }
  if (!domain) {
    return { provider: "hunter", configured: true, domain, emails: [], error: "Lead does not have a website domain." };
  }

  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", process.env.HUNTER_API_KEY);
    url.searchParams.set("limit", "10");
    const { response, json } = await fetchJson<HunterDomainSearchResponse>(url.toString());
    if (!response.ok) {
      return {
        provider: "hunter",
        configured: true,
        domain,
        emails: [],
        error: json.errors?.[0]?.details ?? `Hunter failed with ${response.status}.`
      };
    }
    const emails = (json.data?.emails ?? [])
      .map((email) => ({
        value: email.value?.toLowerCase() ?? "",
        type: email.type ?? null,
        confidence: email.confidence ?? null,
        firstName: email.first_name ?? null,
        lastName: email.last_name ?? null,
        position: email.position ?? null,
        linkedinUrl: email.linkedin ?? null
      }))
      .filter((email) => Boolean(email.value));
    return {
      provider: "hunter",
      configured: true,
      domain,
      organization: json.data?.organization ?? null,
      emails,
      decisionMaker: selectDecisionMaker(emails)
    };
  } catch (error) {
    return {
      provider: "hunter",
      configured: true,
      domain,
      emails: [],
      error: error instanceof Error ? error.message : "Hunter enrichment failed."
    };
  }
}

function collectBuiltWithStrings(value: unknown, keys: Set<string>, output: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectBuiltWithStrings(item, keys, output);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key.toLowerCase()) && typeof nested === "string") output.add(nested);
    collectBuiltWithStrings(nested, keys, output);
  }
}

export async function fetchBuiltWithData(lead: Lead): Promise<BuiltWithEnrichment> {
  const domain = domainFromWebsite(lead.website);
  if (!process.env.BUILTWITH_API_KEY) {
    return {
      provider: "builtwith",
      configured: false,
      domain,
      technologies: [],
      categories: [],
      groups: [],
      hasAnalytics: false,
      hasAds: false,
      hasCms: false,
      hasSeo: false,
      error: "BUILTWITH_API_KEY is not configured."
    };
  }
  if (!domain) {
    return {
      provider: "builtwith",
      configured: true,
      domain,
      technologies: [],
      categories: [],
      groups: [],
      hasAnalytics: false,
      hasAds: false,
      hasCms: false,
      hasSeo: false,
      error: "Lead does not have a website domain."
    };
  }

  try {
    const url = new URL("https://api.builtwith.com/free1/api.json");
    url.searchParams.set("KEY", process.env.BUILTWITH_API_KEY);
    url.searchParams.set("LOOKUP", domain);
    const { response, json, text } = await fetchJson<unknown>(url.toString());
    if (!response.ok) {
      return {
        provider: "builtwith",
        configured: true,
        domain,
        technologies: [],
        categories: [],
        groups: [],
        hasAnalytics: false,
        hasAds: false,
        hasCms: false,
        hasSeo: false,
        error: `BuiltWith failed with ${response.status}: ${text.slice(0, 160)}`
      };
    }

    const technologies = new Set<string>();
    const categories = new Set<string>();
    const groups = new Set<string>();
    collectBuiltWithStrings(json, new Set(["name", "tag", "technology"]), technologies);
    collectBuiltWithStrings(json, new Set(["category", "categories"]), categories);
    collectBuiltWithStrings(json, new Set(["group", "groups"]), groups);
    const searchable = [...technologies, ...categories, ...groups].join(" ").toLowerCase();
    return {
      provider: "builtwith",
      configured: true,
      domain,
      technologies: [...technologies].slice(0, 20),
      categories: [...categories].slice(0, 20),
      groups: [...groups].slice(0, 20),
      hasAnalytics: /analytics|tag manager|google analytics|gtm|matomo|pixel/.test(searchable),
      hasAds: /ads|advertising|google ads|facebook|meta pixel|remarketing/.test(searchable),
      hasCms: /cms|wordpress|wix|squarespace|shopify|webflow/.test(searchable),
      hasSeo: /seo|schema|structured data|yoast|rank math/.test(searchable)
    };
  } catch (error) {
    return {
      provider: "builtwith",
      configured: true,
      domain,
      technologies: [],
      categories: [],
      groups: [],
      hasAnalytics: false,
      hasAds: false,
      hasCms: false,
      hasSeo: false,
      error: error instanceof Error ? error.message : "BuiltWith enrichment failed."
    };
  }
}

export async function enrichLeadWithProviders(lead: Lead): Promise<LeadEnrichmentResult> {
  const placeDetails = await fetchGooglePlaceDetails(lead);
  const leadWithPlaceWebsite = {
    ...lead,
    website: lead.website ?? placeDetails.website ?? null
  };
  const [hunter, builtWith] = await Promise.all([
    fetchHunterDomainData(leadWithPlaceWebsite),
    fetchBuiltWithData(leadWithPlaceWebsite)
  ]);
  return { placeDetails, hunter, builtWith };
}
