"use client";

import { useEffect, useState } from "react";

type Checklist = {
  websiteChecked: boolean;
  gbpChecked: boolean;
  reviewsChecked: boolean;
  contactFormChecked: boolean;
  decisionMakerSearched: boolean;
  notes?: string | null;
};

const items: Array<{ key: keyof Checklist; label: string }> = [
  { key: "websiteChecked", label: "Website checked" },
  { key: "gbpChecked", label: "GBP checked" },
  { key: "reviewsChecked", label: "Reviews checked" },
  { key: "contactFormChecked", label: "Contact form checked" },
  { key: "decisionMakerSearched", label: "Decision maker searched" }
];

export function LeadResearchChecklist({ leadId }: { leadId: string }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/leads/${leadId}/checklist`).then((res) => res.json()).then((data) => {
      if (active) setChecklist(data.checklist);
    });
    return () => {
      active = false;
    };
  }, [leadId]);

  async function update(next: Partial<Checklist>) {
    if (!checklist) return;
    const payload = { ...checklist, ...next };
    setChecklist(payload);
    setSaving(true);
    const response = await fetch(`/api/leads/${leadId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setChecklist(data.checklist);
    setSaving(false);
  }

  if (!checklist) return <section className="glass rounded-xl p-5 text-sm text-slate-300">Loading research checklist...</section>;

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">Lead research checklist</h2>
        <span className="text-xs text-slate-500">{saving ? "Saving..." : "Saved"}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-3 rounded-lg bg-white/6 p-3 text-sm text-slate-200 soft-border">
            <input
              type="checkbox"
              checked={Boolean(checklist[item.key])}
              onChange={(event) => update({ [item.key]: event.target.checked })}
              className="h-4 w-4"
            />
            {item.label}
          </label>
        ))}
      </div>
      <textarea
        value={checklist.notes ?? ""}
        onChange={(event) => setChecklist({ ...checklist, notes: event.target.value })}
        onBlur={(event) => update({ notes: event.target.value })}
        placeholder="Research notes"
        className="mt-4 min-h-24 w-full rounded-lg border border-line bg-black/20 p-3 text-sm text-white outline-none focus:border-sky-300"
      />
    </section>
  );
}
