"use client";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { BookingSettingsData } from "@/lib/booking";

type BookingProfile = {
  slug: string;
  organizationName: string;
  brandColor: string;
  settings: BookingSettingsData;
};

type Slot = { startsAt: string; endsAt: string; label: string };

function dateInTimeZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function displayDate(date: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "full" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function displaySlot(slot: Slot, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(slot.startsAt));
}

export function PublicBookingPage({ profile, initialCompanyName = "" }: { profile: BookingProfile; initialCompanyName?: string }) {
  const today = useMemo(() => dateInTimeZone(new Date(), profile.settings.timezone), [profile.settings.timezone]);
  const maximumDate = useMemo(() => addDays(today, profile.settings.maximumDaysAhead), [today, profile.settings.maximumDaysAhead]);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ appointment: { name: string; startsAt: string; timezone: string }; calendarSynced: boolean } | null>(null);
  const [companyName, setCompanyName] = useState(initialCompanyName);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError("");
    fetch(`/api/book/${encodeURIComponent(profile.slug)}/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Available times could not be loaded.");
        return data as { slots: Slot[] };
      })
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setSlots([]);
          setError(loadError instanceof Error ? loadError.message : "Available times could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [date, profile.slug]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      setError("Choose an available time before confirming.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/book/${encodeURIComponent(profile.slug)}/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        companyName: form.get("companyName"),
        phone: form.get("phone"),
        notes: form.get("notes"),
        startsAt: selectedSlot.startsAt
      })
    });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || "Your booking could not be confirmed. Please try another time.");
      if (response.status === 409) setSelectedSlot(null);
      return;
    }
    setSuccess(data);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#071321] px-4 py-8 text-slate-100 sm:px-6 sm:py-14">
        <section className="mx-auto max-w-xl rounded-[32px] border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl sm:p-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-100"><CheckCircleOutlineIcon fontSize="large" /></span>
          <div className="mt-6 text-sm font-semibold text-sky-200">Booking confirmed</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">You’re on the calendar.</h1>
          <p className="mt-3 text-base leading-7 text-slate-300">{success.appointment.name}, your meeting with {profile.organizationName} is confirmed for <span className="font-semibold text-white">{new Intl.DateTimeFormat("en-CA", { timeZone: success.appointment.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(success.appointment.startsAt))}</span>.</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
            {success.calendarSynced ? "A Google Calendar invitation has been sent to the email address you provided." : "The team has received your booking and will use the contact details you provided for next steps."}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071321] px-4 py-8 text-slate-100 sm:px-6 sm:py-14">
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] border border-white/15 bg-white/[0.06] shadow-2xl backdrop-blur-2xl lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="border-b border-white/10 bg-gradient-to-br from-sky-400/20 via-cyan-300/10 to-transparent p-6 sm:p-9 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl text-slate-950 shadow-lg" style={{ backgroundColor: profile.brandColor }}><EventAvailableIcon /></span><div><div className="text-sm text-sky-100">Book a meeting with</div><h1 className="text-xl font-semibold text-white">{profile.organizationName}</h1></div></div>
          <h2 className="mt-9 text-3xl font-semibold tracking-tight text-white">{profile.settings.eventTitle}</h2>
          {profile.settings.eventDescription && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-200">{profile.settings.eventDescription}</p>}
          <div className="mt-7 space-y-3 text-sm text-slate-200"><div className="flex items-center gap-3"><ScheduleIcon fontSize="small" className="text-sky-200" /> {profile.settings.appointmentDurationMinutes} minutes</div><div className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center text-sky-200">◷</span> Times shown in {profile.settings.timezone}</div></div>
          <p className="mt-10 text-xs leading-5 text-slate-400">Choose a time that works for you, then enter your contact details to confirm.</p>
        </aside>

        <div className="p-6 sm:p-9">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-sm font-semibold text-sky-200">1. Choose a time</div><h2 className="mt-1 text-2xl font-semibold text-white">Available appointments</h2></div><label className="text-sm text-slate-300">Date<input type="date" value={date} min={today} max={maximumDate} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-white outline-none focus:border-sky-300" /></label></div>
          <p className="mt-3 text-sm text-slate-400">{displayDate(date, profile.settings.timezone)} · {profile.settings.timezone}</p>
          {error && <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-100">{error}</div>}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {loadingSlots ? <div className="col-span-full rounded-xl border border-white/10 p-4 text-sm text-slate-400">Checking availability…</div> : slots.length ? slots.map((slot) => <button key={slot.startsAt} type="button" onClick={() => setSelectedSlot(slot)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${selectedSlot?.startsAt === slot.startsAt ? "border-sky-200 bg-sky-300 text-slate-950" : "border-white/12 bg-white/5 text-slate-100 hover:border-sky-200/60 hover:bg-sky-300/10"}`}>{slot.label}</button>) : <div className="col-span-full rounded-xl border border-dashed border-white/15 p-4 text-sm leading-6 text-slate-400">No times are available on this date. Please choose another day.</div>}
          </div>

          <form onSubmit={submitBooking} className="mt-8 border-t border-white/10 pt-6">
            <div className="text-sm font-semibold text-sky-200">2. Your details</div>
            <h3 className="mt-1 text-xl font-semibold text-white">Confirm your booking</h3>
            {selectedSlot && <p className="mt-2 rounded-xl bg-sky-300/10 px-3 py-2 text-sm text-sky-100">Selected: {displaySlot(selectedSlot, profile.settings.timezone)}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm text-slate-200">Name<input name="name" required minLength={2} maxLength={120} className="rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-sky-300" /></label><label className="grid gap-1.5 text-sm text-slate-200">Email<input name="email" required type="email" maxLength={254} className="rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-sky-300" /></label><label className="grid gap-1.5 text-sm text-slate-200">Company <span className="text-xs text-slate-500">Optional</span><input name="companyName" value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={160} autoComplete="organization" className="rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-sky-300" />{initialCompanyName && <span className="text-xs text-slate-500">Prefilled from your invitation — please correct it if needed.</span>}</label><label className="grid gap-1.5 text-sm text-slate-200">Phone <span className="text-xs text-slate-500">Optional</span><input name="phone" maxLength={60} className="rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-sky-300" /></label></div>
            <label className="mt-3 grid gap-1.5 text-sm text-slate-200">Anything we should know? <span className="text-xs text-slate-500">Optional</span><textarea name="notes" maxLength={1500} rows={3} className="resize-y rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-sky-300" /></label>
            <button type="submit" disabled={!selectedSlot || submitting || loadingSlots} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: profile.brandColor }}>{submitting ? "Confirming…" : "Confirm booking"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
