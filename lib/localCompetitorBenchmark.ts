import type { Lead } from "@/lib/types";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
  location?: { latitude?: number; longitude?: number };
};

export type BenchmarkBusiness = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export type KeywordBenchmark = {
  keyword: string;
  query: string;
  targetRank: number | null;
  competitorRanks: Record<string, number | null>;
  returnedResults: number;
};

export type LocalCompetitorBenchmark = {
  generatedAt: string;
  target: BenchmarkBusiness;
  competitors: BenchmarkBusiness[];
  keywords: KeywordBenchmark[];
  market: {
    city: string;
    country: string;
    anchoredToTarget: boolean;
    resultLimit: number;
  };
  comparison: {
    competitorAverageRating: number | null;
    competitorMedianReviewCount: number | null;
    ratingGap: number | null;
    reviewGap: number | null;
    findings: string[];
  };
  notice: string;
};

type SearchOptions = {
  textQuery: string;
  country?: string;
  location?: GooglePlace["location"];
};

type CandidateStat = {
  business: BenchmarkBusiness;
  appearances: number;
  rankTotal: number;
};

const resultLimit = 20;
const countryCodes: Record<string, string> = {
  australia: "AU",
  canada: "CA",
  pakistan: "PK",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
  "united states of america": "US"
};

function normaliseText(value?: string | null) {
  return (value ?? "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalisePlaceId(value?: string | null) {
  return (value ?? "").replace(/^places\//, "").trim();
}

function humanizeCategory(value?: string | null) {
  return (value ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourcePlaceId(lead: Lead) {
  const match = lead.source_platform.match(/^google_places:(.+)$/);
  return normalisePlaceId(match?.[1]);
}

function businessKey(place: GooglePlace) {
  return normalisePlaceId(place.id) || `${normaliseText(place.displayName?.text)}:${normaliseText(place.formattedAddress)}`;
}

function placeMatchesLead(place: GooglePlace, lead: Lead, knownTargetId?: string) {
  if (knownTargetId && normalisePlaceId(place.id) === knownTargetId) return true;
  const businessName = normaliseText(place.displayName?.text);
  const leadName = normaliseText(lead.company_name);
  return Boolean(businessName && leadName && (businessName === leadName || businessName.includes(leadName) || leadName.includes(businessName)));
}

function asBusiness(place: GooglePlace, fallback: Lead): BenchmarkBusiness {
  return {
    id: businessKey(place) || fallback.id,
    name: place.displayName?.text?.trim() || fallback.company_name,
    category: place.primaryTypeDisplayName?.text?.trim() || humanizeCategory(fallback.category || fallback.business_type) || null,
    address: place.formattedAddress?.trim() || null,
    mapsUrl: place.googleMapsUri?.trim() || fallback.google_maps_url || null,
    rating: typeof place.rating === "number" ? place.rating : fallback.rating ?? null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : fallback.review_count ?? null
  };
}

function countryCode(country?: string | null) {
  return countryCodes[normaliseText(country)] || undefined;
}

function hasUsableLocation(location?: GooglePlace["location"]): location is { latitude: number; longitude: number } {
  return typeof location?.latitude === "number" && typeof location.longitude === "number";
}

async function searchGooglePlaces({ textQuery, country, location }: SearchOptions) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places API is not configured for this workspace.");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.primaryTypeDisplayName",
        "places.businessStatus",
        "places.location"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery,
      pageSize: resultLimit,
      languageCode: "en",
      ...(countryCode(country) ? { regionCode: countryCode(country) } : {}),
      ...(hasUsableLocation(location)
        ? {
            locationBias: {
              circle: {
                center: location,
                radius: 10_000
              }
            }
          }
        : {})
    })
  });

  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, " ").slice(0, 220);
    throw new Error(`Google Places comparison search failed (${response.status})${details ? `: ${details}` : ""}`);
  }

  const data = await response.json() as { places?: GooglePlace[] };
  return data.places?.filter((place) => place.id && place.displayName?.text) ?? [];
}

function queryForKeyword(keyword: string, city: string, country: string) {
  const normalizedKeyword = normaliseText(keyword);
  const includesCity = normalizedKeyword.includes(normaliseText(city));
  const includesCountry = normalizedKeyword.includes(normaliseText(country));
  const location = [includesCity ? null : city, includesCountry ? null : country].filter(Boolean).join(", ");
  return location ? `${keyword} in ${location}` : keyword;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function roundedAverage(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function rankFinding(target: BenchmarkBusiness, rows: KeywordBenchmark[]) {
  const ranked = rows.filter((row) => row.targetRank !== null);
  if (!ranked.length) return `${target.name} was not returned in the first ${resultLimit} Google Places results for the selected searches.`;
  const average = ranked.reduce((total, row) => total + (row.targetRank ?? 0), 0) / ranked.length;
  const unranked = rows.length - ranked.length;
  const rankText = `The measured average position is #${Math.round(average)} across ${ranked.length} selected search${ranked.length === 1 ? "" : "es"}.`;
  return unranked ? `${rankText} It was not returned in the first ${resultLimit} results for ${unranked} search${unranked === 1 ? "" : "es"}.` : rankText;
}

export function defaultBenchmarkKeywords(lead: Pick<Lead, "category" | "business_type" | "city">) {
  const niche = humanizeCategory(lead.category || lead.business_type) || "local business";
  const city = lead.city?.trim();
  return city ? [`${niche} ${city}`] : [niche];
}

export function normalizeBenchmarkKeywords(input: unknown, lead: Pick<Lead, "category" | "business_type" | "city">) {
  const values = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\n,]+/) : [];
  const unique = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const keyword = value.trim().replace(/\s+/g, " ");
    if (keyword.length < 2 || keyword.length > 120) continue;
    unique.set(normaliseText(keyword), keyword);
  }
  return [...unique.values()].slice(0, 4).length ? [...unique.values()].slice(0, 4) : defaultBenchmarkKeywords(lead);
}

export async function buildLocalCompetitorBenchmark(lead: Lead, input?: { keywords?: unknown }) : Promise<LocalCompetitorBenchmark> {
  const city = lead.city?.trim();
  const country = lead.country?.trim() || lead.region?.trim();
  if (!city) throw new Error("Add a city to this lead before running a local competitor comparison.");
  if (!country) throw new Error("Add a country to this lead before running a local competitor comparison.");

  const keywords = normalizeBenchmarkKeywords(input?.keywords, lead);
  const knownTargetId = sourcePlaceId(lead);
  const profileQuery = [lead.company_name, city, country].filter(Boolean).join(", ");
  const profileResults = await searchGooglePlaces({ textQuery: profileQuery, country });
  let targetPlace = profileResults.find((place) => placeMatchesLead(place, lead, knownTargetId));
  const isTargetPlace = (place: GooglePlace) => {
    if (placeMatchesLead(place, lead, knownTargetId)) return true;
    return Boolean(targetPlace && businessKey(place) === businessKey(targetPlace));
  };
  const searches: Array<{ keyword: string; query: string; places: GooglePlace[] }> = [];
  const candidates = new Map<string, CandidateStat>();

  for (const keyword of keywords) {
    const query = queryForKeyword(keyword, city, country);
    const places = await searchGooglePlaces({
      textQuery: query,
      country,
      location: targetPlace?.location
    });
    const queryTarget = places.find(isTargetPlace);
    if (!targetPlace && queryTarget) targetPlace = queryTarget;

    places.forEach((place, index) => {
      if (isTargetPlace(place)) return;
      const key = businessKey(place);
      const current = candidates.get(key) ?? {
        business: asBusiness(place, lead),
        appearances: 0,
        rankTotal: 0
      };
      current.appearances += 1;
      current.rankTotal += index + 1;
      candidates.set(key, current);
    });
    searches.push({ keyword, query, places });
  }

  const target = targetPlace ? asBusiness(targetPlace, lead) : asBusiness({}, lead);
  const competitors = [...candidates.values()]
    .sort((left, right) => right.appearances - left.appearances || left.rankTotal - right.rankTotal || (right.business.reviewCount ?? 0) - (left.business.reviewCount ?? 0))
    .slice(0, 4)
    .map((candidate) => candidate.business);

  const keywordRows = searches.map(({ keyword, query, places }) => {
    const ranks = new Map(places.map((place, index) => [businessKey(place), index + 1]));
    const targetResult = places.find(isTargetPlace);
    return {
      keyword,
      query,
      targetRank: targetResult ? ranks.get(businessKey(targetResult)) ?? null : null,
      competitorRanks: Object.fromEntries(competitors.map((competitor) => [competitor.id, ranks.get(competitor.id) ?? null])),
      returnedResults: places.length
    };
  });

  const competitorRatings = competitors.flatMap((competitor) => competitor.rating === null ? [] : [competitor.rating]);
  const competitorReviews = competitors.flatMap((competitor) => competitor.reviewCount === null ? [] : [competitor.reviewCount]);
  const competitorAverageRating = roundedAverage(competitorRatings);
  const competitorMedianReviewCount = median(competitorReviews);
  const ratingGap = target.rating !== null && competitorAverageRating !== null
    ? Math.round((target.rating - competitorAverageRating) * 10) / 10
    : null;
  const reviewGap = target.reviewCount !== null && competitorMedianReviewCount !== null
    ? target.reviewCount - competitorMedianReviewCount
    : null;
  const findings = [rankFinding(target, keywordRows)];
  if (reviewGap !== null) {
    findings.push(reviewGap < 0
      ? `The comparison-group median is ${Math.abs(reviewGap).toLocaleString()} reviews ahead of ${target.name}.`
      : `${target.name} is ${reviewGap.toLocaleString()} reviews ahead of the comparison-group median.`);
  }
  if (ratingGap !== null && Math.abs(ratingGap) >= 0.1) {
    findings.push(ratingGap < 0
      ? `The comparison-group average rating is ${Math.abs(ratingGap).toFixed(1)} stars higher.`
      : `${target.name} is ${ratingGap.toFixed(1)} stars above the comparison-group average.`);
  }
  if (!competitors.length) findings.push("No comparable competitors were returned for these search terms. Try a broader niche keyword.");

  return {
    generatedAt: new Date().toISOString(),
    target,
    competitors,
    keywords: keywordRows,
    market: {
      city,
      country,
      anchoredToTarget: Boolean(targetPlace && hasUsableLocation(targetPlace.location)),
      resultLimit
    },
    comparison: {
      competitorAverageRating,
      competitorMedianReviewCount,
      ratingGap,
      reviewGap,
      findings
    },
    notice: "Google Maps local results combine relevance, distance, and prominence. This screen shows the returned order for the selected keyword and market at the time checked; it is not a universal Google Maps page position."
  };
}
