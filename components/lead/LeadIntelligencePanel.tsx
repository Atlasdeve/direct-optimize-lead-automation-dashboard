"use client";

import { useEffect, useState } from "react";
import InsightsIcon from "@mui/icons-material/Insights";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import SpeedIcon from "@mui/icons-material/Speed";
import DownloadIcon from "@mui/icons-material/Download";
import type { LeadIntelligenceAudit } from "@/lib/leadIntelligence";

function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-400 text-emerald-100";
  if (score >= 60) return "bg-sky-400 text-sky-100";
  if (score >= 40) return "bg-amber-400 text-amber-100";
  return "bg-rose-400 text-rose-100";
}

function ScoreBar({ label, score, detail }: { label: string; score: number; detail?: string }) {
  const tone = scoreTone(score);
  return (
    <div className="rounded-lg bg-white/6 p-3 soft-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{label}</div>
          {detail && <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>}
        </div>
        <div className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${tone.replace("bg-", "bg-").replace(" text-", "/15 text-")}`}>{score}/100</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/70">
        <div className={`h-full rounded-full ${tone.split(" ")[0]}`} style={{ width: `${Math.max(2, Math.min(score, 100))}%` }} />
      </div>
    </div>
  );
}

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAudit}
            disabled={running}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60"
          >
            <TravelExploreIcon fontSize="small" />
            {running ? "Auditing..." : audit ? "Refresh Website Audit" : "Run Website Audit"}
          </button>
          {audit ? (
            <a
              href={`/api/leads/${leadId}/intelligence/pdf`}
              download
              title="Download website audit PDF"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-white soft-border hover:bg-white/12"
            >
              <DownloadIcon fontSize="small" />
              Download PDF
            </a>
          ) : (
            <button disabled title="Run the website audit first" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-white opacity-45 soft-border">
              <DownloadIcon fontSize="small" />
              Download PDF
            </button>
          )}
        </div>
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

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Overall audit score</div>
              <div className="mt-2 text-3xl font-semibold text-white">{audit.overallScore ?? audit.roughSpeedScore}/100</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/70">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, Math.min(audit.overallScore ?? audit.roughSpeedScore, 100))}%` }} />
              </div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="flex items-center gap-2 text-sm text-slate-300"><SpeedIcon fontSize="small" />Rough speed</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.roughSpeedScore}/100</div>
              <div className="mt-1 text-xs text-slate-500">{audit.responseTimeMs ? `${audit.responseTimeMs}ms response` : "Response time unavailable"}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Scanned pages</div>
              <div className="mt-2 text-2xl font-semibold text-white">{audit.pagesScanned?.length ?? 1}</div>
              <div className="mt-1 text-xs text-slate-500">{audit.pageSizeKb ? `${audit.pageSizeKb}KB homepage` : "Page size unavailable"}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-sm text-slate-300">Audit date</div>
              <div className="mt-2 text-sm text-white">{new Date(audit.auditedAt).toLocaleString()}</div>
            </div>
          </div>

          {audit.scoreBreakdown && (
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Deep audit score graph</div>
              <div className="grid gap-3 md:grid-cols-2">
                {audit.scoreBreakdown.map((item) => (
                  <ScoreBar key={item.label} label={item.label} score={item.score} detail={item.detail} />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Website snapshot</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Final URL: {audit.finalUrl || audit.website || "Missing"}</div>
                <div>HTTP status: {audit.httpStatus || "Unknown"}</div>
                <div>Title: {audit.title || "Missing"}</div>
                <div>Meta: {audit.metaDescription || "Missing"}</div>
                <div>H1: {audit.h1 || "Missing"}</div>
                <div>Viewport: {yesNo(audit.hasViewportMeta)} · Canonical: {yesNo(audit.hasCanonical)} · Indexable: {yesNo(audit.hasIndexableRobotsMeta)}</div>
                <div>Schema: {yesNo(audit.hasSchema)}{audit.schemaTypes?.length ? ` · ${audit.schemaTypes.join(", ")}` : ""}</div>
                <div>Robots: {yesNo(audit.hasRobotsTxt)} · Sitemap: {yesNo(audit.hasSitemapXml)} · Open Graph: {yesNo(audit.hasOpenGraph)}</div>
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

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Content and links</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Words: {audit.contentWordCount ?? "Unknown"}</div>
                <div>Headings: {audit.headingsCount ?? "Unknown"}</div>
                <div>Internal links: {audit.internalLinksCount}</div>
                <div>External links: {audit.externalLinksCount ?? "Unknown"}</div>
                <div>Images missing alt: {audit.imagesMissingAlt ?? 0}/{audit.imagesCount}</div>
              </div>
            </div>
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Conversion signals</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Phone visible: {yesNo(audit.hasPhoneOnPage)}</div>
                <div>Email visible: {yesNo(audit.hasEmailOnPage)}</div>
                <div>Forms found: {audit.formsCount}</div>
                <div>Contact page: {yesNo(audit.contactPageFound)}</div>
                <div>Booking/quote CTA: {yesNo(audit.bookingSignalFound)}</div>
              </div>
            </div>
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Trust and security</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>Local signals: {audit.localSignalsCount ?? 0}</div>
                <div>Trust signals: {audit.trustSignalsCount ?? 0}</div>
                {(audit.securityHeaders ?? []).map((header) => (
                  <div key={header.label}>{header.label}: {header.present ? "Present" : "Missing"}</div>
                ))}
              </div>
            </div>
          </div>

          {audit.pagesScanned && audit.pagesScanned.length > 0 && (
            <div className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="mb-3 text-sm font-semibold text-white">Pages scanned</div>
              <div className="grid gap-2">
                {audit.pagesScanned.map((page) => (
                  <div key={page.url} className="rounded-lg bg-slate-950/35 p-3 text-sm soft-border">
                    <div className="truncate font-semibold text-white">{page.title || page.url}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{page.status || "Unknown"} · {page.url}</div>
                  </div>
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
