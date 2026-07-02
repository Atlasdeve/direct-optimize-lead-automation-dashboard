import { auditLeadWebsite } from "@/lib/leadIntelligence";
import { scoreLead } from "@/lib/scoring";
import type { Lead, PlaceLeadCandidate } from "@/lib/types";

export type QualifiedPlaceCandidate = PlaceLeadCandidate & {
  missingSeoMetadata: boolean;
  websiteAuditFlags: string[];
  qualificationReasons: string[];
  qualificationScore: number;
};

export type LeadQualificationResult = {
  qualified: QualifiedPlaceCandidate[];
  rejected: Array<{ companyName: string; reasons: string[] }>;
};

function candidateAsLead(candidate: PlaceLeadCandidate): Lead {
  const now = new Date().toISOString();
  return {
    id: candidate.placeId,
    company_name: candidate.companyName,
    region: candidate.region,
    country: candidate.country,
    city: candidate.city,
    category: candidate.category,
    business_type: candidate.businessType,
    website: candidate.website,
    google_maps_url: candidate.googleMapsUrl,
    phone: candidate.phone,
    email: null,
    whatsapp_available: false,
    whatsapp_status: "unknown",
    source_platform: `google_places:${candidate.placeId}`,
    lead_score: 0,
    outreach_status: "New",
    outreach_approved: false,
    email_sent: false,
    whatsapp_sent: false,
    replied: false,
    rating: candidate.rating ?? undefined,
    review_count: candidate.reviewCount ?? undefined,
    missing_seo_metadata: false,
    do_not_contact: false,
    consent_status: "legitimate_interest",
    unsubscribed: false,
    created_at: now,
    updated_at: now
  };
}

function gmbOpportunityReasons(candidate: PlaceLeadCandidate) {
  const reasons: string[] = [];
  if (candidate.rating == null) reasons.push("GMB rating is missing");
  else if (candidate.rating < 4) reasons.push(`GMB rating is below 4.0 (${candidate.rating})`);
  else if (candidate.rating < 4.3) reasons.push(`GMB rating has improvement room (${candidate.rating})`);

  if (candidate.reviewCount == null) reasons.push("GMB review volume is unavailable");
  else if (candidate.reviewCount < 10) reasons.push(`Very low GMB review volume (${candidate.reviewCount})`);
  else if (candidate.reviewCount < 25) reasons.push(`Low GMB review volume (${candidate.reviewCount})`);
  else if (candidate.reviewCount < 50) reasons.push(`Limited GMB review depth (${candidate.reviewCount})`);
  return reasons;
}

async function qualifyCandidate(candidate: PlaceLeadCandidate) {
  if (candidate.businessStatus && candidate.businessStatus !== "OPERATIONAL") {
    return { qualified: false as const, reasons: [`Business is ${candidate.businessStatus.toLowerCase().replaceAll("_", " ")}`] };
  }

  const audit = await auditLeadWebsite(candidateAsLead(candidate));
  const usableSeoFlags = audit.seoFlags.filter((flag) => flag !== "Website audit failed");
  const missingSeoMetadata = Boolean(candidate.website) && usableSeoFlags.length >= 2;
  const reasons = gmbOpportunityReasons(candidate);

  if (!candidate.website) reasons.unshift("No business website detected");
  else if (audit.error) reasons.unshift("Existing website could not be reliably accessed");
  else if (missingSeoMetadata) reasons.unshift(`Website audit found ${usableSeoFlags.length} SEO/conversion gaps`);

  const contactable = Boolean(candidate.phone || candidate.website);
  if (!contactable) {
    return { qualified: false as const, reasons: ["No usable website or phone contact path"] };
  }

  const qualificationScore = scoreLead({
    ...candidateAsLead(candidate),
    missing_seo_metadata: missingSeoMetadata
  });
  const hasGmbNeed = candidate.rating == null || candidate.rating < 4.3 || candidate.reviewCount == null || candidate.reviewCount < 25;
  const hasMaterialNeed = !candidate.website || missingSeoMetadata || Boolean(audit.error) || hasGmbNeed;

  if (!hasMaterialNeed || qualificationScore < 28) {
    return {
      qualified: false as const,
      reasons: reasons.length ? reasons : ["Strong public presence with no material opportunity detected"]
    };
  }

  return {
    qualified: true as const,
    candidate: {
      ...candidate,
      missingSeoMetadata,
      websiteAuditFlags: usableSeoFlags,
      qualificationReasons: reasons,
      qualificationScore
    }
  };
}

export async function qualifyPlaceCandidates(candidates: PlaceLeadCandidate[], concurrency = 4): Promise<LeadQualificationResult> {
  const results: Awaited<ReturnType<typeof qualifyCandidate>>[] = [];
  for (let index = 0; index < candidates.length; index += concurrency) {
    results.push(...(await Promise.all(candidates.slice(index, index + concurrency).map(qualifyCandidate))));
  }

  const qualified: QualifiedPlaceCandidate[] = [];
  const rejected: LeadQualificationResult["rejected"] = [];
  results.forEach((result, index) => {
    if (result.qualified) qualified.push(result.candidate);
    else rejected.push({ companyName: candidates[index].companyName, reasons: result.reasons });
  });
  return { qualified, rejected };
}
