import { leadQualityLabel, leadScoreFactors } from "@/lib/scoring";
import { leadOpportunitySummary } from "@/lib/leadStrategy";
import type { Lead } from "@/lib/types";

export function LeadScoreBreakdown({ lead, compact = false }: { lead: Lead; compact?: boolean }) {
  const factors = leadScoreFactors(lead);
  const activeFactors = factors.filter((factor) => factor.active);
  const summary = leadOpportunitySummary(lead);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-slate-500">Lead quality</div>
          <div className="mt-1 text-sm font-semibold text-white">{leadQualityLabel(lead.lead_score)} · {summary.temperature}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white">{lead.lead_score}</div>
          <div className="text-xs text-slate-500">/100</div>
        </div>
      </div>
      {!compact && (
        <div className="rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border">
          {summary.action}
        </div>
      )}
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-sky-300" style={{ width: `${Math.min(100, Math.max(0, lead.lead_score))}%` }} />
      </div>
      <div className={compact ? "grid gap-2" : "grid gap-2 md:grid-cols-2"}>
        {(compact ? activeFactors.slice(0, 4) : factors).map((factor) => (
          <div key={factor.label} className="rounded-lg bg-white/6 p-3 soft-border">
            <div className="flex items-center justify-between gap-2">
              <span className={factor.active ? "text-sm text-slate-200" : "text-sm text-slate-500"}>{factor.label}</span>
              <span className={factor.active ? "text-xs font-semibold text-emerald-200" : "text-xs text-slate-600"}>
                {factor.active ? `+${factor.points}` : "0"}
              </span>
            </div>
            {!compact && <div className="mt-1 text-xs text-slate-500">{factor.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
