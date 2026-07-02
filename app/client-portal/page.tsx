import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/portalStore";
import { ProjectProgressView } from "@/components/portal/ProjectProgressView";

export default async function ClientPortalPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect("/projects");
  const projects = await listProjectsForUser(user);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Client portal</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Work progress</h1>
        <p className="mt-2 text-sm text-slate-400">Transparent daily updates, time spent, screenshots, and progress graphs.</p>
      </header>
      {projects.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No client project is connected to your account yet.</div>}
      {projects.map((project) => <ProjectProgressView key={project.id} project={project} viewer="client" />)}
    </div>
  );
}
