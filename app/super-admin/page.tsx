import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/roles";
import { listOrganizations, saasPlans } from "@/lib/saasStore";
import { SuperAdminClient } from "@/components/super-admin/SuperAdminClient";

export default async function SuperAdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isSuperAdminRole(user.role)) redirect("/");
  const organizations = await listOrganizations();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-emerald-300">SaaS control center</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Super Admin</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Onboard client companies, assign packages, pause or activate systems, and track setup/API readiness from one place.
        </p>
      </header>
      <SuperAdminClient initialOrganizations={organizations} plans={saasPlans} />
    </div>
  );
}
