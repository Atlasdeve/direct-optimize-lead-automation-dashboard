"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import AddIcon from "@mui/icons-material/Add";
import { regions } from "@/lib/regions";
import type { RegionConfig } from "@/lib/types";

const commonTimezones = [
  "America/Toronto",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Qatar",
  "Asia/Karachi",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC"
];

export function RegionTabs({
  selected,
  onSelect,
  regionOptions,
  onRegionsChange
}: {
  selected: string;
  onSelect: (region: string) => void;
  regionOptions?: RegionConfig[];
  onRegionsChange?: (regions: RegionConfig[]) => void;
}) {
  const [items, setItems] = useState<RegionConfig[]>(regionOptions ?? regions);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", timezone: "UTC" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (regionOptions) setItems(regionOptions);
  }, [regionOptions]);

  useEffect(() => {
    if (regionOptions) return;
    let active = true;
    fetch("/api/regions")
      .then((response) => response.json())
      .then((data) => {
        if (!active || !Array.isArray(data.regions)) return;
        setItems(data.regions);
        onRegionsChange?.(data.regions);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [onRegionsChange, regionOptions]);

  async function createNewRegion(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Country could not be added.");
      return;
    }
    const nextRegions = Array.isArray(data.regions) ? data.regions : [...items, data.region].filter(Boolean);
    setItems(nextRegions);
    onRegionsChange?.(nextRegions);
    if (data.region?.name) onSelect(data.region.name);
    setForm({ name: "", country: "", timezone: "UTC" });
    setOpen(false);
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {items.map((region) => (
          <button
            key={region.name}
            onClick={() => onSelect(region.name)}
            className={clsx(
              "h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition soft-border",
              selected === region.name
                ? "bg-sky-400 text-slate-950"
                : "bg-white/6 text-slate-300 hover:bg-white/12 hover:text-white"
            )}
          >
            {region.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Add country"
          aria-label="Add country"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/6 text-slate-200 transition soft-border hover:bg-sky-400 hover:text-slate-950"
        >
          <AddIcon fontSize="small" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form onSubmit={createNewRegion} className="w-full max-w-lg rounded-xl border border-line bg-[#071426] p-5 shadow-2xl">
            <div className="text-sm font-medium text-sky-200">Automation region</div>
            <h2 className="mt-1 text-2xl font-semibold text-white">Add country</h2>
            <p className="mt-2 text-sm text-slate-400">New countries use the same discovery and outreach automation. Daily discovery runs at 9:00 AM in the selected timezone.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">Tab name
                <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, country: current.country || event.target.value }))} placeholder="Australia" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
              </label>
              <label className="text-sm text-slate-300">Country name
                <input required value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="Australia" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
              </label>
              <label className="text-sm text-slate-300 sm:col-span-2">Timezone
                <select required value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-line bg-[#091629] px-3 text-white outline-none focus:border-sky-300">
                  {commonTimezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </label>
            </div>
            {error && <div className="mt-4 rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg bg-white/8 px-4 font-semibold text-white soft-border hover:bg-white/12">Cancel</button>
              <button disabled={saving} className="h-11 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">{saving ? "Adding..." : "Add country"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
