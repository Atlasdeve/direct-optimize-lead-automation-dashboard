"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

type DecisionMakerPanelProps = {
  leadId: string;
  name?: string | null;
  title?: string | null;
  source?: string | null;
  confidence?: number | null;
  linkedinUrl?: string | null;
};

export function DecisionMakerPanel({ leadId, name, title, source, confidence, linkedinUrl }: DecisionMakerPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function findDecisionMaker() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/leads/${leadId}/enrich`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Decision-maker search failed.");
      setBusy(false);
      return;
    }
    setMessage(data.decisionMakerFound ? "Decision maker found." : "No verified decision maker was found for this domain.");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PersonSearchIcon className="text-sky-300" fontSize="small" />
            <h2 className="font-semibold text-white">Decision maker</h2>
          </div>
          {name ? (
            <div className="mt-4">
              <div className="text-xl font-semibold text-white">{name}</div>
              <div className="mt-1 text-sm text-slate-300">{title || "Role unavailable"}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-md bg-white/6 px-2 py-1 soft-border">Confidence {confidence ?? 0}%</span>
                <span className="rounded-md bg-white/6 px-2 py-1 soft-border">Source: {source || "Public data"}</span>
                {linkedinUrl && (
                  <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-sky-400/10 px-2 py-1 text-sky-200 soft-border hover:bg-sky-400/20">
                    <LinkedInIcon sx={{ fontSize: 14 }} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Search the company domain for an owner, founder, executive, or manager.</p>
          )}
        </div>
        <button type="button" onClick={findDecisionMaker} disabled={busy} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-60">
          <PersonSearchIcon fontSize="small" />
          {busy ? "Searching..." : name ? "Refresh contact" : "Find decision maker"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-sky-200" role="status">{message}</p>}
      {name && (confidence ?? 0) < 70 && (
        <p className="mt-4 text-xs text-amber-200">Low-confidence match. Ask for the owner or marketing decision maker instead of relying on the name.</p>
      )}
    </section>
  );
}
