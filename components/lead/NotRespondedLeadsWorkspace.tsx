"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ScheduleIcon from "@mui/icons-material/Schedule";
import type { NotRespondedLeadRecord } from "@/lib/notRespondedLeadTypes";

function formatActivity(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function NotRespondedLeadsWorkspace({ initialLeads }: { initialLeads: NotRespondedLeadRecord[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const regions = useMemo(() => [...new Set(leads.map((lead) => lead.region))].sort(), [leads]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (region !== "all" && lead.region !== region) return false;
      if (!query) return true;
      return [lead.companyName, lead.city, lead.country, lead.category, lead.email, lead.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [leads, region, search]);

  async function reactivate(lead: NotRespondedLeadRecord) {
    setBusyId(lead.id);
    setMessage("");
    const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/reactivate`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(data.error || "Lead could not be reactivated.");
      return;
    }
    setLeads((current) => current.filter((item) => item.id !== lead.id));
    setMessage(`${lead.companyName} was returned to active review. No outreach was sent.`);
  }

  async function deleteLead(lead: NotRespondedLeadRecord) {
    setBusyId(lead.id);
    setMessage("");
    const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(data.error || "Lead could not be deleted.");
      return;
    }
    setLeads((current) => current.filter((item) => item.id !== lead.id));
    setConfirmDeleteId(null);
    setMessage(`${lead.companyName} and its history were permanently deleted.`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="flex items-center gap-2 text-amber-200">
          <ScheduleIcon fontSize="small" />
          <span className="text-sm font-semibold">Inactive lead review</span>
        </div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Not responded</h1>
        <p className="mt-2 text-sm text-slate-400">Leads with no reply and no meaningful activity for at least 30 days. Review them before reactivating or permanently deleting them.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Needs review</div>
          <div className="mt-2 text-3xl font-semibold text-white">{leads.length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Inactive over 60 days</div>
          <div className="mt-2 text-3xl font-semibold text-white">{leads.filter((lead) => lead.inactiveDays >= 60).length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Regions represented</div>
          <div className="mt-2 text-3xl font-semibold text-white">{regions.length}</div>
        </div>
      </section>

      <section className="glass rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <span className="sr-only">Search inactive leads</span>
            <SearchIcon fontSize="small" className="pointer-events-none absolute left-3 top-3 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, city, category, email, or phone" className="h-11 w-full rounded-lg border border-line bg-black/20 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-300" />
          </label>
          <label>
            <span className="sr-only">Filter by region</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-[#091629] px-3 text-sm text-white outline-none focus:border-sky-300">
              <option value="all">All regions</option>
              {regions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {message && <div className="mt-3 rounded-lg bg-sky-400/10 px-4 py-3 text-sm text-sky-100 soft-border">{message}</div>}
      </section>

      <section className="overflow-hidden glass rounded-xl">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">No inactive leads match these filters.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((lead) => (
              <article key={lead.id} className="px-5 py-5">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.7fr_0.85fr_0.8fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{lead.companyName}</div>
                    <div className="mt-1 text-xs text-slate-500">{[lead.city, lead.country, lead.category].filter(Boolean).join(" · ")}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {lead.email && <span>{lead.email}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex rounded-md bg-amber-400/12 px-2 py-1 text-xs font-semibold text-amber-100">Not Responded</span>
                    <div className="mt-2 text-xs text-slate-500">Previous: {lead.previousStatus}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-500">Last activity</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatActivity(lead.lastActivityAt)}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{lead.lastActivityLabel}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-white">{lead.inactiveDays}</div>
                    <div className="text-xs text-slate-500">days inactive</div>
                  </div>
                  <div className="flex items-center gap-2 xl:justify-end">
                    <Link href={`/leads/${lead.id}`} title="Open lead" className="grid h-10 w-10 place-items-center rounded-lg text-sky-200 soft-border hover:bg-sky-400/10">
                      <OpenInNewIcon fontSize="small" />
                    </Link>
                    <button type="button" onClick={() => reactivate(lead)} disabled={busyId === lead.id} title="Reactivate lead" className="grid h-10 w-10 place-items-center rounded-lg text-emerald-200 soft-border hover:bg-emerald-400/10 disabled:opacity-50">
                      <RefreshIcon fontSize="small" />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(confirmDeleteId === lead.id ? null : lead.id)} disabled={busyId === lead.id} title="Delete lead" className="grid h-10 w-10 place-items-center rounded-lg text-rose-200 soft-border hover:bg-rose-400/10 disabled:opacity-50">
                      <DeleteForeverIcon fontSize="small" />
                    </button>
                  </div>
                </div>
                {confirmDeleteId === lead.id && (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg bg-rose-400/10 p-3 soft-border sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-rose-100">Permanently delete {lead.companyName} and its outreach history?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={busyId === lead.id} className="h-9 rounded-lg bg-white/6 px-3 text-sm font-semibold text-slate-200 soft-border hover:bg-white/10">Cancel</button>
                      <button type="button" onClick={() => deleteLead(lead)} disabled={busyId === lead.id} className="h-9 rounded-lg bg-rose-500 px-3 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60">{busyId === lead.id ? "Deleting..." : "Confirm delete"}</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
