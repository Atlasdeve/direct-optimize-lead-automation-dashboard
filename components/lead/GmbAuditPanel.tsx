"use client";

import { useEffect, useState } from "react";
import MapIcon from "@mui/icons-material/Map";
import StarIcon from "@mui/icons-material/Star";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ScheduleIcon from "@mui/icons-material/Schedule";
import type { GmbAudit } from "@/lib/gmbAudit";

export function GmbAuditPanel({ leadId }: { leadId: string }) {
  const [audit, setAudit] = useState<GmbAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/leads/${leadId}/gmb-audit`).then((res) => res.json()).then((data) => {
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
    const response = await fetch(`/api/leads/${leadId}/gmb-audit`, { method: "POST" });
    const data = await response.json();
    if (response.ok) setAudit(data.audit);
    setRunning(false);
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapIcon className="text-emerald-200" fontSize="small" />
            <h2 className="font-semibold text-white">Google Business Profile audit</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Profile completeness, reviews, categories, hours, photos, and GMB opportunity flags.</p>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
        >
          {running ? "Auditing..." : audit ? "Refresh GMB Audit" : "Run GMB Audit"}
        </button>
      </div>

      {loading && <div className="mt-5 rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">Loading latest GMB audit...</div>}

      {!loading && !audit && (
        <div className="mt-5 rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">
          No GMB audit yet.
        </div>
      )}

      {audit && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-white/6 p-4 soft-border">
            <div className="text-xs uppercase text-slate-500">Recommended action</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{audit.recommendedAction}</p>
            <div className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-100 soft-border">{audit.reviewSummary}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Completeness</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.profileCompleteness}%</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="flex items-center gap-2 text-sm text-slate-300"><StarIcon fontSize="small" />Rating</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.rating ?? "N/A"}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Reviews</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.reviewCount ?? 0}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="flex items-center gap-2 text-sm text-slate-300"><PhotoCameraIcon fontSize="small" />Photos</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.photosCount}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Profile snapshot</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Name: {audit.name ?? "Unavailable"}</div>
                <div>Status: {audit.businessStatus ?? "Unavailable"}</div>
                <div>Address: {audit.address ?? "Unavailable"}</div>
                <div>Phone: {audit.phone ?? "Unavailable"}</div>
                <div>Website: {audit.website ?? "Unavailable"}</div>
                <div>Open now: {audit.openNow === null || audit.openNow === undefined ? "Unknown" : audit.openNow ? "Yes" : "No"}</div>
              </div>
            </div>
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">GMB opportunity flags</div>
              <div className="flex flex-wrap gap-2">
                {audit.gmbFlags.length === 0 && <span className="rounded-md bg-emerald-400/12 px-3 py-1 text-sm text-emerald-100 soft-border">No major profile gaps</span>}
                {audit.gmbFlags.map((flag) => (
                  <span key={flag} className="rounded-md bg-amber-400/12 px-3 py-1 text-sm text-amber-100 soft-border">{flag}</span>
                ))}
              </div>
              <div className="mt-4 text-sm text-slate-400">Categories: {audit.categories.length ? audit.categories.slice(0, 8).join(", ") : "Unavailable"}</div>
            </div>
          </div>

          {audit.weekdayText.length > 0 && (
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ScheduleIcon fontSize="small" />Business hours</div>
              <div className="grid gap-2 md:grid-cols-2">
                {audit.weekdayText.map((line) => (
                  <div key={line} className="text-sm text-slate-300">{line}</div>
                ))}
              </div>
            </div>
          )}

          {audit.error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{audit.error}</div>}
        </div>
      )}
    </section>
  );
}
