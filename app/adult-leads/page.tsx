import { AdultLeadsWorkspace } from "@/components/adult-leads/AdultLeadsWorkspace";
import { currentUser } from "@/lib/auth";
import { getAdultLeadAutomationOverview } from "@/lib/adultLeadAutomation";
import { listAdultLeadCountries, listAdultLeads } from "@/lib/adultLeadStore";
import { getActiveAdultLeadReminderMap } from "@/lib/followUpReminders";

export default async function AdultLeadsPage() {
  const user = await currentUser();
  const organizationId = user?.organizationId;
  const [initialLeads, initialCountries, initialAutomation, initialReminders] = await Promise.all([
    listAdultLeads({ organizationId }),
    listAdultLeadCountries(),
    getAdultLeadAutomationOverview(),
    getActiveAdultLeadReminderMap(organizationId)
  ]);
  return <AdultLeadsWorkspace initialLeads={initialLeads} initialCountries={initialCountries} initialAutomation={initialAutomation} initialReminders={initialReminders} />;
}
