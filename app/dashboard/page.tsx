import { Dashboard } from "@/components/Dashboard";
import { currentUser } from "@/lib/auth";
import { listEnabledRegions } from "@/lib/regionStore";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  const user = await currentUser().catch(() => null);
  const availableRegions = await listEnabledRegions(user?.organizationId);
  const initialRegion = region && availableRegions.some((item) => item.name === region)
    ? region
    : availableRegions[0]?.name || "Canada";
  return <Dashboard mode="leads" initialRegion={initialRegion} workspaceName={user?.organization?.companyName || "Direct Optimize"} />;
}
