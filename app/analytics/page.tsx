import { Dashboard } from "@/components/Dashboard";
import { currentUser } from "@/lib/auth";

export default async function AnalyticsPage() {
  const user = await currentUser().catch(() => null);
  return <Dashboard mode="overview" workspaceName={user?.organization?.companyName || "Direct Optimize"} />;
}
