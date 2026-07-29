"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AlarmIcon from "@mui/icons-material/Alarm";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { FollowUpReminderRecord } from "@/lib/followUpReminderOptions";

const views = [
  { value: "active", label: "Upcoming and due" },
  { value: "due", label: "Due now" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All reminders" }
] as const;

function statusClass(status: string) {
  if (status === "Due") return "bg-rose-400/12 text-rose-200";
  if (status === "Completed") return "bg-emerald-400/12 text-emerald-200";
  if (status === "Cancelled") return "bg-slate-400/12 text-slate-300";
  return "bg-sky-400/12 text-sky-200";
}

export function FollowUpRemindersWorkspace({ initialReminders }: { initialReminders: FollowUpReminderRecord[] }) {
  const [reminders, setReminders] = useState(initialReminders);
  const [view, setView] = useState<(typeof views)[number]["value"]>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => reminders.filter((reminder) => {
    if (view === "active") return ["Scheduled", "Due"].includes(reminder.status);
    if (view === "due") return reminder.status === "Due" || (reminder.status === "Scheduled" && new Date(reminder.dueAt) <= new Date());
    if (view === "completed") return reminder.status === "Completed";
    if (view === "cancelled") return reminder.status === "Cancelled";
    return true;
  }), [reminders, view]);

  const metrics = {
    upcoming: reminders.filter((reminder) => reminder.status === "Scheduled" && new Date(reminder.dueAt) > new Date()).length,
    due: reminders.filter((reminder) => reminder.status === "Due" || (reminder.status === "Scheduled" && new Date(reminder.dueAt) <= new Date())).length,
    completed: reminders.filter((reminder) => reminder.status === "Completed").length
  };

  async function update(reminder: FollowUpReminderRecord, action: "complete" | "cancel") {
    setBusyId(reminder.id);
    setMessage(null);
    const response = await fetch("/api/follow-up-reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reminder.id, action })
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(data.error ?? "Reminder could not be updated.");
      return;
    }
    setReminders((current) => current.map((item) => item.id === reminder.id ? data.reminder : item));
    setMessage(action === "complete" ? "Reminder marked complete." : "Reminder cancelled.");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sky-200">
          <AlarmIcon fontSize="small" />
          <span className="text-sm font-semibold">Lead follow-up queue</span>
        </div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Follow-up reminders</h1>
        <p className="mt-2 text-sm text-slate-400">Review upcoming reminders, open the related lead, and close the loop when the follow-up is complete.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Upcoming", metrics.upcoming],
          ["Due now", metrics.due],
          ["Completed", metrics.completed]
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden glass rounded-xl">
        <div className="flex flex-wrap gap-2 border-b border-line p-4" role="tablist" aria-label="Reminder views">
          {views.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => setView(item.value)} className={`h-10 rounded-lg px-3 text-sm font-semibold soft-border ${view === item.value ? "bg-sky-400 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/9 hover:text-white"}`}>
              {item.label}
            </button>
          ))}
        </div>

        {message && <div className="m-4 rounded-lg bg-sky-400/10 px-4 py-3 text-sm text-sky-100 soft-border">{message}</div>}

        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">No reminders in this view.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((reminder) => (
              <article key={reminder.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_0.65fr_0.8fr_1.2fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{reminder.leadName}</div>
                  <div className="mt-1 text-xs text-slate-500">{reminder.leadType === "adult_lead" ? "Adult Lead" : "Regional Lead"}{reminder.country ? ` - ${reminder.country}` : ""}</div>
                </div>
                <div>
                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(reminder.status)}`}>{reminder.status}</span>
                  <div className="mt-2 text-xs text-slate-500">{reminder.presetLabel}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{new Date(reminder.dueAt).toLocaleDateString()}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(reminder.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div className="text-sm text-slate-300">{reminder.note || "Check this lead and decide the next action."}</div>
                <div className="flex items-center gap-2 lg:justify-end">
                  <Link href={reminder.actionUrl} title="Open lead" className="grid h-10 w-10 place-items-center rounded-lg text-sky-200 soft-border hover:bg-sky-400/10">
                    <OpenInNewIcon fontSize="small" />
                  </Link>
                  {["Scheduled", "Due"].includes(reminder.status) && (
                    <>
                      <button type="button" onClick={() => update(reminder, "complete")} disabled={busyId === reminder.id} title="Mark completed" className="grid h-10 w-10 place-items-center rounded-lg text-emerald-200 soft-border hover:bg-emerald-400/10 disabled:opacity-50">
                        <CheckCircleIcon fontSize="small" />
                      </button>
                      <button type="button" onClick={() => update(reminder, "cancel")} disabled={busyId === reminder.id} title="Cancel reminder" className="grid h-10 w-10 place-items-center rounded-lg text-rose-200 soft-border hover:bg-rose-400/10 disabled:opacity-50">
                        <CloseIcon fontSize="small" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
