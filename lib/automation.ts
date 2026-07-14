import { completeDbAutomation, createDbDemoLeads, createDbLeadsFromPlaces, discoverEmailForLead } from "@/lib/dbStore";
import { fetchPlacesLeads } from "@/lib/providers";
import { qualifyPlaceCandidates } from "@/lib/leadQualification";
import type { AutomationResult } from "@/lib/types";

export async function runAutomation(region: string, options?: { city?: string; categories?: string[]; maxResults?: number }): Promise<AutomationResult> {
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

    const qualification = places.records.length ? await qualifyPlaceCandidates(places.records) : null;
    if (qualification) {
      logs.push(`Qualified ${qualification.qualified.length} of ${places.records.length} discovered businesses as genuine service opportunities.`);
      if (qualification.rejected.length) {
        logs.push(`Rejected ${qualification.rejected.length} healthy, unreachable, or low-opportunity businesses.`);
      }
    }

    const newLeads = places.records.length
      ? await createDbLeadsFromPlaces(region, (qualification?.qualified ?? []).slice(0, places.requestedResults))
      : await createDbDemoLeads(region);
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
    await completeDbAutomation(result);
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
    await completeDbAutomation(result);
    return result;
  }
}
