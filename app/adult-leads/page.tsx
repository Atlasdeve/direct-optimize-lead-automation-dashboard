import { AdultLeadsWorkspace } from "@/components/adult-leads/AdultLeadsWorkspace";
import { listAdultLeadCountries, listAdultLeads } from "@/lib/adultLeadStore";

export default async function AdultLeadsPage() {
  const [initialLeads, initialCountries] = await Promise.all([
    listAdultLeads(),
    listAdultLeadCountries()
  ]);
  return <AdultLeadsWorkspace initialLeads={initialLeads} initialCountries={initialCountries} />;
}
