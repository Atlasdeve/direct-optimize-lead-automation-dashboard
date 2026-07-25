import { AdultLeadsWorkspace } from "@/components/adult-leads/AdultLeadsWorkspace";
import { listAdultLeads } from "@/lib/adultLeadStore";

export default async function AdultLeadsPage() {
  return <AdultLeadsWorkspace initialLeads={await listAdultLeads()} />;
}
