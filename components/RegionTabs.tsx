"use client";

import { clsx } from "clsx";
import { regions } from "@/lib/regions";

export function RegionTabs({ selected, onSelect }: { selected: string; onSelect: (region: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {regions.map((region) => (
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
    </div>
  );
}
