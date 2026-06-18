"use client";

import { useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import { RegionTabs } from "@/components/RegionTabs";

const exportTypes = [
  { id: "leads", label: "Leads" },
  { id: "contact_forms", label: "Contact forms" },
  { id: "replies", label: "Replies" }
];

export function ExportCenter() {
  const [region, setRegion] = useState("Canada");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Data portability</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">CSV export center</h1>
      </header>
      <RegionTabs selected={region} onSelect={setRegion} />
      <section className="grid gap-4 md:grid-cols-3">
        {exportTypes.map((type) => (
          <a
            key={type.id}
            href={`/api/export?type=${type.id}&region=${encodeURIComponent(region)}`}
            className="glass rounded-xl p-5 text-slate-200 transition hover:bg-white/8"
          >
            <DownloadIcon />
            <div className="mt-4 text-lg font-semibold text-white">{type.label}</div>
            <div className="mt-2 text-sm text-slate-400">Download {region} {type.label.toLowerCase()} as CSV.</div>
          </a>
        ))}
      </section>
    </div>
  );
}
