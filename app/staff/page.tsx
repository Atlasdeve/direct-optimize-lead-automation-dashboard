import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { listStaffAccounts } from "@/lib/staffStore";
import { StaffAccountsClient } from "@/components/staff/StaffAccountsClient";

export default async function StaffPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/");
  const staff = await listStaffAccounts(user.role === "super_admin" ? undefined : user.organizationId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-emerald-300">Access management</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Staff Accounts</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Create individual administrator and manager credentials for people who help operate the dashboard.</p>
      </header>
      <StaffAccountsClient initialStaff={staff} />
    </div>
  );
}
