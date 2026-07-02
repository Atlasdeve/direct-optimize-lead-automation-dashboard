"use client";

import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import type { Lead } from "@/lib/types";

export function LeadOutreachControls({
  lead,
  preview
}: {
  lead: Lead;
  preview: { subject: string; body: string };
}) {
  const [approved, setApproved] = useState(lead.outreach_approved);
  const [blocked, setBlocked] = useState(lead.do_not_contact || lead.unsubscribed);
  const [busy, setBusy] = useState(false);

  async function update(action: "approve" | "block") {
    setBusy(true);
    const response = await fetch(`/api/leads/${lead.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await response.json();
    if (response.ok) {
      setApproved(Boolean(data.lead.outreach_approved));
      setBlocked(Boolean(data.lead.do_not_contact || data.lead.unsubscribed));
    }
    setBusy(false);
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-white">Outreach review</h2>
          <p className="mt-1 text-sm text-slate-400">
            {approved ? "Approved for reviewed email outreach." : blocked ? "Lead is blocked from outreach." : "Review the message before approving outreach."}
          </p>
          <p className="mt-1 text-xs text-sky-200">
            Preview includes current GMB performance, website audit findings, and the PDF audit attachments used during send.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => update("block")}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-400/12 px-4 text-sm font-semibold text-rose-100 transition soft-border hover:bg-rose-400/18 disabled:opacity-60"
          >
            <BlockIcon fontSize="small" />
            Do Not Contact
          </button>
          <button
            onClick={() => update("approve")}
            disabled={busy || blocked || !lead.email}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircleIcon fontSize="small" />
            Approve Outreach
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-black/22 p-4 soft-border">
        <div className="text-xs uppercase text-slate-500">Subject</div>
        <div className="mt-1 text-sm font-medium text-white">{preview.subject}</div>
        <div className="mt-4 text-xs uppercase text-slate-500">Message preview</div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-300">{preview.body}</pre>
      </div>
    </section>
  );
}
