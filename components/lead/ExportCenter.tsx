"use client";

import { useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import { RegionTabs } from "@/components/RegionTabs";
import type { RegionConfig } from "@/lib/types";

const exportTypes = [
  { id: "leads", label: "Leads" },
  { id: "contact_forms", label: "Contact forms" },
  { id: "replies", label: "Replies" }
];

export function ExportCenter() {
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<RegionConfig[]>([]);
  const selectedLabel = regions.find((item) => item.name === region)?.label || regions.find((item) => item.name === region)?.country || region;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Data portability</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">CSV export center</h1>
      </header>
      <RegionTabs selected={region} onSelect={setRegion} onRegionsChange={setRegions} />
      <section className="grid gap-4 md:grid-cols-3">
        {exportTypes.map((type) => (
          <a
            key={type.id}
            href={region ? `/api/export?type=${type.id}&region=${encodeURIComponent(region)}` : "#"}
            onClick={(event) => { if (!region) event.preventDefault(); }}
            aria-disabled={!region}
            tabIndex={region ? 0 : -1}
            className="glass rounded-xl p-5 text-slate-200 transition hover:bg-white/8"
          >
            <DownloadIcon />
            <div className="mt-4 text-lg font-semibold text-white">{type.label}</div>
            <div className="mt-2 text-sm text-slate-400">{region ? `Download ${selectedLabel} ${type.label.toLowerCase()} as CSV.` : "Loading available regions..."}</div>
          </a>
        ))}
      </section>
    </div>
  );
}
