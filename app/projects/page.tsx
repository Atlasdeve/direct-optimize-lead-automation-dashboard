import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/portalStore";
import { ProjectAdminClient } from "@/components/portal/ProjectAdminClient";

export default async function ProjectsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "employee") redirect("/employee-portal");
  if (user.role === "client") redirect("/client-portal");
  const projects = await listProjectsForUser(user);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Admin delivery portal</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Client projects</h1>
        <p className="mt-2 text-sm text-slate-400">Create client logins, assign employees, and monitor daily proof-of-work updates.</p>
      </header>
      <ProjectAdminClient initialProjects={projects} />
    </div>
  );
}
