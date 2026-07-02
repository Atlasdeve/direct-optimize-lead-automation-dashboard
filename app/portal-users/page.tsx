import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listPortalUsers } from "@/lib/portalStore";
import { UserAdminClient } from "@/components/portal/UserAdminClient";

export default async function PortalUsersPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const users = await listPortalUsers();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Access management</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Portal users</h1>
        <p className="mt-2 text-sm text-slate-400">Create employee and client accounts for delivery tracking.</p>
      </header>
      <UserAdminClient initialUsers={users} />
    </div>
  );
}
