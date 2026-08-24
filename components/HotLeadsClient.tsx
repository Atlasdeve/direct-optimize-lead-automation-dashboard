"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/types";

type HotLead = {
  lead: Lead;
  latestLogId: string;
  latestAction: string;
  latestStatus: string;
  latestUrl: string | null;
  latestLinkLabel: string | null;
  latestCampaign: string;
  lastClickedAt: string | null;
  lastOpenedAt: string | null;
  lastActivityAt: string;
  isLive: boolean;
  liveLastSeenAt: string | null;
  livePageUrl: string | null;
  clickCount: number;
  openCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function campaignLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function HotLeadsClient({ initialLeads }: { initialLeads: HotLead[] }) {
  const [leads, setLeads] = useState(initialLeads);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/hot-leads", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { leads?: HotLead[] };
      setLeads(data.leads ?? []);
    } catch {
      // The next timer, focus event, or notification stream will retry.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 10000);
    const onFocus = () => refresh();
    const onPortalRefresh = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("portal-data-refresh", onPortalRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("portal-data-refresh", onPortalRefresh);
    };
  }, [refresh]);

  const stats = useMemo(() => ({
    live: leads.filter((item) => item.isLive).length,
    clicked: leads.filter((item) => item.clickCount > 0).length,
    openedOnly: leads.filter((item) => item.clickCount === 0 && item.openCount > 0).length
  }), [leads]);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Live now</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">{stats.live}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Engaged leads</div>
          <div className="mt-2 text-3xl font-semibold text-white">{leads.length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Clicked a link</div>
          <div className="mt-2 text-3xl font-semibold text-white">{stats.clicked}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-slate-400">Opened only</div>
          <div className="mt-2 text-3xl font-semibold text-white">{stats.openedOnly}</div>
        </div>
      </section>

      <section className="overflow-hidden glass rounded-xl">
        {leads.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">No tracked email engagement yet.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {leads.map((item) => (
              <article key={item.lead.id} className="px-5 py-5">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.65fr_0.7fr_0.85fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <Link href={`/leads/${item.lead.id}`} className="truncate text-lg font-semibold text-white hover:text-sky-200">
                      {item.lead.company_name}
                    </Link>
                    <div className="mt-1 text-xs text-slate-500">{[item.lead.city, item.lead.country, item.lead.category].filter(Boolean).join(" · ")}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {item.lead.email && <span>{item.lead.email}</span>}
                      {item.lead.phone && <span>{item.lead.phone}</span>}
                    </div>
                  </div>

                  <div>
                    <span className={item.isLive ? "inline-flex rounded-md bg-emerald-400 px-2 py-1 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-400/20" : item.clickCount > 0 ? "inline-flex rounded-md bg-emerald-400/14 px-2 py-1 text-xs font-semibold text-emerald-100" : "inline-flex rounded-md bg-sky-400/12 px-2 py-1 text-xs font-semibold text-sky-100"}>
                      {item.isLive ? "Live" : item.clickCount > 0 ? "Clicked" : "Opened"}
                    </span>
                    <div className="mt-2 text-xs text-slate-500">{campaignLabel(item.latestCampaign)}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-slate-500">Activity</div>
                    <div className="mt-1 text-sm font-semibold text-white">{item.isLive ? "Active now" : formatDate(item.lastActivityAt)}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.openCount} open(s), {item.clickCount} click(s)</div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs uppercase text-slate-500">Last clicked</div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{item.latestLinkLabel?.replaceAll("_", " ") || "No click yet"}</div>
                    {item.livePageUrl ? (
                      <div className="mt-1 truncate text-xs text-emerald-200">Viewing: {item.livePageUrl}</div>
                    ) : item.latestUrl ? (
                      <div className="mt-1 truncate text-xs text-slate-500">{item.latestUrl}</div>
                    ) : null}
                  </div>

                  <div className="flex gap-2 xl:justify-end">
                    <Link href={`/leads/${item.lead.id}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-300">
                      Open lead
                    </Link>
                    {item.lead.phone && (
                      <a href={`tel:${item.lead.phone}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-white/8 px-3 text-sm font-semibold text-white soft-border hover:bg-white/12">
                        Call
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
