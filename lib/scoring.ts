import type { Lead } from "@/lib/types";

const categoryMatches = ["seo", "restaurant", "clinic", "contractor", "real estate", "law", "dental", "salon"];

export type ScoreFactor = {
  label: string;
  points: number;
  active: boolean;
  detail: string;
};

export function leadScoreFactors(lead: Partial<Lead>): ScoreFactor[] {
  const category = `${lead.category ?? ""} ${lead.business_type ?? ""}`.toLowerCase();
  const contactForms = lead.contact_forms?.length ?? 0;

  return [
    {
      label: "No website opportunity",
      points: 25,
      active: !lead.website,
      detail: lead.website ? "Website exists" : "No live website detected"
    },
    {
      label: "Website foundation",
      points: 10,
      active: Boolean(lead.website),
      detail: lead.website ? "Website available for audit" : "Website pending"
    },
    {
      label: "Public email",
      points: 15,
      active: Boolean(lead.email),
      detail: lead.email ? "Email found" : "Email pending"
    },
    {
      label: "Phone number",
      points: 10,
      active: Boolean(lead.phone),
      detail: lead.phone ? "Phone available" : "Phone pending"
    },
    {
      label: "Contact form",
      points: 8,
      active: contactForms > 0,
      detail: contactForms > 0 ? `${contactForms} form target${contactForms === 1 ? "" : "s"} found` : "No contact form found"
    },
    {
      label: "Low rating opportunity",
      points: 10,
      active: typeof lead.rating === "number" && lead.rating < 3.8,
      detail: typeof lead.rating === "number" ? `Rating ${lead.rating}` : "Rating unavailable"
    },
    {
      label: "Low review volume",
      points: 10,
      active: typeof lead.review_count === "number" && lead.review_count < 10,
      detail: typeof lead.review_count === "number" ? `${lead.review_count} reviews` : "Review count unavailable"
    },
    {
      label: "SEO signal",
      points: 10,
      active: Boolean(lead.missing_seo_metadata),
      detail: lead.missing_seo_metadata ? "Missing SEO metadata detected" : "No SEO issue flagged"
    },
    {
      label: "Target category",
      points: 20,
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
