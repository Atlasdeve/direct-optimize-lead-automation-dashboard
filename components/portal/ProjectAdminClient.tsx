"use client";

import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import type { PortalProject } from "@/components/portal/ProjectProgressView";

type UserOption = { id: string; name?: string | null; email: string; role: string };

export function ProjectAdminClient({ initialProjects }: { initialProjects: PortalProject[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [clients, setClients] = useState<UserOption[]>([]);
  const [employees, setEmployees] = useState<UserOption[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [gmbUrl, setGmbUrl] = useState("");
  const [clientUserId, setClientUserId] = useState("");
  const [employeeUserId, setEmployeeUserId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/users?role=client").then((res) => res.json()),
      fetch("/api/portal/users?role=employee").then((res) => res.json())
    ]).then(([clientData, employeeData]) => {
      setClients(clientData.users ?? []);
      setEmployees(employeeData.users ?? []);
    });
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/portal/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, websiteUrl, gmbUrl, clientUserId, employeeUserId })
    });
    const data = await response.json();
    setBusy(false);
    if (response.ok) {
      setProjects([data.project, ...projects]);
      setCompanyName("");
      setWebsiteUrl("");
      setGmbUrl("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">Create client project</h2>
        <form onSubmit={createProject} className="mt-4 grid gap-3 lg:grid-cols-5">
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="Website URL" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={gmbUrl} onChange={(event) => setGmbUrl(event.target.value)} placeholder="GMB URL" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <select value={clientUserId} onChange={(event) => setClientUserId(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300">
            <option value="">Client account</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name || client.email}</option>)}
          </select>
          <select value={employeeUserId} onChange={(event) => setEmployeeUserId(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300">
            <option value="">Assign employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name || employee.email}</option>)}
          </select>
          <button disabled={busy || !companyName} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60 lg:col-span-5">
            <AddIcon fontSize="small" />
            {busy ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        {projects.map((project) => (
          <a key={project.id} href={`/projects/${project.id}`} className="glass rounded-xl p-4 transition hover:bg-white/7">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-white">{project.companyName}</div>
                <div className="mt-1 text-sm text-slate-400">{project.status} · {project.totalHours}h logged · {project.employee?.name || "Unassigned"}</div>
              </div>
              <div className="text-2xl font-semibold text-sky-100">{project.progress}%</div>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
