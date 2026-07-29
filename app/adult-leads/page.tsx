import { AdultLeadsWorkspace } from "@/components/adult-leads/AdultLeadsWorkspace";
import { getAdultLeadAutomationOverview } from "@/lib/adultLeadAutomation";
import { listAdultLeadCountries, listAdultLeads } from "@/lib/adultLeadStore";
import { getActiveAdultLeadReminderMap } from "@/lib/followUpReminders";

export default async function AdultLeadsPage() {
  const [initialLeads, initialCountries, initialAutomation, initialReminders] = await Promise.all([
    listAdultLeads(),
    listAdultLeadCountries(),
    getAdultLeadAutomationOverview(),
    getActiveAdultLeadReminderMap()
  ]);
  return <AdultLeadsWorkspace initialLeads={initialLeads} initialCountries={initialCountries} initialAutomation={initialAutomation} initialReminders={initialReminders} />;
}
