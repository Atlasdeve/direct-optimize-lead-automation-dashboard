import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listDbLeads } from "@/lib/dbStore";
import { defaultBenchmarkKeywords } from "@/lib/localCompetitorBenchmark";
import { isOperationsRole } from "@/lib/roles";
import { ReputationBenchmarkWorkspace } from "@/components/reputation/ReputationBenchmarkWorkspace";

export default async function ReputationPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const [user, query] = await Promise.all([currentUser(), searchParams]);
  if (!user) redirect("/login");
  if (!isOperationsRole(user.role)) redirect("/");

  const leads = (await listDbLeads(undefined, user.organizationId))
    .filter((lead) => Boolean(lead.city && (lead.category || lead.business_type)))
    .slice(0, 300)
    .map((lead) => ({
      id: lead.id,
      companyName: lead.company_name,
      city: lead.city,
      country: lead.country,
      category: lead.category,
      businessType: lead.business_type,
      rating: lead.rating ?? null,
      reviewCount: lead.review_count ?? null,
      suggestedKeywords: defaultBenchmarkKeywords(lead)
    }));
  const initialLeadId = query.leadId && leads.some((lead) => lead.id === query.leadId)
    ? query.leadId
    : leads[0]?.id ?? null;

  return <ReputationBenchmarkWorkspace leads={leads} initialLeadId={initialLeadId} />;
}
