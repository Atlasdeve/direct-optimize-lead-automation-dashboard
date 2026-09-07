import { completeDbAutomation, createDbDemoLeads, createDbLeadsFromPlaces, discoverEmailForLead } from "@/lib/dbStore";
import { fetchPlacesLeads } from "@/lib/providers";
import { qualifyPlaceCandidates } from "@/lib/leadQualification";
import { withOrganizationProviderEnv } from "@/lib/organizationSettings";
import { getLeadDiscoveryCategories } from "@/lib/leadCategories";
import { prisma } from "@/lib/prisma";
import type { AutomationResult } from "@/lib/types";

export async function runAutomation(region: string, options?: { city?: string; categories?: string[]; maxResults?: number; organizationId?: string | null }): Promise<AutomationResult> {
  const effectiveOptions = options?.organizationId
    ? await resolveTenantDiscoveryOptions(options)
    : options;
  return withOrganizationProviderEnv(effectiveOptions?.organizationId, () => runAutomationWithEnv(region, effectiveOptions));
}

async function resolveTenantDiscoveryOptions(options: { city?: string; categories?: string[]; maxResults?: number; organizationId?: string | null }) {
  const savedCategories = await getLeadDiscoveryCategories(options.organizationId);
  const savedByKey = new Map(savedCategories.map((category) => [category.toLowerCase(), category]));
  const requestedCategories = (options.categories ?? [])
    .map((category) => savedByKey.get(category.trim().toLowerCase()))
    .filter((category): category is string => Boolean(category));
  return {
    ...options,
    categories: requestedCategories.length ? requestedCategories : savedCategories
  };
}

async function runAutomationWithEnv(region: string, options?: { city?: string; categories?: string[]; maxResults?: number; organizationId?: string | null }): Promise<AutomationResult> {
  const logs: string[] = [];
  let emailsSent = 0;
  let failedCount = 0;

  try {
    if (options?.city || options?.categories?.length) {
      logs.push(`Discovery target: ${(options.categories ?? []).join(", ") || "default niches"} in ${options.city || "default city"}.`);
    }
    const places = await fetchPlacesLeads(region, options);
    if (places.warning) logs.push(places.warning);
    logs.push(`Lead discovery source: ${places.provider}.`);

    const strictQualification = options?.organizationId
      ? (await prisma.organization.findUnique({ where: { id: options.organizationId }, select: { strictLeadQualification: true } }))?.strictLeadQualification ?? false
      : true;
    const qualification = strictQualification && places.records.length ? await qualifyPlaceCandidates(places.records) : null;
    if (qualification) {
      logs.push(`Qualified ${qualification.qualified.length} of ${places.records.length} discovered businesses as genuine service opportunities.`);
      if (qualification.rejected.length) {
        logs.push(`Rejected ${qualification.rejected.length} healthy, unreachable, or low-opportunity businesses.`);
      }
    } else if (places.records.length) {
      logs.push("Standard lead discovery rules are active for this workspace.");
    }

    const newLeads = places.records.length
      ? await createDbLeadsFromPlaces(region, (qualification?.qualified ?? places.records).slice(0, places.requestedResults), options?.organizationId)
      : options?.organizationId
        ? []
        : await createDbDemoLeads(region, options?.organizationId);
    if (!places.records.length && options?.organizationId) {
      logs.push("No live leads were imported. Check this workspace's Google Places key and API billing/quota before retrying.");
    }
    logs.push(`Stored ${newLeads.length} new lead(s) for ${region}.`);

    for (const lead of newLeads) {
      const discovery = await discoverEmailForLead(lead);
      if (discovery.updated) {
        lead.email = discovery.email ?? lead.email;
        lead.lead_score = Math.min(100, lead.lead_score + 15);
      }
      logs.push(`Enriched ${lead.company_name}: website=${lead.website ? "yes" : "no"}, phone=${lead.phone ? "yes" : "no"}, email=${lead.email ? "yes" : "no"}, score=${lead.lead_score}.`);

      logs.push(`Outreach for ${lead.company_name} is waiting for admin approval.`);

      logs.push(`WhatsApp number identification ${lead.phone ? "available from phone data" : "pending phone data"} for ${lead.company_name}.`);
    }

    const result: AutomationResult = {
      region,
      status: "completed",
      leadsFetched: newLeads.length,
      emailsSent,
      whatsappSent: 0,
      failedCount,
      logs
    };
    await completeDbAutomation(result, options?.organizationId);
    return result;
  } catch (error) {
    failedCount += 1;
    logs.push(error instanceof Error ? error.message : "Unknown automation failure.");
    const result: AutomationResult = {
      region,
      status: "failed",
      leadsFetched: 0,
      emailsSent,
      whatsappSent: 0,
      failedCount,
      logs
    };
    await completeDbAutomation(result, options?.organizationId);
    return result;
  }
}
