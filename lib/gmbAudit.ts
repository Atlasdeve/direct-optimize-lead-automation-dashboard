import type { Lead } from "@/lib/types";

export type GmbAudit = {
  auditedAt: string;
  placeId?: string | null;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  businessStatus?: string;
  rating?: number | null;
  reviewCount?: number | null;
  categories: string[];
  weekdayText: string[];
  openNow?: boolean | null;
  photosCount: number;
  profileCompleteness: number;
  overallScore?: number;
  scoreBreakdown?: Array<{ label: string; score: number; detail: string }>;
  gmbFlags: string[];
  reviewSummary: string;
  recommendedAction: string;
  error?: string;
};

type LegacyPlaceDetails = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  business_status?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: Array<{ photo_reference?: string; width?: number; height?: number }>;
};

function placeIdFromLead(lead: Lead) {
  const sourceMatch = lead.source_platform.match(/^google_places:(.+)$/);
  if (sourceMatch?.[1]) return sourceMatch[1];
  const mapsMatch = lead.google_maps_url?.match(/[?&]cid=([^&]+)/);
  return mapsMatch?.[1] ?? null;
}

function buildGmbFlags(details: LegacyPlaceDetails, lead: Lead) {
  const flags: string[] = [];
  if (!details.website && !lead.website) flags.push("Website missing from profile");
  if (!details.formatted_phone_number && !details.international_phone_number && !lead.phone) flags.push("Phone missing from profile");
  if (!details.opening_hours?.weekday_text?.length) flags.push("Business hours missing");
  if (!details.photos?.length) flags.push("No profile photos returned");
  if (!details.rating) flags.push("Rating missing");
  if ((details.user_ratings_total ?? lead.review_count ?? 0) < 25) flags.push("Low review volume");
  if (typeof details.rating === "number" && details.rating < 4) flags.push("Rating below 4.0");
  if (!details.types?.length) flags.push("Categories missing");
  if (details.business_status && details.business_status !== "OPERATIONAL") flags.push(`Business status: ${details.business_status}`);
  return flags;
}

function completenessScore(details: LegacyPlaceDetails, lead: Lead) {
  const checks = [
    Boolean(details.name || lead.company_name),
    Boolean(details.formatted_address),
    Boolean(details.formatted_phone_number || details.international_phone_number || lead.phone),
    Boolean(details.website || lead.website),
    Boolean(details.opening_hours?.weekday_text?.length),
    Boolean(details.photos?.length),
    Boolean(details.rating),
    Boolean(details.user_ratings_total),
    Boolean(details.types?.length),
    Boolean(details.url || lead.google_maps_url)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function reputationScore(rating?: number | null, reviewCount?: number | null) {
  let score = 100;
  if (!rating) score -= 30;
  else if (rating < 3.5) score -= 35;
  else if (rating < 4) score -= 24;
  else if (rating < 4.4) score -= 10;
  if (reviewCount == null) score -= 20;
  else if (reviewCount < 10) score -= 30;
  else if (reviewCount < 25) score -= 18;
  else if (reviewCount < 50) score -= 8;
  return clampScore(score);
}

function visibilityScore(details: LegacyPlaceDetails) {
  let score = 100;
  if (!details.types?.length) score -= 22;
  if (!details.photos?.length) score -= 22;
  else if (details.photos.length < 5) score -= 10;
  if (!details.opening_hours?.weekday_text?.length) score -= 18;
  if (details.business_status && details.business_status !== "OPERATIONAL") score -= 30;
  return clampScore(score);
}

function conversionScore(details: LegacyPlaceDetails, lead: Lead) {
  let score = 100;
  if (!details.website && !lead.website) score -= 28;
  if (!details.formatted_phone_number && !details.international_phone_number && !lead.phone) score -= 28;
  if (!details.url && !lead.google_maps_url) score -= 12;
  if (!details.opening_hours?.weekday_text?.length) score -= 12;
  return clampScore(score);
}

function buildScoreBreakdown(details: LegacyPlaceDetails, lead: Lead, rating?: number | null, reviewCount?: number | null) {
  const profile = completenessScore(details, lead);
  const reputation = reputationScore(rating, reviewCount);
  const visibility = visibilityScore(details);
  const conversion = conversionScore(details, lead);
  return {
    overallScore: clampScore((profile + reputation + visibility + conversion) / 4),
    scoreBreakdown: [
      { label: "Profile completeness", score: profile, detail: "Name, address, phone, website, hours, photos, categories, and Maps URL." },
      { label: "Reputation", score: reputation, detail: "Rating quality and review volume." },
      { label: "Local visibility", score: visibility, detail: "Categories, photos, hours, and operational status." },
      { label: "Conversion path", score: conversion, detail: "Website, phone, Maps URL, and action readiness." }
    ]
  };
}

function reviewSummary(rating?: number | null, reviewCount?: number | null) {
  if (!rating && !reviewCount) return "No rating or review volume was returned from Google Places.";
  if ((reviewCount ?? 0) < 25) return `Profile has limited review depth${rating ? ` with a ${rating} rating` : ""}. Review generation is likely a strong pitch angle.`;
  if (rating && rating < 4) return `Profile has ${reviewCount ?? "some"} reviews but a ${rating} rating. Reputation repair and review response structure may be useful.`;
  return `Profile has ${reviewCount ?? "many"} reviews${rating ? ` and a ${rating} rating` : ""}. The pitch should focus on conversion, visibility, and category/content gaps rather than basic reputation.`;
}

function recommendedAction(flags: string[]) {
  if (flags.some((flag) => flag.includes("Website"))) return "Pitch profile completion plus a stronger website/local landing page path.";
  if (flags.some((flag) => flag.includes("Business hours") || flag.includes("photos"))) return "Pitch Google Business Profile completion, photo cadence, and trust-building updates.";
  if (flags.some((flag) => flag.includes("review") || flag.includes("Rating"))) return "Pitch review generation, review response process, and reputation positioning.";
  return "Pitch a Google Business Profile conversion and local visibility audit.";
}

export async function auditGmbProfile(lead: Lead): Promise<GmbAudit> {
  const placeId = placeIdFromLead(lead);
  if (!placeId) {
    const flags = ["Google Place ID not available"];
    return {
      auditedAt: new Date().toISOString(),
      placeId: null,
      rating: lead.rating ?? null,
      reviewCount: lead.review_count ?? null,
      categories: [lead.category, lead.business_type].filter(Boolean),
      weekdayText: [],
      openNow: null,
      photosCount: 0,
      profileCompleteness: 0,
      overallScore: 0,
      scoreBreakdown: [
        { label: "Profile completeness", score: 0, detail: "Google Place ID is not available." },
        { label: "Reputation", score: reputationScore(lead.rating, lead.review_count), detail: "Only stored lead rating/review data was available." },
        { label: "Local visibility", score: 0, detail: "Google profile details could not be loaded." },
        { label: "Conversion path", score: lead.website || lead.phone ? 35 : 0, detail: "Only stored lead website/phone data was available." }
      ],
      gmbFlags: flags,
      reviewSummary: reviewSummary(lead.rating, lead.review_count),
      recommendedAction: recommendedAction(flags),
      error: "This lead was not imported with a Google Places place ID."
    };
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    const flags = ["Google Places API key missing"];
    return {
      auditedAt: new Date().toISOString(),
      placeId,
      rating: lead.rating ?? null,
      reviewCount: lead.review_count ?? null,
      categories: [lead.category, lead.business_type].filter(Boolean),
      weekdayText: [],
      openNow: null,
      photosCount: 0,
      profileCompleteness: 0,
      overallScore: 0,
      scoreBreakdown: [
        { label: "Profile completeness", score: 0, detail: "Google Places API key is missing." },
        { label: "Reputation", score: reputationScore(lead.rating, lead.review_count), detail: "Only stored lead rating/review data was available." },
        { label: "Local visibility", score: 0, detail: "Google profile details could not be loaded." },
        { label: "Conversion path", score: lead.website || lead.phone ? 35 : 0, detail: "Only stored lead website/phone data was available." }
      ],
      gmbFlags: flags,
      reviewSummary: reviewSummary(lead.rating, lead.review_count),
      recommendedAction: recommendedAction(flags),
      error: "GOOGLE_PLACES_API_KEY is missing."
    };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY);
    url.searchParams.set("language", "en");
    url.searchParams.set("fields", [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "international_phone_number",
      "website",
      "url",
      "business_status",
      "rating",
      "user_ratings_total",
      "types",
      "opening_hours",
      "photos"
    ].join(","));

    const response = await fetch(url);
    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      result?: LegacyPlaceDetails;
    };

    if (!response.ok || data.status !== "OK" || !data.result) {
      throw new Error(data.error_message ?? `Google Place Details failed with status ${data.status ?? response.status}`);
    }

    const details = data.result;
    const flags = buildGmbFlags(details, lead);
    const rating = details.rating ?? lead.rating ?? null;
    const reviewCount = details.user_ratings_total ?? lead.review_count ?? null;
    const scores = buildScoreBreakdown(details, lead, rating, reviewCount);
    return {
      auditedAt: new Date().toISOString(),
      placeId,
      name: details.name,
      address: details.formatted_address,
      phone: details.international_phone_number ?? details.formatted_phone_number ?? lead.phone ?? undefined,
      website: details.website ?? lead.website ?? undefined,
      mapsUrl: details.url ?? lead.google_maps_url ?? undefined,
      businessStatus: details.business_status,
      rating,
      reviewCount,
      categories: (details.types ?? []).map((type) => type.replaceAll("_", " ")),
      weekdayText: details.opening_hours?.weekday_text ?? [],
      openNow: details.opening_hours?.open_now ?? null,
      photosCount: details.photos?.length ?? 0,
      profileCompleteness: scores.scoreBreakdown[0].score,
      overallScore: scores.overallScore,
      scoreBreakdown: scores.scoreBreakdown,
      gmbFlags: flags,
      reviewSummary: reviewSummary(rating, reviewCount),
      recommendedAction: recommendedAction(flags)
    };
  } catch (error) {
    const flags = ["GMB audit failed"];
    return {
      auditedAt: new Date().toISOString(),
      placeId,
      rating: lead.rating ?? null,
      reviewCount: lead.review_count ?? null,
      categories: [lead.category, lead.business_type].filter(Boolean),
      weekdayText: [],
      openNow: null,
      photosCount: 0,
      profileCompleteness: 0,
      overallScore: 0,
      scoreBreakdown: [
        { label: "Profile completeness", score: 0, detail: "Google profile details could not be loaded." },
        { label: "Reputation", score: reputationScore(lead.rating, lead.review_count), detail: "Only stored lead rating/review data was available." },
        { label: "Local visibility", score: 0, detail: "Google profile details could not be loaded." },
        { label: "Conversion path", score: lead.website || lead.phone ? 35 : 0, detail: "Only stored lead website/phone data was available." }
      ],
      gmbFlags: flags,
      reviewSummary: reviewSummary(lead.rating, lead.review_count),
      recommendedAction: recommendedAction(flags),
      error: error instanceof Error ? error.message : "GMB audit failed"
    };
  }
}
