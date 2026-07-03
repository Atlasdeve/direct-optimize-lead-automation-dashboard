"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProjectProgressView, type PortalProject } from "@/components/portal/ProjectProgressView";
import { ClientCommentForm } from "@/components/portal/ClientCommentForm";

export function LivePortalProjects({ initialProjects, viewer }: { initialProjects: PortalProject[]; viewer: "employee" | "client" }) {
  const [projects, setProjects] = useState(initialProjects);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/projects", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setProjects(data.projects ?? []);
    } catch {
      // A later focus, notification, or fallback interval retries the sync.
    }
  }, []);

  useEffect(() => {
    const sync = () => void refresh();
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("portal-data-refresh", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    const fallback = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("portal-data-refresh", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(fallback);
    };
  }, [refresh]);

  if (viewer === "client") {
    return <>
      {projects.length === 0 && <div className="glass rounded-lg p-5 text-sm text-slate-300">No client project is connected to your account yet.</div>}
      {projects.map((project) => (
        <div key={project.id} className="space-y-5">
          <ClientCommentForm projectId={project.id} employeeName={project.employee?.name || project.employee?.email} />
          <ProjectProgressView project={project} viewer="client" />
        </div>
      ))}
    </>;
  }

  return <section className="grid gap-3">
    {projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="glass rounded-lg p-4 transition hover:bg-white/7">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-white">{project.companyName}</div>
          <div className="mt-1 text-sm text-slate-400">{project.status} · {project.workLogs.length} updates · {project.totalHours}h</div>
        </div>
        <div className="text-2xl font-semibold text-sky-100">{project.progress}%</div>
      </div>
    </Link>)}
    {projects.length === 0 && <div className="glass rounded-lg p-5 text-sm text-slate-300">No assigned projects yet.</div>}
  </section>;
}
