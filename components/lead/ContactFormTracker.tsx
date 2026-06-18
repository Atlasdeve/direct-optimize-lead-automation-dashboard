"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import { RegionTabs } from "@/components/RegionTabs";

type ContactFormRow = {
  id: string;
  leadId: string;
  companyName: string;
  region: string;
  city?: string | null;
  value: string;
  status: string;
  updatedAt: string;
};

export function ContactFormTracker() {
  const [region, setRegion] = useState("Canada");
  const [contacts, setContacts] = useState<ContactFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/contact-forms?region=${encodeURIComponent(region)}`);
    const data = await response.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [region]);

  async function mark(contactId: string, action: "opened" | "submitted" | "skipped") {
    await fetch("/api/contact-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, action, message: notes[contactId] })
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Manual outreach</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Contact form tracker</h1>
      </header>

      <RegionTabs selected={region} onSelect={setRegion} />

      <section className="glass rounded-xl p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Total forms: {contacts.length}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Opened: {contacts.filter((row) => row.status === "opened").length}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Submitted: {contacts.filter((row) => row.status === "submitted").length}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Skipped: {contacts.filter((row) => row.status === "skipped").length}</div>
        </div>
      </section>

      <section className="grid gap-4">
        {loading && <div className="glass rounded-xl p-5 text-sm text-slate-300">Loading contact forms...</div>}
        {!loading && contacts.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-300">No contact forms found for this region yet.</div>}
        {contacts.map((contact) => (
          <article key={contact.id} className="glass rounded-xl p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_0.8fr] lg:items-center">
              <div className="min-w-0">
                <Link href={`/leads/${contact.leadId}`} className="text-lg font-semibold text-white hover:text-sky-200">
                  {contact.companyName}
                </Link>
                <div className="mt-1 text-sm text-slate-400">{contact.city ?? "City pending"} · {contact.region}</div>
              </div>
              <a href={contact.value} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg bg-white/6 p-3 text-sm text-sky-200 soft-border hover:bg-white/10">
                <ContactPageIcon fontSize="small" />
                <span className="truncate">{contact.value}</span>
                <OpenInNewIcon fontSize="small" />
              </a>
              <div className="space-y-3">
              <textarea
                value={notes[contact.id] ?? ""}
                onChange={(event) => setNotes({ ...notes, [contact.id]: event.target.value })}
                placeholder="Submission message or note"
                className="min-h-20 w-full rounded-lg border border-line bg-black/20 p-3 text-sm text-white outline-none focus:border-sky-300"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => mark(contact.id, "opened")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/7 px-3 text-sm text-slate-200 soft-border hover:bg-white/12">
                  <OpenInNewIcon fontSize="small" />
                  Opened
                </button>
                <button onClick={() => mark(contact.id, "submitted")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
                  <CheckCircleIcon fontSize="small" />
                  Submitted
                </button>
                <button onClick={() => mark(contact.id, "skipped")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-400/12 px-3 text-sm text-rose-100 soft-border hover:bg-rose-400/18">
                  <BlockIcon fontSize="small" />
                  Skip
                </button>
                <span className="grid h-9 place-items-center rounded-lg bg-white/6 px-3 text-sm text-slate-300 soft-border">{contact.status}</span>
              </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
