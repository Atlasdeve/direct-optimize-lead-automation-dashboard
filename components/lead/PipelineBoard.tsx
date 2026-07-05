"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RegionTabs } from "@/components/RegionTabs";
import type { Lead } from "@/lib/types";

const columns = ["New", "Approved", "Contacted", "Follow-up", "Replied", "Meeting Booked", "Closed", "Failed"];

export function PipelineBoard() {
  const [region, setRegion] = useState("Canada");
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    let active = true;
    fetch(`/api/leads?region=${encodeURIComponent(region)}`).then((res) => res.json()).then((data) => {
      if (active) setLeads(data.leads ?? []);
    });
    return () => {
      active = false;
    };
  }, [region]);
  const grouped = useMemo(() => Object.fromEntries(columns.map((column) => [column, leads.filter((lead) => lead.outreach_status === column)])), [leads]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Pipeline</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Lead pipeline board</h1>
      </header>
      <RegionTabs selected={region} onSelect={setRegion} />
      <section className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-8">
        {columns.map((column) => (
          <div key={column} className="glass min-h-60 rounded-xl p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{column}</h2>
              <span className="rounded-md bg-white/7 px-2 py-1 text-xs text-slate-300 soft-border">{grouped[column]?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(grouped[column] ?? []).map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-lg bg-white/6 p-3 text-sm soft-border hover:bg-white/10">
                  <div className="font-medium text-white">{lead.company_name}</div>
                  <div className="mt-1 text-xs text-slate-400">{lead.city} · {lead.lead_score}/100</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
