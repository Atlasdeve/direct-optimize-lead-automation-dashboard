import { Dashboard } from "@/components/Dashboard";
import { currentUser } from "@/lib/auth";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  const user = await currentUser().catch(() => null);
  return <Dashboard mode="leads" initialRegion={region} workspaceName={user?.organization?.companyName || "Direct Optimize"} />;
}
