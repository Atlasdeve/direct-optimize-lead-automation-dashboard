"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StorefrontIcon from "@mui/icons-material/Storefront";
import type { BenchmarkBusiness, LocalCompetitorBenchmark } from "@/lib/localCompetitorBenchmark";

type LeadOption = {
  id: string;
  companyName: string;
  city: string;
  country: string;
  category: string;
  businessType: string;
  rating: number | null;
  reviewCount: number | null;
  suggestedKeywords: string[];
};

type RegionOption = {
  name: string;
  label: string;
  country: string;
};

function formatNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function formatRating(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

function rankLabel(rank: number | null, limit: number) {
  return rank === null ? `Not in first ${limit}` : `#${rank}`;
}

function rankTone(rank: number | null) {
  if (rank === null) return "bg-slate-500/12 text-slate-300";
  if (rank <= 3) return "bg-emerald-400/15 text-emerald-100";
  if (rank <= 10) return "bg-sky-400/15 text-sky-100";
  return "bg-amber-400/15 text-amber-100";
}

function keywordKey(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function parseKeywordList(value: string) {
  const unique = new Map<string, string>();
  for (const item of value.split(/[\n,]+/)) {
    const keyword = item.trim().replace(/\s+/g, " ");
    if (keyword.length < 2 || keyword.length > 120) continue;
    unique.set(keywordKey(keyword), keyword);
  }
  return [...unique.values()].slice(0, 4);
}

function businessLabel(business: BenchmarkBusiness) {
  return business.name || "Unnamed business";
}

function MetricCard({ label, value, detail, tone = "sky" }: { label: string; value: string; detail: string; tone?: "sky" | "emerald" | "amber" | "violet" }) {
  const toneClass = {
    sky: "bg-sky-400/12 text-sky-100",
    emerald: "bg-emerald-400/12 text-emerald-100",
    amber: "bg-amber-400/12 text-amber-100",
    violet: "bg-violet-400/12 text-violet-100"
  }[tone];
  return (
    <div className="rounded-2xl bg-white/6 p-4 soft-border">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{detail}</span>
      </div>
    </div>
  );
}

function RegionPicker({ regions, selectedRegion, onSelect }: { regions: RegionOption[]; selectedRegion: string | null; onSelect: (region: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">Select region</div>
        <p className="mt-1 text-xs text-slate-400">Only comparison-ready leads from the selected region are shown below.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {regions.map((region) => {
          const active = selectedRegion === region.name;
          return (
            <button
              key={region.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(region.name)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition soft-border ${active ? "bg-sky-300 text-slate-950" : "bg-white/7 text-slate-200 hover:bg-white/12 hover:text-white"}`}
            >
              {region.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BusinessRow({ business, target }: { business: BenchmarkBusiness; target?: boolean }) {
  return (
    <tr className={target ? "bg-sky-400/[0.07]" : ""}>
      <td className="min-w-[15rem] px-4 py-4 align-top">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${target ? "bg-sky-300 text-slate-950" : "bg-white/8 text-slate-200"}`}>
            <StorefrontIcon fontSize="small" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{businessLabel(business)}</span>
              {target && <span className="rounded-full bg-sky-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-950">Your target</span>}
            </div>
            <div className="mt-1 max-w-sm truncate text-xs text-slate-400" title={business.address ?? undefined}>{business.address || "Address not returned"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="inline-flex items-center gap-1 rounded-lg bg-amber-400/12 px-2.5 py-1.5 text-sm font-semibold text-amber-100"><StarIcon fontSize="inherit" /> {formatRating(business.rating)}</div>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold text-white">{formatNumber(business.reviewCount)}</td>
      <td className="max-w-[13rem] px-4 py-4 align-top text-sm text-slate-300">{business.category || "Not returned"}</td>
      <td className="px-4 py-4 align-top">
        {business.mapsUrl ? <a href={business.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-200 hover:text-white">Open <OpenInNewIcon fontSize="inherit" /></a> : <span className="text-sm text-slate-500">Unavailable</span>}
      </td>
    </tr>
  );
}

export function ReputationBenchmarkWorkspace({
  leads,
  initialLeadId,
  selectedRegion,
  regions
}: {
  leads: LeadOption[];
  initialLeadId: string | null;
  selectedRegion: string | null;
  regions: RegionOption[];
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(initialLeadId || "");
  const [keywordsText, setKeywordsText] = useState("");
  const [benchmark, setBenchmark] = useState<LocalCompetitorBenchmark | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const selectedLead = useMemo(() => leads.find((lead) => lead.id === leadId) ?? null, [leadId, leads]);
  const selectedKeywordKeys = new Set(parseKeywordList(keywordsText).map(keywordKey));

  useEffect(() => {
    setLeadId(initialLeadId || "");
    setBenchmark(null);
    setError("");
  }, [initialLeadId, selectedRegion]);

  useEffect(() => {
    setKeywordsText(selectedLead?.suggestedKeywords.join("\n") || "");
    setBenchmark(null);
    setError("");
  }, [selectedLead?.id]);

  function selectRegion(region: string) {
    if (region === selectedRegion) return;
    const params = new URLSearchParams({ region });
    router.push(`/reputation?${params.toString()}`);
  }

  function useSuggestedKeywords() {
    setKeywordsText(selectedLead?.suggestedKeywords.join("\n") || "");
  }

  function toggleSuggestedKeyword(keyword: string) {
    setKeywordsText((current) => {
      const keywords = parseKeywordList(current);
      const key = keywordKey(keyword);
      if (keywords.some((item) => keywordKey(item) === key)) {
        return keywords.filter((item) => keywordKey(item) !== key).join("\n");
      }
      return [...keywords.slice(0, 3), keyword].join("\n");
    });
  }

  async function runBenchmark() {
    if (!selectedLead || running) return;
    const keywords = parseKeywordList(keywordsText);
    setRunning(true);
    setError("");
    const response = await fetch("/api/reputation/benchmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId: selectedLead.id, keywords })
    });
    const data = await response.json().catch(() => ({}));
    setRunning(false);
    if (!response.ok) {
      setError(data.error || "The live competitor comparison could not be completed.");
      return;
    }
    setBenchmark(data.benchmark);
  }

  if (!leads.length) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <div className="text-sm font-semibold text-sky-200">Google Business Profile</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Local Competitor Benchmark</h1>
        </header>
        <section className="glass rounded-[28px] p-6">
          <RegionPicker regions={regions} selectedRegion={selectedRegion} onSelect={selectRegion} />
          <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-400/15 text-sky-100 soft-border"><CompareArrowsIcon /></span><div><h2 className="text-lg font-semibold text-white">No comparison-ready leads in this region</h2><p className="mt-1 text-sm text-slate-300">Add or import a lead with a city and business category before running a local comparison.</p></div></div>
        </section>
      </div>
    );
  }

  const comparison = benchmark?.comparison;
  const ratingGapLabel = comparison?.ratingGap === null || comparison?.ratingGap === undefined
    ? "No rating comparison"
    : `${comparison.ratingGap >= 0 ? "+" : ""}${comparison.ratingGap.toFixed(1)} vs group`;
  const reviewGapLabel = comparison?.reviewGap === null || comparison?.reviewGap === undefined
    ? "No review comparison"
    : `${comparison.reviewGap >= 0 ? "+" : ""}${comparison.reviewGap.toLocaleString()} vs median`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-sky-200">Google Business Profile</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Local Competitor Benchmark</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Compare a business against the most relevant local competitors by rating, review volume, category, and live Google Places search position.</p>
        </div>
        {benchmark && <div className="rounded-full bg-emerald-400/12 px-4 py-2 text-xs font-semibold text-emerald-100 soft-border">Live check · {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(benchmark.generatedAt))}</div>}
      </header>

      <section className="glass rounded-[28px] p-5 sm:p-6">
        <RegionPicker regions={regions} selectedRegion={selectedRegion} onSelect={selectRegion} />
        <div className="my-6 border-t border-white/10" />
        <div className="grid gap-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-200">Client or lead business
              <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-slate-950/45 px-3 text-white outline-none focus:border-sky-300">
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.companyName} · {lead.city}</option>)}
              </select>
            </label>
            <div className="rounded-2xl bg-white/[0.055] px-4 py-3 text-xs leading-5 text-slate-300 soft-border">{leads.length.toLocaleString()} comparison-ready {leads.length === 1 ? "lead" : "leads"} in this region.</div>
          </div>
          <div className="border-t border-white/10" />
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-slate-200">Keywords to compare <span className="text-xs font-normal text-slate-400">Automatically suggested from the selected business type and city. One per line, up to four.</span>
              <textarea value={keywordsText} onChange={(event) => setKeywordsText(event.target.value)} rows={3} maxLength={500} className="resize-y rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300" placeholder="pest control Calgary\nemergency pest control Calgary" />
            </label>
            {selectedLead && <div className="rounded-2xl bg-white/[0.045] p-3 soft-border">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-200">Recommended local keywords</span><button type="button" onClick={useSuggestedKeywords} className="text-xs font-semibold text-sky-200 hover:text-white">Use all suggestions</button></div>
              <div className="mt-2 flex flex-wrap gap-2">{selectedLead.suggestedKeywords.map((keyword) => {
                const selected = selectedKeywordKeys.has(keywordKey(keyword));
                return <button key={keyword} type="button" onClick={() => toggleSuggestedKeyword(keyword)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition soft-border ${selected ? "bg-sky-300 text-slate-950" : "bg-white/7 text-slate-200 hover:bg-white/12"}`}>{selected ? "✓ " : "+ "}{keyword}</button>;
              })}</div>
              <p className="mt-2 text-[11px] leading-4 text-slate-400">Click a suggestion to include or remove it from the live comparison.</p>
            </div>}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {selectedLead && <div className="flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full bg-white/7 px-3 py-1.5 soft-border"><LocationOnIcon className="mr-1 align-[-3px] text-sky-200" fontSize="inherit" />{selectedLead.city}, {selectedLead.country}</span><span className="rounded-full bg-white/7 px-3 py-1.5 soft-border">Niche: {selectedLead.category || selectedLead.businessType}</span><span className="rounded-full bg-white/7 px-3 py-1.5 soft-border">Stored rating: {formatRating(selectedLead.rating)} ★ · {formatNumber(selectedLead.reviewCount)} reviews</span></div>}
          <button type="button" onClick={runBenchmark} disabled={!selectedLead || running} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-sky-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-55">
            {running ? <RefreshIcon className="animate-spin" fontSize="small" /> : <SearchIcon fontSize="small" />}
            {running ? "Checking…" : "Run live comparison"}
          </button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      {!benchmark && !error && (
        <section className="glass rounded-[28px] p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-400/12 text-violet-100 soft-border"><CompareArrowsIcon /></span>
            <div>
              <h2 className="text-lg font-semibold text-white">Run a fresh local market check</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">We will search Google Places using the business niche and city, select up to four recurring competitors, then show where the chosen business appears for each keyword.</p>
              <div className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100 soft-border"><InfoOutlinedIcon className="mr-2 align-[-3px]" fontSize="small" />This is a measured local search position, not a universal “Google Maps page” number. Results can change with the keyword, city, and time of the check.</div>
            </div>
          </div>
        </section>
      )}

      {benchmark && comparison && (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Target rating" value={`${formatRating(benchmark.target.rating)} ★`} detail={ratingGapLabel} tone={comparison.ratingGap !== null && comparison.ratingGap < 0 ? "amber" : "emerald"} />
            <MetricCard label="Target reviews" value={formatNumber(benchmark.target.reviewCount)} detail={reviewGapLabel} tone={comparison.reviewGap !== null && comparison.reviewGap < 0 ? "amber" : "emerald"} />
            <MetricCard label="Competitor average" value={`${formatRating(comparison.competitorAverageRating)} ★`} detail={`${benchmark.competitors.length} compared`} tone="violet" />
            <MetricCard label="Competitor median" value={formatNumber(comparison.competitorMedianReviewCount)} detail="reviews" tone="sky" />
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">What the comparison says</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Why this business may be behind</h2>
              </div>
              <div className="rounded-xl bg-white/6 px-3 py-2 text-xs leading-5 text-slate-300 soft-border"><LocationOnIcon className="mr-1 align-[-3px] text-sky-200" fontSize="inherit" />{benchmark.market.city}, {benchmark.market.country} · {benchmark.market.anchoredToTarget ? "searches biased around the target profile" : "city-based search"}</div>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {comparison.findings.map((finding) => <div key={finding} className="rounded-2xl bg-white/6 p-4 text-sm leading-6 text-slate-200 soft-border">{finding}</div>)}
            </div>
          </section>

          <section className="glass overflow-hidden rounded-[28px]">
            <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6">
              <h2 className="text-xl font-semibold text-white">Business comparison</h2>
              <p className="text-sm text-slate-300">Live profile details for the selected business and up to four locally relevant competitors.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left">
                <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-[0.1em] text-slate-400"><tr><th className="px-4 py-3 font-semibold">Business</th><th className="px-4 py-3 font-semibold">Rating</th><th className="px-4 py-3 font-semibold">Reviews</th><th className="px-4 py-3 font-semibold">Primary category</th><th className="px-4 py-3 font-semibold">Google Maps</th></tr></thead>
                <tbody className="divide-y divide-white/10"><BusinessRow business={benchmark.target} target />{benchmark.competitors.map((competitor) => <BusinessRow key={competitor.id} business={competitor} />)}</tbody>
              </table>
            </div>
            {!benchmark.competitors.length && <div className="px-5 py-5 text-sm text-slate-300">No relevant competitors were returned. Try a broader local niche keyword.</div>}
          </section>

          <section className="glass overflow-hidden rounded-[28px]">
            <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6"><h2 className="text-xl font-semibold text-white">Keyword visibility</h2><p className="text-sm text-slate-300">The returned position from each live Google Places search. “Not in first {benchmark.market.resultLimit}” means the business was not returned in that measured result set.</p></div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left">
                <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-[0.1em] text-slate-400"><tr><th className="min-w-[14rem] px-4 py-3 font-semibold">Keyword</th><th className="min-w-[9rem] px-4 py-3 font-semibold">{businessLabel(benchmark.target)}</th>{benchmark.competitors.map((competitor) => <th key={competitor.id} className="min-w-[9rem] px-4 py-3 font-semibold">{businessLabel(competitor)}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/10">
                  {benchmark.keywords.map((row) => <tr key={row.keyword}><td className="px-4 py-4 align-top"><div className="font-semibold text-white">{row.keyword}</div><div className="mt-1 max-w-sm truncate text-xs text-slate-500" title={row.query}>{row.query}</div></td><td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rankTone(row.targetRank)}`}>{rankLabel(row.targetRank, benchmark.market.resultLimit)}</span></td>{benchmark.competitors.map((competitor) => { const rank = row.competitorRanks[competitor.id] ?? null; return <td key={competitor.id} className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rankTone(rank)}`}>{rankLabel(rank, benchmark.market.resultLimit)}</span></td>; })}</tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-5 text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span><InfoOutlinedIcon className="mr-1 align-[-3px] text-sky-200" fontSize="inherit" />{benchmark.notice}</span>
            <span translate="no" className="shrink-0 whitespace-nowrap font-sans text-xs font-normal tracking-normal text-slate-200">Google Maps</span>
          </div>
        </>
      )}
    </div>
  );
}
