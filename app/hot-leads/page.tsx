import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listHotEmailLeads } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";
import { HotLeadsClient } from "@/components/HotLeadsClient";

export default async function HotLeadsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/hot-leads");
  if (!isOperationsRole(user.role)) redirect("/");

  const leads = await listHotEmailLeads();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-semibold text-emerald-200">Email engagement</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Hot leads</h1>
        <p className="mt-2 text-sm text-slate-400">
          Leads who opened or clicked tracked outreach emails. Clicks include UTM tags for Google Analytics and are mapped back to the exact lead here.
        </p>
      </header>

      <HotLeadsClient initialLeads={leads} />
    </div>
  );
}
