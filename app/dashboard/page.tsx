import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  return <Dashboard mode="leads" initialRegion={region} />;
}
