import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDbLead, listDbLeads } from "@/lib/dbStore";
import { defaultBenchmarkKeywords } from "@/lib/localCompetitorBenchmark";
import { listEnabledRegions } from "@/lib/regionStore";
import { isOperationsRole } from "@/lib/roles";
import { ReputationBenchmarkWorkspace } from "@/components/reputation/ReputationBenchmarkWorkspace";

export default async function ReputationPage({ searchParams }: { searchParams: Promise<{ leadId?: string; region?: string }> }) {
  const [user, query] = await Promise.all([currentUser(), searchParams]);
  if (!user) redirect("/login");
  if (!isOperationsRole(user.role)) redirect("/");

  const [regions, linkedLead] = await Promise.all([
    listEnabledRegions(user.organizationId),
    query.leadId ? getDbLead(query.leadId, user.organizationId) : null
  ]);
  const selectedRegion = query.region && regions.some((region) => region.name === query.region)
    ? query.region
    : linkedLead && regions.some((region) => region.name === linkedLead.region)
      ? linkedLead.region
      : regions[0]?.name ?? null;
  const leads = (selectedRegion ? await listDbLeads(selectedRegion, user.organizationId) : [])
    .filter((lead) => Boolean(lead.city && (lead.category || lead.business_type)))
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

  return <ReputationBenchmarkWorkspace
    leads={leads}
    initialLeadId={initialLeadId}
    selectedRegion={selectedRegion}
    regions={regions.map((region) => ({ name: region.name, label: region.label || region.name, country: region.country }))}
  />;
}
