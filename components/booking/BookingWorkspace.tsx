"use client";

import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import GoogleIcon from "@mui/icons-material/Google";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { BookingAvailability, BookingSettingsData } from "@/lib/booking";

type CalendarConnection = {
  configured: boolean;
  redirectUri: string;
  connected: boolean;
  accountEmail: string | null;
  calendarId: string | null;
  connectedAt: string | null;
};

type BookingAppointment = {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  source: string;
  calendarSyncStatus: string;
  googleEventId: string | null;
  createdAt: string;
};

type BookingWorkspaceData = {
  settings: BookingSettingsData;
  publicBookingUrl: string;
  googleCalendar: CalendarConnection;
  appointments: BookingAppointment[];
};

const weekdayRows: Array<{ key: keyof BookingAvailability; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
];

const timezones = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Europe/London",
  "Asia/Karachi",
  "UTC"
];

function appointmentDate(appointment: BookingAppointment) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appointment.timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(appointment.startsAt));
}

function cloneAvailability(availability: BookingAvailability): BookingAvailability {
  return Object.fromEntries(Object.entries(availability).map(([day, windows]) => [day, windows.map((window) => ({ ...window }))])) as BookingAvailability;
}

function calendarNotice(value: string | null) {
  if (value === "connected") return { tone: "success", message: "Google Calendar is connected. New bookings will check availability and create calendar events." };
  if (value === "declined") return { tone: "warning", message: "Google Calendar access was not granted. No changes were made." };
  if (value === "configuration_required") return { tone: "warning", message: "Google Calendar needs its OAuth app settings before an account can be connected." };
  if (value === "invalid_state") return { tone: "warning", message: "The Google connection session expired. Please start the connection again." };
  if (value === "failed") return { tone: "warning", message: "Google Calendar could not be connected. Check the redirect URI and try again." };
  return null;
}

export function BookingWorkspace() {
  const [workspace, setWorkspace] = useState<BookingWorkspaceData | null>(null);
  const [settings, setSettings] = useState<BookingSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const queryCalendarStatus = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("calendar");
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    const response = await fetch("/api/booking", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Booking workspace could not be loaded.");
      setLoading(false);
      return;
    }
    setWorkspace(data);
    setSettings({ ...data.settings, availability: cloneAvailability(data.settings.availability) });
    setLoading(false);
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const calendarMessage = calendarNotice(queryCalendarStatus);

  function updateSchedule(day: keyof BookingAvailability, field: "open" | "start" | "end", value: string | boolean) {
    setSettings((current) => {
      if (!current) return current;
      const availability = cloneAvailability(current.availability);
      const existing = availability[day]?.[0] || { start: "09:00", end: "17:00" };
      if (field === "open") availability[day] = value ? [existing] : [];
      if (field === "start" && typeof value === "string") availability[day] = [{ ...existing, start: value }];
      if (field === "end" && typeof value === "string") availability[day] = [{ ...existing, end: value }];
      return { ...current, availability };
    });
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/booking", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings)
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Booking settings could not be saved.");
      return;
    }
    setSettings({ ...data.settings, availability: cloneAvailability(data.settings.availability) });
    setWorkspace((current) => current ? { ...current, settings: data.settings } : current);
    setMessage(data.message || "Booking settings saved.");
  }

  async function copyBookingLink() {
    if (!workspace) return;
    try {
      await navigator.clipboard.writeText(workspace.publicBookingUrl);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy link"), 1800);
    } catch {
      setError("Copying was blocked by this browser. Select the link and copy it manually.");
    }
  }

  async function disconnectCalendar() {
    if (!window.confirm("Disconnect Google Calendar? Future bookings will no longer check or create Google Calendar events.")) return;
    const response = await fetch("/api/booking/google", { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Google Calendar could not be disconnected.");
      return;
    }
    setMessage(data.message || "Google Calendar disconnected.");
    await loadWorkspace();
  }

  async function cancelAppointment(appointment: BookingAppointment) {
    if (!window.confirm(`Cancel the booking with ${appointment.name}?${appointment.googleEventId ? " Google Calendar will send a cancellation to the attendee." : ""}`)) return;
    setCancellingId(appointment.id);
    setError("");
    const response = await fetch(`/api/booking/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" })
    });
    const data = await response.json().catch(() => ({}));
    setCancellingId(null);
    if (!response.ok) {
      setError(data.error || "Booking could not be cancelled.");
      return;
    }
    setMessage(data.alreadyCancelled ? "This booking was already cancelled." : "Booking cancelled.");
    await loadWorkspace();
  }

  if (loading) return <div className="glass mx-auto max-w-6xl rounded-[28px] p-6 text-slate-300">Loading booking workspace…</div>;
  if (!workspace || !settings) return <div className="glass mx-auto max-w-6xl rounded-[28px] p-6 text-rose-200">{error || "Booking workspace is unavailable."}</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-sky-200">Appointments</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Google Calendar Booking</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Give prospects one link to choose an available time. When Google Calendar is connected, Direct Optimize checks your calendar before it confirms the booking.</p>
        </div>
        <button type="button" onClick={copyBookingLink} className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200">
          <ContentCopyIcon fontSize="small" /> {copyLabel}
        </button>
      </header>

      {(error || message || calendarMessage) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : calendarMessage?.tone === "warning" ? "border-amber-300/30 bg-amber-400/10 text-amber-100" : "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"}`}>
          {error || message || calendarMessage?.message}
        </div>
      )}

      <section className="glass overflow-hidden rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-400/15 text-sky-100 soft-border"><LinkIcon /></span>
            <div className="min-w-0">
              <h2 className="font-semibold text-white">Public booking page</h2>
              <p className="mt-1 text-sm text-slate-300">Share this in emails, proposals, your website, or messages.</p>
            </div>
          </div>
          <a href={workspace.publicBookingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-200 hover:text-white">Open page ↗</a>
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl bg-slate-950/35 px-3 py-3 soft-border">
          <span className="truncate font-mono text-xs text-slate-200">{workspace.publicBookingUrl}</span>
        </div>
      </section>

      <section className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white soft-border"><GoogleIcon /></span>
            <div>
              <h2 className="font-semibold text-white">Google Calendar connection</h2>
              {workspace.googleCalendar.connected ? (
                <p className="mt-1 text-sm leading-6 text-slate-300">Connected to <span className="font-medium text-white">{workspace.googleCalendar.accountEmail || "your Google account"}</span>. New bookings check the primary calendar, create a calendar event, and send the attendee an invite.</p>
              ) : workspace.googleCalendar.configured ? (
                <p className="mt-1 text-sm leading-6 text-slate-300">Connect the Google account whose availability should be used. We request only calendar event and free/busy access.</p>
              ) : (
                <p className="mt-1 text-sm leading-6 text-amber-100">The booking page works now, but Calendar sync needs a one-time Google OAuth setup in Railway first.</p>
              )}
            </div>
          </div>
          {workspace.googleCalendar.connected ? (
            <button type="button" onClick={disconnectCalendar} className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20">Disconnect</button>
          ) : workspace.googleCalendar.configured ? (
            <a href="/api/booking/google/connect" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"><GoogleIcon fontSize="small" /> Connect Google Calendar</a>
          ) : null}
        </div>
        {!workspace.googleCalendar.configured && (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100">
            <div className="font-semibold">One-time Google setup needed</div>
            <p className="mt-1 leading-6 text-amber-100">Add <code>GOOGLE_CALENDAR_CLIENT_ID</code>, <code>GOOGLE_CALENDAR_CLIENT_SECRET</code>, and a 32+ character <code>GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY</code> in Railway. Then add this exact redirect URI in Google Cloud:</p>
            <code className="mt-3 block break-all rounded-lg bg-black/25 px-3 py-2 text-xs text-amber-100">{workspace.googleCalendar.redirectUri}</code>
          </div>
        )}
      </section>

      <form onSubmit={saveSettings} className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Booking rules</h2>
            <p className="mt-1 text-sm text-slate-300">Set the appointment window, notice period, and booking page details.</p>
          </div>
          <label className="inline-flex items-center gap-3 rounded-full bg-white/5 px-3 py-2 text-sm text-slate-100 soft-border">
            <input type="checkbox" checked={settings.isPublic} onChange={(event) => setSettings({ ...settings, isPublic: event.target.checked })} className="h-4 w-4 accent-sky-300" />
            Public booking enabled
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm text-slate-200">Time zone
            <select value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none focus:border-sky-300">
              {timezones.map((timezone) => <option key={timezone}>{timezone}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">Meeting length
            <select value={settings.appointmentDurationMinutes} onChange={(event) => setSettings({ ...settings, appointmentDurationMinutes: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none focus:border-sky-300">
              {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">Buffer after meeting
            <select value={settings.bufferMinutes} onChange={(event) => setSettings({ ...settings, bufferMinutes: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none focus:border-sky-300">
              {[0, 5, 10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes ? `${minutes} minutes` : "No buffer"}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">Minimum notice
            <select value={settings.minimumNoticeMinutes} onChange={(event) => setSettings({ ...settings, minimumNoticeMinutes: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none focus:border-sky-300">
              {[0, 30, 60, 120, 240, 480, 1440].map((minutes) => <option key={minutes} value={minutes}>{minutes >= 1440 ? "1 day" : minutes ? `${minutes / 60 >= 1 ? `${minutes / 60} hour${minutes / 60 === 1 ? "" : "s"}` : `${minutes} min`}` : "No minimum"}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">Book ahead
            <select value={settings.maximumDaysAhead} onChange={(event) => setSettings({ ...settings, maximumDaysAhead: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none focus:border-sky-300">
              {[7, 14, 21, 30, 45, 60, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200 sm:col-span-2">Calendar event title
            <input value={settings.eventTitle} onChange={(event) => setSettings({ ...settings, eventTitle: event.target.value })} maxLength={160} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-sky-300" />
          </label>
        </div>
        <label className="mt-4 grid gap-2 text-sm text-slate-200">Calendar event note <span className="text-xs font-normal text-slate-400">Optional. It appears in each Google Calendar event.</span>
          <textarea value={settings.eventDescription || ""} onChange={(event) => setSettings({ ...settings, eventDescription: event.target.value })} maxLength={2000} rows={3} className="resize-y rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-sky-300" placeholder="For example: We’ll review your local visibility opportunities and next steps." />
        </label>

        <div className="mt-7">
          <div className="flex items-center gap-2"><CalendarMonthIcon className="text-sky-200" fontSize="small" /><h3 className="font-semibold text-white">Weekly availability</h3></div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            {weekdayRows.map(({ key, label }) => {
              const window = settings.availability[key]?.[0];
              return (
                <div key={key} className="grid gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:items-center sm:px-4">
                  <label className="flex items-center gap-3 text-sm font-medium text-white">
                    <input type="checkbox" checked={Boolean(window)} onChange={(event) => updateSchedule(key, "open", event.target.checked)} className="h-4 w-4 accent-sky-300" />
                    {label}
                  </label>
                  {window ? (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <input aria-label={`${label} start`} type="time" value={window.start} onChange={(event) => updateSchedule(key, "start", event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-slate-950/45 px-2 py-2 text-white outline-none focus:border-sky-300" />
                      <span>to</span>
                      <input aria-label={`${label} end`} type="time" value={window.end} onChange={(event) => updateSchedule(key, "end", event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-slate-950/45 px-2 py-2 text-white outline-none focus:border-sky-300" />
                    </div>
                  ) : <div className="text-sm text-slate-500">Unavailable</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-6 flex justify-end"><button type="submit" disabled={saving} className="rounded-full bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Save booking rules"}</button></div>
      </form>

      <section className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-100 soft-border"><EventAvailableIcon /></span><div><h2 className="font-semibold text-white">Recent and upcoming bookings</h2><p className="mt-1 text-sm text-slate-300">Bookings are kept here even if Calendar sync needs attention.</p></div></div>
        {workspace.appointments.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400">No bookings yet. Share your public link when you are ready.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {workspace.appointments.map((appointment) => (
              <article key={appointment.id} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{appointment.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === "cancelled" ? "bg-slate-500/15 text-slate-300" : "bg-emerald-400/12 text-emerald-100"}`}>{appointment.status === "cancelled" ? "Cancelled" : "Confirmed"}</span>{appointment.calendarSyncStatus === "synced" && <span className="inline-flex items-center gap-1 text-xs text-sky-100"><CheckCircleOutlineIcon fontSize="inherit" /> Google Calendar</span>}{appointment.calendarSyncStatus === "needs_attention" && <span className="text-xs text-amber-100">Calendar sync needs attention</span>}</div>
                    <p className="mt-1 text-sm text-slate-300">{appointmentDate(appointment)} · {appointment.timezone}</p>
                    <p className="mt-2 break-words text-sm text-slate-400">{appointment.companyName ? `${appointment.companyName} · ` : ""}{appointment.email}{appointment.phone ? ` · ${appointment.phone}` : ""}</p>
                    {appointment.notes && <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">{appointment.notes}</p>}
                  </div>
                  {appointment.status !== "cancelled" && <button type="button" disabled={cancellingId === appointment.id} onClick={() => void cancelAppointment(appointment)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/20 disabled:opacity-50"><DeleteOutlineIcon fontSize="small" /> {cancellingId === appointment.id ? "Cancelling…" : "Cancel"}</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
