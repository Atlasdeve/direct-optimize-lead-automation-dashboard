"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Opportunity = {
  id: string;
  leadId: string;
  title: string;
  stage: string;
  value: number;
  notes?: string | null;
  nextActionAt?: string | null;
  lead: { companyName: string; region: string; city?: string | null };
};

export function OpportunityTracker() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/opportunities").then((res) => res.json()).then((data) => {
      if (active) setOpportunities(data.opportunities ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Revenue workflow</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Opportunities</h1>
      </header>
      <section className="grid gap-4">
        {opportunities.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No opportunities yet. Create one after a positive reply or booked meeting.</div>}
        {opportunities.map((opportunity) => (
          <article key={opportunity.id} className="glass rounded-xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <Link href={`/leads/${opportunity.leadId}`} className="text-xl font-semibold text-white hover:text-sky-200">{opportunity.title}</Link>
                <div className="mt-1 text-sm text-slate-400">{opportunity.lead.companyName} · {opportunity.lead.city ?? "City pending"} · {opportunity.lead.region}</div>
                {opportunity.notes && <p className="mt-3 text-sm text-slate-300">{opportunity.notes}</p>}
              </div>
              <div className="grid gap-2 text-sm text-slate-300">
                <div className="rounded-lg bg-white/6 px-3 py-2 soft-border">Stage: {opportunity.stage}</div>
                <div className="rounded-lg bg-white/6 px-3 py-2 soft-border">Value: {opportunity.value}</div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
