"use client";

import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { Lead } from "@/lib/types";

export function LeadOutreachControls({
  lead,
  preview
}: {
  lead: Lead;
  preview: { subject: string; body: string; attachments?: string[] };
}) {
  const [approved, setApproved] = useState(lead.outreach_approved);
  const [blocked, setBlocked] = useState(lead.do_not_contact || lead.unsubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function update(action: "approve" | "block" | "reactivate") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/leads/${lead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update lead outreach.");
      setApproved(Boolean(data.lead.outreach_approved));
      setBlocked(Boolean(data.lead.do_not_contact || data.lead.unsubscribed));
      if (action === "reactivate") setNotice("Lead returned to review. No outreach was sent or approved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update lead outreach.");
    } finally {
      setBusy(false);
    }
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
            This is the current initial-email preview. Attachments are shown below; no email is sent from this preview.
          </p>
          {preview.attachments?.length ? (
            <p className="mt-1 text-xs text-slate-400">Attachment: {preview.attachments.join(", ")}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {blocked ? <button
            onClick={() => update("reactivate")}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
          >
            <RefreshIcon fontSize="small" /> Reactivate lead
          </button> : <button
            onClick={() => update("block")}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-400/12 px-4 text-sm font-semibold text-rose-100 transition soft-border hover:bg-rose-400/18 disabled:opacity-60"
          >
            <BlockIcon fontSize="small" />
            Do Not Contact
          </button>}
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
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-sky-200">{notice}</p>}

      <div className="mt-5 rounded-lg bg-black/22 p-4 soft-border">
        <div className="text-xs uppercase text-slate-500">Subject</div>
        <div className="mt-1 text-sm font-medium text-white">{preview.subject}</div>
        <div className="mt-4 text-xs uppercase text-slate-500">Message preview</div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-300">{preview.body}</pre>
      </div>
    </section>
  );
}
