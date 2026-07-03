import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/portalStore";
import { LivePortalProjects } from "@/components/portal/LivePortalProjects";

export default async function EmployeePortalPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/client-portal");
  const projects = await listProjectsForUser(user);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Employee portal</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Assigned client work</h1>
        <p className="mt-2 text-sm text-slate-400">Submit daily work, time spent, changes made, and screenshot proof.</p>
      </header>
      <LivePortalProjects initialProjects={projects} viewer="employee" />
    </div>
  );
}
