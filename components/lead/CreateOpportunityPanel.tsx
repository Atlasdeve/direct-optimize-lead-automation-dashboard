"use client";

import { useState } from "react";
import WorkIcon from "@mui/icons-material/Work";

export function CreateOpportunityPanel({ leadId, companyName }: { leadId: string; companyName: string }) {
  const [stage, setStage] = useState("New");
  const [value, setValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        title: `${companyName} opportunity`,
        stage,
        value,
        notes
      })
    });
    setCreated(response.ok);
    setBusy(false);
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center gap-2">
        <WorkIcon className="text-sky-200" fontSize="small" />
        <h2 className="font-semibold text-white">Opportunity tracker</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
        <select value={stage} onChange={(event) => setStage(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300">
          <option>New</option>
          <option>Qualified</option>
          <option>Meeting Booked</option>
          <option>Proposal Sent</option>
          <option>Won</option>
          <option>Lost</option>
        </select>
        <input type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
      </div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opportunity notes" className="mt-3 min-h-20 w-full rounded-lg border border-line bg-black/20 p-3 text-sm text-white outline-none focus:border-sky-300" />
      <button onClick={create} disabled={busy} className="mt-3 inline-flex h-10 items-center rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
        {busy ? "Creating..." : created ? "Opportunity Created" : "Create Opportunity"}
      </button>
    </section>
  );
}
