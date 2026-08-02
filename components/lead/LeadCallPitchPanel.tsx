"use client";

import { useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import type { LeadCallPitch } from "@/lib/callPitchTypes";

function pitchText(pitch: LeadCallPitch) {
  return [
    "OPENING",
    pitch.opening,
    "",
    "CONTEXT",
    pitch.contextBridge,
    "",
    "VALUE",
    pitch.valueStatement,
    "",
    "DISCOVERY QUESTIONS",
    ...pitch.discoveryQuestions.map((question) => `- ${question}`),
    "",
    "AUDIT TALKING POINTS",
    ...pitch.talkingPoints.flatMap((point) => [
      `- ${point.finding}`,
      `  Why it matters: ${point.implication}`,
      `  Say: ${point.conversationalLine}`
    ]),
    "",
    "OBJECTION RESPONSES",
    ...pitch.objectionResponses.flatMap((item) => [`- ${item.objection}`, `  ${item.response}`]),
    "",
    "NEXT STEP",
    pitch.nextStep
  ].join("\n");
}

export function LeadCallPitchPanel({ leadId, initialPitch }: { leadId: string; initialPitch: LeadCallPitch }) {
  const [pitch, setPitch] = useState(initialPitch);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  async function regenerate() {
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/call-pitch`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to regenerate the call pitch.");
      setPitch(data.pitch);
      setMessage("Pitch regenerated from the latest lead and audit information.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to regenerate the call pitch.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyPitch() {
    try {
      await navigator.clipboard.writeText(pitchText(pitch));
      setMessage("Call pitch copied.");
    } catch {
      setMessage("The browser could not copy the pitch.");
    }
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AutoAwesomeIcon className="text-sky-200" fontSize="small" />
            <h2 className="font-semibold text-white">AI call pitch</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">A consultative conversation guide based on the latest website and GMB audits.</p>
          {pitch.generationMode === "audit_fallback" && (
            <p className="mt-2 text-xs text-amber-200">Audit-based wording is active because the AI service is unavailable. The pitch remains grounded in the latest findings.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyPitch} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-white soft-border hover:bg-white/12">
            <ContentCopyIcon fontSize="small" /> Copy pitch
          </button>
          <button onClick={regenerate} disabled={generating} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <RefreshIcon className={generating ? "animate-spin" : ""} fontSize="small" />
            {generating ? "Generating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border">{message}</div>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-400/8 p-4 soft-border">
            <div className="text-xs font-semibold uppercase text-emerald-200">Start naturally</div>
            <p className="mt-2 text-sm leading-7 text-slate-100">{pitch.opening}</p>
          </div>
          <div className="rounded-lg bg-white/6 p-4 soft-border">
            <div className="text-xs font-semibold uppercase text-slate-400">Why you called</div>
            <p className="mt-2 text-sm leading-7 text-slate-200">{pitch.contextBridge}</p>
          </div>
          <div className="rounded-lg bg-white/6 p-4 soft-border">
            <div className="text-xs font-semibold uppercase text-slate-400">Position the value</div>
            <p className="mt-2 text-sm leading-7 text-slate-200">{pitch.valueStatement}</p>
          </div>
        </div>

        <div className="rounded-lg bg-white/6 p-4 soft-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <QuestionAnswerIcon fontSize="small" className="text-sky-200" /> Discovery questions
          </div>
          <div className="mt-3 space-y-3">
            {pitch.discoveryQuestions.map((question, index) => (
              <div key={question} className="flex gap-3 text-sm leading-6 text-slate-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-400/12 text-xs font-semibold text-sky-100 soft-border">{index + 1}</span>
                <span>{question}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-3 text-sm font-semibold text-white">Audit-led talking points</div>
        <div className="grid gap-3 lg:grid-cols-2">
          {pitch.talkingPoints.map((point) => (
            <div key={`${point.finding}-${point.conversationalLine}`} className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="font-semibold text-sky-100">{point.finding}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{point.implication}</p>
              <div className="mt-3 rounded-md bg-black/20 p-3 text-sm leading-6 text-slate-100">
                <span className="font-semibold text-emerald-200">Say it naturally: </span>{point.conversationalLine}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg bg-white/6 p-4 soft-border">
          <div className="text-sm font-semibold text-white">If they hesitate</div>
          <div className="mt-3 space-y-3">
            {pitch.objectionResponses.map((item) => (
              <div key={item.objection} className="border-b border-white/8 pb-3 last:border-0 last:pb-0">
                <div className="text-sm font-medium text-amber-100">“{item.objection}”</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{item.response}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-sky-400/10 p-4 soft-border">
          <div className="text-xs font-semibold uppercase text-sky-200">Soft next step</div>
          <p className="mt-2 text-sm leading-7 text-white">{pitch.nextStep}</p>
          <p className="mt-4 text-xs text-slate-400">Generated {new Date(pitch.generatedAt).toLocaleString()}. Use this as a guide and adapt it to the conversation.</p>
        </div>
      </div>
    </section>
  );
}
