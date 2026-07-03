import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/portalStore";
import { ClientProfileForm } from "@/components/portal/ClientProfileForm";

export default async function ClientProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect("/projects");
  const projects = await listProjectsForUser(user);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Client portal</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Client profile</h1>
        <p className="mt-2 text-sm text-slate-400">Manage your contact details and the business properties connected to your project.</p>
      </header>
      <ClientProfileForm user={user} projects={projects} />
    </div>
  );
}
