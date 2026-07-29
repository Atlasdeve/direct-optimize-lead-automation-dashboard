"use client";

import { useState } from "react";
import AlarmAddIcon from "@mui/icons-material/AlarmAdd";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
  followUpReminderOptions,
  type FollowUpReminderPreset,
  type FollowUpReminderRecord
} from "@/lib/followUpReminderOptions";

export function FollowUpReminderControl({
  leadId,
  adultLeadId,
  leadName,
  initialReminder,
  compact = false
}: {
  leadId?: string;
  adultLeadId?: string;
  leadName: string;
  initialReminder?: FollowUpReminderRecord | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [reminder, setReminder] = useState(initialReminder ?? null);
  const [preset, setPreset] = useState<FollowUpReminderPreset>("1_day");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/follow-up-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        adultLeadId,
        preset,
        note: note || null
      })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Reminder could not be scheduled.");
      return;
    }
    setReminder(data.reminder);
    setNote("");
    setMessage(`Reminder scheduled for ${new Date(data.reminder.dueAt).toLocaleString()}.`);
  }

  async function update(action: "complete" | "cancel") {
    if (!reminder) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/follow-up-reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reminder.id, action })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Reminder could not be updated.");
      return;
    }
    setReminder(null);
    setMessage(action === "complete" ? "Follow-up marked complete." : "Reminder cancelled.");
  }

  const form = (
    <div className={compact ? "" : "glass rounded-xl p-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-200">
            <AlarmAddIcon fontSize="small" />
            <span className="font-semibold">Follow-up reminder</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">Get a live and mobile notification when it is time to check this lead again.</p>
        </div>
        {compact && (
          <button type="button" title="Close" aria-label="Close reminder" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 soft-border hover:bg-white/8 hover:text-white">
            <CloseIcon fontSize="small" />
          </button>
        )}
      </div>

      {reminder && (
        <div className="mt-4 rounded-lg bg-sky-400/10 p-4 soft-border">
          <div className="text-xs uppercase text-sky-200">{reminder.status}</div>
          <div className="mt-1 font-semibold text-white">{new Date(reminder.dueAt).toLocaleString()}</div>
          <div className="mt-1 text-sm text-slate-400">{reminder.presetLabel}{reminder.note ? ` - ${reminder.note}` : ""}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => update("complete")} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
              <CheckCircleIcon fontSize="small" />
              Complete
            </button>
            <button type="button" onClick={() => update("cancel")} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-200 soft-border hover:bg-rose-400/10 disabled:opacity-60">
              <DeleteOutlineIcon fontSize="small" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={schedule} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm text-slate-300">
          Remind me after
          <select value={preset} onChange={(event) => setPreset(event.target.value as FollowUpReminderPreset)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
            {followUpReminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Reminder note
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={`Next step for ${leadName}`} className="h-11 min-w-0 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
        </label>
        <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
          <SaveIcon fontSize="small" />
          {reminder ? "Replace" : "Schedule"}
        </button>
      </form>

      {message && <div className="mt-4 rounded-lg bg-white/6 px-4 py-3 text-sm text-slate-200 soft-border">{message}</div>}
    </div>
  );

  if (!compact) return form;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Schedule follow-up reminder" className={`grid h-10 w-10 place-items-center rounded-lg soft-border hover:bg-sky-400/10 ${reminder ? "text-amber-200" : "text-sky-200"}`}>
        <AlarmAddIcon fontSize="small" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="w-full max-w-3xl rounded-xl border border-line bg-[#071426] p-5 shadow-2xl">
            {form}
          </div>
        </div>
      )}
    </>
  );
}
