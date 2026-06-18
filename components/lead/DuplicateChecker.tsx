"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { RegionTabs } from "@/components/RegionTabs";

type DuplicateGroup = {
  key: string;
  count: number;
  leads: Array<{ id: string; companyName: string; region: string; city?: string | null }>;
};

export function DuplicateChecker() {
  const [region, setRegion] = useState("Canada");
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/duplicates?region=${encodeURIComponent(region)}`);
      const data = await response.json();
      if (active) {
        setDuplicates(data.duplicates ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [region]);

  async function archive(leadId: string) {
    await fetch("/api/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId })
    });
    const response = await fetch(`/api/duplicates?region=${encodeURIComponent(region)}`);
    const data = await response.json();
    setDuplicates(data.duplicates ?? []);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Data quality</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Duplicate lead checker</h1>
      </header>
      <RegionTabs selected={region} onSelect={setRegion} />
      <section className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 text-white">
          <ContentCopyIcon fontSize="small" />
          <h2 className="font-semibold">Duplicate signals</h2>
        </div>
        <div className="mt-2 text-sm text-slate-400">Matched by email, phone, website domain, Google Maps URL, or company/city/region.</div>
      </section>
      <section className="grid gap-4">
        {loading && <div className="glass rounded-xl p-5 text-sm text-slate-300">Checking duplicates...</div>}
        {!loading && duplicates.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No duplicate signals found for this region.</div>}
        {duplicates.map((group) => (
          <article key={group.key} className="glass rounded-xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-400">{group.key}</div>
              <div className="rounded-lg bg-amber-400/12 px-3 py-1 text-sm text-amber-100 soft-border">{group.count} matches</div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {group.leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/6 p-3 text-sm soft-border">
                  <Link href={`/leads/${lead.id}`} className="min-w-0 text-slate-200 hover:text-sky-200">
                    {lead.companyName}
                    <span className="ml-2 text-slate-500">{lead.city ?? "City pending"} · {lead.region}</span>
                  </Link>
                  <button onClick={() => archive(lead.id)} className="shrink-0 rounded-md bg-rose-400/12 px-2 py-1 text-xs text-rose-100 soft-border hover:bg-rose-400/18">
                    Archive
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
