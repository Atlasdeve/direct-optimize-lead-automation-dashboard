"use client";

import { useState } from "react";
import WorkIcon from "@mui/icons-material/Work";
import type { Lead } from "@/lib/types";

export function CreateProjectFromLeadButton({ lead, existingProjectId }: { lead: Lead; existingProjectId?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createProject() {
    if (existingProjectId) {
      window.location.href = `/projects/${existingProjectId}`;
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/portal/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        companyName: lead.company_name,
        websiteUrl: lead.website,
        gmbUrl: lead.google_maps_url,
        status: "Onboarding",
        progress: 5,
        notes: "Project created from finalized lead."
      })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Project could not be created.");
      return;
    }
    window.location.href = `/projects/${data.project.id}`;
  }

  return (
    <div className="mt-4">
      <button onClick={createProject} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
        <WorkIcon fontSize="small" />
        {busy ? "Creating..." : existingProjectId ? "Open client project" : "Create client project"}
      </button>
      {message && <div className="mt-2 rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{message}</div>}
    </div>
  );
}
