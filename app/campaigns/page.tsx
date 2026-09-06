import { CampaignBuilder } from "@/components/lead/CampaignBuilder";
import { currentUser } from "@/lib/auth";
import { listEnabledRegions } from "@/lib/regionStore";

export default async function CampaignsPage() {
  const user = await currentUser().catch(() => null);
  const regions = await listEnabledRegions(user?.organizationId);
  return <CampaignBuilder initialRegion={regions[0]?.name || "Canada"} />;
}
