import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/portalStore";

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
      <section className="grid gap-3">
        {projects.map((project) => (
          <a key={project.id} href={`/projects/${project.id}`} className="glass rounded-xl p-4 transition hover:bg-white/7">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-white">{project.companyName}</div>
                <div className="mt-1 text-sm text-slate-400">{project.status} · {project.workLogs.length} updates · {project.totalHours}h</div>
              </div>
              <div className="text-2xl font-semibold text-sky-100">{project.progress}%</div>
            </div>
          </a>
        ))}
        {projects.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No assigned projects yet.</div>}
      </section>
    </div>
  );
}
