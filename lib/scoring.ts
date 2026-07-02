import type { Lead } from "@/lib/types";

const categoryMatches = ["restaurant", "clinic", "contractor", "real estate", "law", "dental", "dentist", "salon", "roofing"];

export type ScoreFactor = {
  label: string;
  points: number;
  active: boolean;
  detail: string;
};

export function leadScoreFactors(lead: Partial<Lead>): ScoreFactor[] {
  const category = `${lead.category ?? ""} ${lead.business_type ?? ""}`.toLowerCase();
  const contactForms = lead.contact_forms?.length ?? 0;
  const reviewCount = lead.review_count;
  const reviewPoints = typeof reviewCount !== "number" ? 10 : reviewCount < 10 ? 20 : reviewCount < 25 ? 15 : reviewCount < 50 ? 8 : 0;
  const rating = lead.rating;
  const ratingPoints = typeof rating !== "number" ? 8 : rating < 4 ? 18 : rating < 4.3 ? 10 : 0;

  return [
    {
      label: "No website opportunity",
      points: 35,
      active: !lead.website,
      detail: lead.website ? "Website exists" : "No live website detected"
    },
    {
      label: "Website SEO/conversion gaps",
      points: 22,
      active: Boolean(lead.website && lead.missing_seo_metadata),
      detail: lead.missing_seo_metadata ? "Multiple website audit issues detected" : "No material website issue flagged"
    },
    {
      label: "Public email",
      points: 10,
      active: Boolean(lead.email),
      detail: lead.email ? "Email found" : "Email pending"
    },
    {
      label: "Phone number",
      points: 8,
      active: Boolean(lead.phone),
      detail: lead.phone ? "Phone available" : "Phone pending"
    },
    {
      label: "Contact form",
      points: 7,
      active: contactForms > 0,
      detail: contactForms > 0 ? `${contactForms} form target${contactForms === 1 ? "" : "s"} found` : "No contact form found"
    },
    {
      label: "GMB rating opportunity",
      points: ratingPoints,
      active: ratingPoints > 0,
      detail: typeof rating === "number" ? `Rating ${rating}` : "Rating unavailable"
    },
    {
      label: "Low review volume",
      points: reviewPoints,
      active: reviewPoints > 0,
      detail: typeof reviewCount === "number" ? `${reviewCount} reviews` : "Review count unavailable"
    },
    {
      label: "Target category",
      points: 5,
      active: categoryMatches.some((match) => category.includes(match)),
      detail: category || "Category pending"
    }
  ];
}

export function scoreLead(lead: Partial<Lead>) {
  return Math.min(100, leadScoreFactors(lead).reduce((score, factor) => score + (factor.active ? factor.points : 0), 0));
}

export function leadQualityLabel(score: number) {
  if (score >= 75) return "High priority";
  if (score >= 45) return "Review";
  return "Low priority";
}
