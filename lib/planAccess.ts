export const planOrder = ["starter", "growth", "agency_pro"] as const;

export type PlanKey = (typeof planOrder)[number];

export type FeatureKey =
  | "starter"
  | "growth"
  | "agency_pro";

function normalizePlan(plan?: string | null): PlanKey {
  return planOrder.includes(plan as PlanKey) ? plan as PlanKey : "starter";
}

export function planMeets(plan: string | null | undefined, required: FeatureKey) {
  return planOrder.indexOf(normalizePlan(plan)) >= planOrder.indexOf(required);
}

const growthPagePrefixes = [
  "/automation",
  "/campaigns",
  "/follow-up-reminders",
  "/not-responded",
  "/pipeline",
  "/projects",
  "/portal-users"
];

const agencyPagePrefixes = [
  "/adult-leads",
  "/ai-drafts",
  "/analytics",
  "/calls",
  "/compose-call",
  "/duplicates",
  "/employee-portal",
  "/export",
  "/opportunities",
  "/reports",
  "/staff",
  "/templates/whatsapp"
];

const growthApiPrefixes = [
  "/api/automation",
  "/api/follow-up-reminders",
  "/api/portal",
  "/api/outreach/send-approved"
];

const agencyApiPrefixes = [
  "/api/adult-leads",
  "/api/calls",
  "/api/duplicates",
  "/api/export",
  "/api/lead-categories",
  "/api/opportunities",
  "/api/reports",
  "/api/staff"
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function requiredPlanForPath(pathname: string): FeatureKey {
  if (agencyPagePrefixes.some((prefix) => matches(pathname, prefix))) return "agency_pro";
  if (growthPagePrefixes.some((prefix) => matches(pathname, prefix))) return "growth";
  if (agencyApiPrefixes.some((prefix) => matches(pathname, prefix))) return "agency_pro";
  if (growthApiPrefixes.some((prefix) => matches(pathname, prefix))) return "growth";
  return "starter";
}

export function canAccessPlanPath(plan: string | null | undefined, pathname: string) {
  return planMeets(plan, requiredPlanForPath(pathname));
}
