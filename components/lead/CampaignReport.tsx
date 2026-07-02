"use client";

import { useEffect, useState } from "react";
import { RegionTabs } from "@/components/RegionTabs";

type Report = {
  summary: Record<string, number>;
  temperatures: Array<{ name: string; value: number }>;
  nextActions: Array<{ action: string; count: number }>;
  categories: Array<{ category: string; leads: number; emails: number; forms: number; contacted: number; replies: number; replyRate: number }>;
};

export function CampaignReport() {
  const [region, setRegion] = useState("Canada");
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/reports?region=${encodeURIComponent(region)}`).then((res) => res.json()).then((data) => {
      if (active) setReport(data);
    });
    return () => {
      active = false;
    };
  }, [region]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Performance</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Campaign report</h1>
      </header>
      <RegionTabs selected={region} onSelect={setRegion} />
      <section className="grid gap-3 md:grid-cols-4">
        {Object.entries(report?.summary ?? {}).map(([key, value]) => (
          <div key={key} className="glass rounded-xl p-4">
            <div className="text-xs capitalize text-slate-400">{key.replace(/([A-Z])/g, " $1")}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold text-white">Lead temperature</h2>
          <div className="grid gap-3">
            {(report?.temperatures ?? []).map((row) => (
              <div key={row.name} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{row.name}</span>
                  <span className="text-slate-300">{row.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-sky-300" style={{ width: `${Math.min(100, ((row.value || 0) / Math.max(1, report?.summary?.leads ?? 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold text-white">Recommended next actions</h2>
          <div className="grid gap-3">
            {(report?.nextActions ?? []).map((row) => (
              <div key={row.action} className="grid gap-2 rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border md:grid-cols-[1fr_70px]">
                <div>{row.action}</div>
                <div className="font-semibold text-white md:text-right">{row.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">By category</h2>
        <div className="grid gap-3">
          {(report?.categories ?? []).map((row) => (
            <div key={row.category} className="grid gap-2 rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border md:grid-cols-[1.3fr_repeat(6,0.5fr)]">
              <div className="font-medium text-white">{row.category}</div>
              <div>Leads {row.leads}</div>
              <div>Emails {row.emails}</div>
              <div>Forms {row.forms}</div>
              <div>Sent {row.contacted}</div>
              <div>Replies {row.replies}</div>
              <div>{row.replyRate}%</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
