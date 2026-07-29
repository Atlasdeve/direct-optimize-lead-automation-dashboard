"use client";

import { useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { adultLeadCategories, type AdultLeadCategoryId } from "@/lib/adultLeadCategories";
import type { AdultLeadAutomationOverview } from "@/lib/adultLeadAutomation";
import type { AdultLeadRecord } from "@/lib/adultLeadStore";
import { FollowUpReminderControl } from "@/components/lead/FollowUpReminderControl";
import type { FollowUpReminderRecord } from "@/lib/followUpReminderOptions";

const statuses = ["Unverified", "Reviewed", "Rejected"];

type EditLeadForm = {
  businessName: string;
  country: string;
  city: string;
  category: AdultLeadCategoryId;
  website: string;
  email: string;
  phone: string;
  reviewStatus: string;
  notes: string;
};

function categoryLabel(categoryId: string) {
  return adultLeadCategories.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function statusClass(status: string) {
  if (status === "Reviewed") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (status === "Rejected") return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

export function AdultLeadsWorkspace({
  initialLeads,
  initialCountries,
  initialAutomation,
  initialReminders
}: {
  initialLeads: AdultLeadRecord[];
  initialCountries: string[];
  initialAutomation: AdultLeadAutomationOverview;
  initialReminders: Record<string, FollowUpReminderRecord>;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [countries, setCountries] = useState(initialCountries);
  const [country, setCountry] = useState(initialCountries[0] ?? "");
  const [city, setCity] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState<AdultLeadCategoryId>(adultLeadCategories[0].id);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [countrySaving, setCountrySaving] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<AdultLeadRecord | null>(null);
  const [editForm, setEditForm] = useState<EditLeadForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [automation, setAutomation] = useState(initialAutomation);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);
  const [outreachBusyId, setOutreachBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(initialLeads.map((lead) => [lead.id, lead.notes ?? ""])));

  const countryLeads = useMemo(() => leads.filter((lead) => lead.country === country), [country, leads]);
  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return countryLeads.filter((lead) => {
      if (status !== "all" && lead.reviewStatus !== status) return false;
      if (categoryFilter !== "all" && lead.category !== categoryFilter) return false;
      if (!query) return true;
      return [lead.businessName, lead.city, lead.website, lead.email, lead.phone, lead.sourceSnippet]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categoryFilter, countryLeads, search, status]);

  const metrics = {
    total: countryLeads.length,
    unverified: countryLeads.filter((lead) => lead.reviewStatus === "Unverified").length,
    reviewed: countryLeads.filter((lead) => lead.reviewStatus === "Reviewed").length,
    contacts: countryLeads.filter((lead) => lead.email || lead.phone).length,
    approved: countryLeads.filter((lead) => lead.outreachApproved && !lead.emailSent).length,
    sent: countryLeads.filter((lead) => lead.emailSent).length
  };

  async function refresh() {
    const response = await fetch("/api/adult-leads");
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setLeads(data.leads ?? []);
      setNotes(Object.fromEntries((data.leads ?? []).map((lead: AdultLeadRecord) => [lead.id, lead.notes ?? ""])));
    }
  }

  async function refreshAutomation() {
    const response = await fetch("/api/adult-leads/automation");
    const data = await response.json().catch(() => ({}));
    if (response.ok) setAutomation(data);
  }

  async function saveAutomation() {
    setAutomationSaving(true);
    setAutomationMessage(null);
    const response = await fetch("/api/adult-leads/automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(automation.settings)
    });
    const data = await response.json().catch(() => ({}));
    setAutomationSaving(false);
    if (!response.ok) {
      setAutomationMessage(data.error ?? "Automation settings could not be saved.");
      return;
    }
    setAutomation(data);
    setAutomationMessage(data.settings.enabled ? "Adult Lead automation is active." : "Adult Lead automation is paused.");
  }

  async function discover() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/adult-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, city: city || null, categoryId: discoveryCategory, limit })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Discovery failed.");
      return;
    }
    await refresh();
    setMessage([
      `${data.created} new lead${data.created === 1 ? "" : "s"} added. ${data.updated} existing result${data.updated === 1 ? "" : "s"} refreshed.`,
      data.warning
    ].filter(Boolean).join(" "));
  }

  async function updateLead(id: string, payload: { reviewStatus?: string; notes?: string }) {
    const response = await fetch(`/api/adult-leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Lead could not be updated.");
      return;
    }
    setLeads((current) => current.map((lead) => lead.id === id ? data.lead : lead));
    setMessage("Lead updated.");
  }

  async function removeLead(id: string) {
    const response = await fetch(`/api/adult-leads/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Lead could not be deleted.");
      return;
    }
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setMessage("Lead deleted.");
  }

  async function updateOutreachApproval(lead: AdultLeadRecord) {
    setOutreachBusyId(lead.id);
    setMessage(null);
    const action = lead.outreachApproved ? "cancel" : "approve";
    const response = await fetch(`/api/adult-leads/${lead.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({}));
    setOutreachBusyId(null);
    if (!response.ok) {
      setMessage(data.error ?? "Outreach approval could not be updated.");
      return;
    }
    setLeads((current) => current.map((item) => item.id === lead.id ? data.lead : item));
    setMessage(action === "approve"
      ? "Email approved. Automation will send it during business hours in the lead's country."
      : "Email approval cancelled.");
  }

  async function addCountry(event: React.FormEvent) {
    event.preventDefault();
    setCountrySaving(true);
    setCountryError(null);
    const response = await fetch("/api/adult-leads/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCountry })
    });
    const data = await response.json().catch(() => ({}));
    setCountrySaving(false);
    if (!response.ok) {
      setCountryError(data.error ?? "Country could not be added.");
      return;
    }
    const nextCountries = Array.isArray(data.countries) ? data.countries : [...countries, data.country].filter(Boolean);
    setCountries(nextCountries);
    setCountry(data.country);
    setCity("");
    setNewCountry("");
    setCountryDialogOpen(false);
    setMessage(`${data.country} added to Adult Leads.`);
    await refreshAutomation();
  }

  function openEditLead(lead: AdultLeadRecord) {
    setEditingLead(lead);
    setEditForm({
      businessName: lead.businessName,
      country: lead.country,
      city: lead.city ?? "",
      category: lead.category as AdultLeadCategoryId,
      website: lead.website,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      reviewStatus: lead.reviewStatus,
      notes: lead.notes ?? ""
    });
    setEditError(null);
  }

  function closeEditLead() {
    if (editSaving) return;
    setEditingLead(null);
    setEditForm(null);
    setEditError(null);
  }

  async function saveEditedLead(event: React.FormEvent) {
    event.preventDefault();
    if (!editingLead || !editForm) return;
    setEditSaving(true);
    setEditError(null);
    const response = await fetch(`/api/adult-leads/${editingLead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm)
    });
    const data = await response.json().catch(() => ({}));
    setEditSaving(false);
    if (!response.ok) {
      setEditError(data.error ?? "Lead could not be updated.");
      return;
    }
    const updated = data.lead as AdultLeadRecord;
    setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
    setNotes((current) => ({ ...current, [updated.id]: updated.notes ?? "" }));
    if (!countries.includes(updated.country)) setCountries((current) => [...current, updated.country]);
    setCountry(updated.country);
    setEditingLead(null);
    setEditForm(null);
    setMessage("Adult Lead details updated.");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-emerald-300">Isolated research queue</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Adult Leads</h1>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lead countries">
        {countries.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={country === item}
            onClick={() => setCountry(item)}
            className={`h-11 rounded-lg px-5 text-sm font-semibold transition soft-border ${country === item ? "bg-sky-400 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/9 hover:text-white"}`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          title="Add country"
          aria-label="Add country"
          onClick={() => {
            setCountryError(null);
            setCountryDialogOpen(true);
          }}
          className="grid h-11 w-11 place-items-center rounded-lg bg-white/5 text-slate-200 transition soft-border hover:bg-sky-400 hover:text-slate-950"
        >
          <AddIcon fontSize="small" />
        </button>
      </div>

      <section className="glass rounded-xl p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-300">
              <ScheduleIcon fontSize="small" />
              <span className="text-sm font-semibold">Daily discovery automation</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">Rotate countries, cities, and categories automatically</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Discovery runs once per country after the selected local hour. Approved emails send automatically during weekday business hours; automated calling remains disabled.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_150px_150px_auto] sm:items-end">
            <label className="flex h-11 items-center gap-3 rounded-lg bg-black/20 px-3 text-sm soft-border">
              <input
                type="checkbox"
                checked={automation.settings.enabled}
                onChange={(event) => setAutomation((current) => ({ ...current, settings: { ...current.settings, enabled: event.target.checked } }))}
                className="h-4 w-4 accent-sky-400"
              />
              Enabled
            </label>
            <label className="grid gap-2 text-xs text-slate-400">
              Local run hour
              <select
                value={automation.settings.localHour}
                onChange={(event) => setAutomation((current) => ({ ...current, settings: { ...current.settings, localHour: Number(event.target.value) } }))}
                className="h-11 rounded-lg bg-black/20 px-3 text-sm text-white soft-border"
              >
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-slate-400">
              Results per country
              <select
                value={automation.settings.maxResults}
                onChange={(event) => setAutomation((current) => ({ ...current, settings: { ...current.settings, maxResults: Number(event.target.value) } }))}
                className="h-11 rounded-lg bg-black/20 px-3 text-sm text-white soft-border"
              >
                {[3, 5, 10].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button type="button" onClick={saveAutomation} disabled={automationSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
              <SaveIcon fontSize="small" />
              {automationSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {automation.targets.map((target) => (
            <div key={target.country} className="rounded-lg bg-black/20 p-4 soft-border">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-white">{target.country}</div>
                <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${target.lastRunDate === target.localDate ? target.lastStatus === "completed" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200" : "bg-sky-400/10 text-sky-200"}`}>
                  {target.lastRunDate === target.localDate ? target.lastStatus === "completed" ? "Completed" : "Needs attention" : "Scheduled"}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-300">{target.categoryLabel}</div>
              <div className="mt-1 text-xs text-slate-500">{target.city} - {String(automation.settings.localHour).padStart(2, "0")}:00 {target.timezone}</div>
              {target.lastRunDate && <div className="mt-3 text-xs text-slate-500">Last run: {target.lastRunDate} - {target.lastCreated} new, {target.lastUpdated} refreshed</div>}
              {target.lastError && <div className="mt-2 line-clamp-2 text-xs text-rose-200">{target.lastError}</div>}
            </div>
          ))}
        </div>
        {automationMessage && <div className="mt-4 rounded-lg bg-sky-400/10 px-4 py-3 text-sm text-sky-100 soft-border">{automationMessage}</div>}
      </section>

      {countryDialogOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCountryDialogOpen(false);
          }}
        >
          <form onSubmit={addCountry} className="w-full max-w-md rounded-xl border border-line bg-[#071426] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Adult Leads country</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Add country</h2>
              </div>
              <button type="button" title="Close" aria-label="Close" onClick={() => setCountryDialogOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 soft-border hover:bg-white/8 hover:text-white">
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <label className="mt-5 grid gap-2 text-sm text-slate-300">
              Country name
              <input
                required
                autoFocus
                value={newCountry}
                onChange={(event) => setNewCountry(event.target.value)}
                placeholder="Philippines"
                className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50"
              />
            </label>
            {countryError && <div className="mt-4 rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-100 soft-border">{countryError}</div>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCountryDialogOpen(false)} className="h-11 rounded-lg bg-white/5 px-4 font-semibold text-white soft-border hover:bg-white/10">Cancel</button>
              <button disabled={countrySaving} className="h-11 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
                {countrySaving ? "Adding..." : "Add country"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingLead && editForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditLead();
          }}
        >
          <form onSubmit={saveEditedLead} className="my-6 w-full max-w-3xl rounded-xl border border-line bg-[#071426] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Adult Lead record</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Edit lead</h2>
              </div>
              <button type="button" title="Close" aria-label="Close edit lead" onClick={closeEditLead} className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 soft-border hover:bg-white/8 hover:text-white">
                <CloseIcon fontSize="small" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Business name
                <input required value={editForm.businessName} onChange={(event) => setEditForm((current) => current ? { ...current, businessName: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Category
                <select value={editForm.category} onChange={(event) => setEditForm((current) => current ? { ...current, category: event.target.value as AdultLeadCategoryId } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
                  {adultLeadCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Country
                <select value={editForm.country} onChange={(event) => setEditForm((current) => current ? { ...current, country: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
                  {countries.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                City
                <input value={editForm.city} onChange={(event) => setEditForm((current) => current ? { ...current, city: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Website URL
                <input required type="text" inputMode="url" value={editForm.website} onChange={(event) => setEditForm((current) => current ? { ...current, website: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Email address
                <input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => current ? { ...current, email: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Phone number
                <input type="tel" value={editForm.phone} onChange={(event) => setEditForm((current) => current ? { ...current, phone: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Review status
                <select value={editForm.reviewStatus} onChange={(event) => setEditForm((current) => current ? { ...current, reviewStatus: event.target.value } : current)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
                  {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Research notes
                <textarea rows={4} maxLength={2000} value={editForm.notes} onChange={(event) => setEditForm((current) => current ? { ...current, notes: event.target.value } : current)} className="resize-y rounded-lg bg-black/20 px-3 py-2 text-white outline-none soft-border focus:border-sky-300/50" />
              </label>
            </div>

            {editError && <div className="mt-4 rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-100 soft-border">{editError}</div>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditLead} disabled={editSaving} className="h-11 rounded-lg bg-white/5 px-4 font-semibold text-white soft-border hover:bg-white/10 disabled:opacity-60">Cancel</button>
              <button disabled={editSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
                <SaveIcon fontSize="small" />
                {editSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="glass rounded-xl p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.7fr_0.55fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm text-slate-300">
            Category
            <select value={discoveryCategory} onChange={(event) => setDiscoveryCategory(event.target.value as AdultLeadCategoryId)} className="h-11 rounded-lg bg-black/20 px-3 soft-border">
              {adultLeadCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            City
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder={`City in ${country}`} className="h-11 rounded-lg bg-black/20 px-3 outline-none soft-border focus:border-sky-300/50" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Results
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="h-11 rounded-lg bg-black/20 px-3 soft-border">
              {[5, 10].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="rounded-lg bg-white/5 px-3 py-2 text-sm soft-border">
            <div className="text-xs text-slate-500">Country</div>
            <div className="mt-1 font-semibold text-white">{country}</div>
          </div>
          <button type="button" onClick={discover} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-60">
            <TravelExploreIcon fontSize="small" />
            {busy ? "Searching..." : "Find leads"}
          </button>
        </div>
        {message && <div className="mt-4 rounded-lg bg-sky-400/10 px-4 py-3 text-sm text-sky-100 soft-border">{message}</div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", metrics.total],
          ["Unverified", metrics.unverified],
          ["Reviewed", metrics.reviewed],
          ["Contact found", metrics.contacts],
          ["Approved", metrics.approved],
          ["Emails sent", metrics.sent]
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden glass rounded-xl">
        <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[1fr_220px_180px]">
          <label className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fontSize="small" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, website, city, email or phone" className="h-11 w-full rounded-lg bg-black/20 pl-10 pr-3 outline-none soft-border focus:border-sky-300/50" />
          </label>
          <label className="relative">
            <FilterAltIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fontSize="small" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full rounded-lg bg-black/20 pl-10 pr-3 soft-border">
              <option value="all">All review statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 soft-border">
            <option value="all">All categories</option>
            {adultLeadCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">No leads found for the selected country and filters.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredLeads.map((lead) => (
              <article key={lead.id} className="grid gap-4 px-5 py-5 xl:grid-cols-[1.05fr_0.75fr_0.85fr_0.8fr_1fr_auto] xl:items-center">
                <div className="min-w-0">
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 font-semibold text-white hover:text-sky-200">
                    <span className="truncate">{lead.businessName}</span>
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </a>
                  <div className="mt-1 truncate text-xs text-slate-500">{lead.website}</div>
                  <div className="mt-2 text-xs text-slate-400">{lead.city ? `${lead.city}, ` : ""}{lead.country}</div>
                </div>

                <div>
                  <div className="text-sm text-slate-200">{categoryLabel(lead.category)}</div>
                  <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(lead.reviewStatus)}`}>{lead.reviewStatus}</span>
                </div>

                <div className="grid min-w-0 gap-2 text-sm">
                  {lead.email ? <a href={`mailto:${lead.email}`} className="flex min-w-0 items-center gap-2 text-slate-300 hover:text-sky-200"><EmailIcon fontSize="small" /><span className="truncate">{lead.email}</span></a> : <span className="text-slate-500">Email unavailable</span>}
                  {lead.phone ? <a href={`tel:${lead.phone}`} className="flex min-w-0 items-center gap-2 text-slate-300 hover:text-sky-200"><PhoneIcon fontSize="small" /><span className="truncate">{lead.phone}</span></a> : <span className="text-slate-500">Phone unavailable</span>}
                </div>

                <div className="min-w-0 text-sm">
                  {lead.emailSent ? (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-emerald-200"><MarkEmailReadIcon fontSize="small" />Email sent</div>
                      <div className="mt-1 text-xs text-slate-500">{lead.emailClicked ? "Link clicked" : lead.emailOpened ? "Email opened" : "Awaiting engagement"}</div>
                    </>
                  ) : lead.outreachStatus === "Failed" ? (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-rose-200"><EmailIcon fontSize="small" />Delivery failed</div>
                      <div className="mt-1 text-xs text-slate-500">Approve again to retry</div>
                    </>
                  ) : lead.outreachApproved ? (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-sky-200"><ScheduleIcon fontSize="small" />Approved</div>
                      <div className="mt-1 text-xs text-slate-500">Queued for business hours</div>
                    </>
                  ) : (
                    <>
                      <div className="text-slate-400">Not approved</div>
                      <div className="mt-1 text-xs text-slate-500">{lead.email ? "Review before sending" : "Add an email first"}</div>
                    </>
                  )}
                </div>

                <div className="min-w-0">
                  <textarea
                    value={notes[lead.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [lead.id]: event.target.value }))}
                    placeholder="Research note"
                    rows={2}
                    className="w-full resize-none rounded-lg bg-black/20 px-3 py-2 text-sm outline-none soft-border focus:border-sky-300/50"
                  />
                </div>

                <div className="flex items-center gap-2 xl:justify-end">
                  <select value={lead.reviewStatus} onChange={(event) => updateLead(lead.id, { reviewStatus: event.target.value })} className="h-10 rounded-lg bg-black/20 px-2 text-xs soft-border">
                    {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  {!lead.emailSent && (
                    <button
                      type="button"
                      onClick={() => updateOutreachApproval(lead)}
                      disabled={!lead.email || outreachBusyId === lead.id}
                      title={lead.outreachApproved ? "Cancel email approval" : "Approve email for automatic sending"}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold soft-border disabled:cursor-not-allowed disabled:opacity-40 ${lead.outreachApproved ? "text-amber-100 hover:bg-amber-300/10" : "text-emerald-200 hover:bg-emerald-400/10"}`}
                    >
                      {lead.outreachApproved ? <CloseIcon fontSize="small" /> : <TaskAltIcon fontSize="small" />}
                      {outreachBusyId === lead.id ? "Saving..." : lead.outreachApproved ? "Cancel" : "Approve email"}
                    </button>
                  )}
                  <FollowUpReminderControl
                    adultLeadId={lead.id}
                    leadName={lead.businessName}
                    initialReminder={initialReminders[lead.id] ?? null}
                    compact
                  />
                  <button type="button" onClick={() => openEditLead(lead)} title="Edit lead" aria-label={`Edit ${lead.businessName}`} className="grid h-10 w-10 place-items-center rounded-lg text-emerald-200 soft-border hover:bg-emerald-400/10">
                    <EditOutlinedIcon fontSize="small" />
                  </button>
                  <button type="button" onClick={() => updateLead(lead.id, { notes: notes[lead.id] ?? "" })} title="Save note" className="grid h-10 w-10 place-items-center rounded-lg text-sky-200 soft-border hover:bg-white/8">
                    <SaveIcon fontSize="small" />
                  </button>
                  <button type="button" onClick={() => removeLead(lead.id)} title="Delete lead" className="grid h-10 w-10 place-items-center rounded-lg text-rose-200 soft-border hover:bg-rose-400/10">
                    <DeleteOutlineIcon fontSize="small" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
