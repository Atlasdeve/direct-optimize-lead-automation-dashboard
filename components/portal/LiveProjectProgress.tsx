"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectProgressView, type PortalProject } from "@/components/portal/ProjectProgressView";

export function LiveProjectProgress({ initialProject, viewer }: { initialProject: PortalProject; viewer: "admin" | "employee" | "client" }) {
  const [project, setProject] = useState(initialProject);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/portal/projects/${initialProject.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.project) setProject(data.project);
    } catch {
      // A later focus, notification, or fallback interval retries the sync.
    }
  }, [initialProject.id]);

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

  return <ProjectProgressView project={project} viewer={viewer} />;
}
