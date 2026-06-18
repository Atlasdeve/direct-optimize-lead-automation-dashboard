"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import { RegionTabs } from "@/components/RegionTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadScoreBreakdown } from "@/components/lead/LeadScoreBreakdown";
import type { Lead } from "@/lib/types";

const queues = [
  { id: "needs_review", label: "Needs review" },
  { id: "approved", label: "Approved" },
  { id: "contact_forms", label: "Contact forms" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "do_not_contact", label: "Do not contact" }
];

export function ReviewQueue() {
  const [region, setRegion] = useState("Canada");
  const [queue, setQueue] = useState("needs_review");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const counts = useMemo(() => ({
    emailReady: leads.filter((lead) => lead.email && !lead.email_sent && !lead.do_not_contact && !lead.unsubscribed).length,
    forms: leads.filter((lead) => (lead.contact_forms?.length ?? 0) > 0).length,
    blocked: leads.filter((lead) => lead.do_not_contact || lead.unsubscribed).length
  }), [leads]);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/review?region=${encodeURIComponent(region)}&queue=${encodeURIComponent(queue)}`);
    const data = await response.json();
    setLeads(data.leads ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [region, queue]);

  async function updateLead(leadId: string, action: "approve" | "block") {
    await fetch(`/api/leads/${leadId}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Manual review</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Lead review queue</h1>
      </header>

      <RegionTabs selected={region} onSelect={setRegion} />

      <section className="glass rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {queues.map((item) => (
            <button
              key={item.id}
              onClick={() => setQueue(item.id)}
              className={queue === item.id ? "h-10 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950" : "h-10 rounded-lg bg-white/7 px-4 text-sm text-slate-200 soft-border hover:bg-white/12"}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Email-ready: {counts.emailReady}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">With forms: {counts.forms}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Blocked: {counts.blocked}</div>
        </div>
      </section>

      <section className="grid gap-4">
        {loading && <div className="glass rounded-xl p-5 text-sm text-slate-300">Loading queue...</div>}
        {!loading && leads.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No leads in this queue.</div>}
        {leads.map((lead) => (
          <article key={lead.id} className="glass rounded-xl p-5">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.85fr_0.75fr]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/leads/${lead.id}`} className="truncate text-xl font-semibold text-white hover:text-sky-200">
                    {lead.company_name}
                  </Link>
                  <StatusBadge status={lead.outreach_status} />
                </div>
                <div className="mt-2 text-sm text-slate-400">{lead.city}, {lead.country} · {lead.category}</div>
                <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2"><EmailIcon fontSize="small" /><span className="truncate">{lead.email ?? "Email pending"}</span></div>
                  <div className="flex min-w-0 items-center gap-2"><PhoneIcon fontSize="small" /><span className="truncate">{lead.phone ?? "Phone pending"}</span></div>
                  <div className="flex min-w-0 items-center gap-2"><ContactPageIcon fontSize="small" /><span className="truncate">{lead.contact_forms?.[0] ?? "Contact form pending"}</span></div>
                </div>
              </div>

              <LeadScoreBreakdown lead={lead} compact />

              <div className="flex flex-col justify-between gap-3">
                <div className="grid gap-2 text-sm">
                  <div className="rounded-lg bg-white/6 p-3 text-slate-300 soft-border">Approved: {lead.outreach_approved ? "Yes" : "No"}</div>
                  <div className="rounded-lg bg-white/6 p-3 text-slate-300 soft-border">Do not contact: {lead.do_not_contact || lead.unsubscribed ? "Yes" : "No"}</div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => updateLead(lead.id, "approve")}
                    disabled={!lead.email || lead.do_not_contact || lead.unsubscribed}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircleIcon fontSize="small" />
                    Approve
                  </button>
                  <button
                    onClick={() => updateLead(lead.id, "block")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-400/12 px-4 text-sm font-semibold text-rose-100 transition soft-border hover:bg-rose-400/18"
                  >
                    <BlockIcon fontSize="small" />
                    Do Not Contact
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
