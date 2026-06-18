"use client";

import { useEffect, useState } from "react";
import InsightsIcon from "@mui/icons-material/Insights";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import SpeedIcon from "@mui/icons-material/Speed";
import type { LeadIntelligenceAudit } from "@/lib/leadIntelligence";

export function LeadIntelligencePanel({ leadId }: { leadId: string }) {
  const [audit, setAudit] = useState<LeadIntelligenceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/leads/${leadId}/intelligence`).then((res) => res.json()).then((data) => {
      if (active) {
        setAudit(data.audit);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [leadId]);

  async function runAudit() {
    setRunning(true);
    const response = await fetch(`/api/leads/${leadId}/intelligence`, { method: "POST" });
    const data = await response.json();
    if (response.ok) setAudit(data.audit);
    setRunning(false);
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <InsightsIcon className="text-sky-200" fontSize="small" />
            <h2 className="font-semibold text-white">Lead intelligence</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Website audit snapshot, SEO opportunity flags, and recommended pitch angle.</p>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60"
        >
          <TravelExploreIcon fontSize="small" />
          {running ? "Auditing..." : audit ? "Refresh Audit" : "Run Audit"}
        </button>
      </div>

      {loading && <div className="mt-5 rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">Loading latest audit...</div>}

      {!loading && !audit && (
        <div className="mt-5 rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">
          No lead intelligence audit yet.
        </div>
      )}

      {audit && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-white/6 p-4 soft-border">
            <div className="text-xs uppercase text-slate-500">Lead fit summary</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{audit.fitSummary}</p>
            <div className="mt-3 rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border">{audit.recommendedPitch}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="flex items-center gap-2 text-sm text-slate-300"><SpeedIcon fontSize="small" />Rough speed</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.roughSpeedScore}/100</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Forms</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.formsCount}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Audit date</div>
              <div className="mt-2 text-sm text-white">{new Date(audit.auditedAt).toLocaleString()}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Website snapshot</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Title: {audit.title || "Missing"}</div>
                <div>Meta: {audit.metaDescription || "Missing"}</div>
                <div>H1: {audit.h1 || "Missing"}</div>
                <div>Viewport: {audit.hasViewportMeta ? "Yes" : "No"}</div>
                <div>Schema: {audit.hasSchema ? "Yes" : "No"}</div>
                <div>Robots: {audit.hasRobotsTxt ? "Yes" : "No"} · Sitemap: {audit.hasSitemapXml ? "Yes" : "No"}</div>
              </div>
            </div>
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">SEO opportunity flags</div>
              <div className="flex flex-wrap gap-2">
                {audit.seoFlags.length === 0 && <span className="rounded-md bg-emerald-400/12 px-3 py-1 text-sm text-emerald-100 soft-border">No major flags</span>}
                {audit.seoFlags.map((flag) => (
                  <span key={flag} className="rounded-md bg-amber-400/12 px-3 py-1 text-sm text-amber-100 soft-border">{flag}</span>
                ))}
              </div>
              <div className="mt-4 text-sm text-slate-400">Tech: {audit.techStack.length ? audit.techStack.join(", ") : "Not detected"}</div>
            </div>
          </div>

          {audit.error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{audit.error}</div>}
        </div>
      )}
    </section>
  );
}
