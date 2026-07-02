"use client";

import { useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

export function WorkLogForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("Daily progress update");
  const [summary, setSummary] = useState("");
  const [changesMade, setChangesMade] = useState("");
  const [timeMinutes, setTimeMinutes] = useState(60);
  const [progress, setProgress] = useState(25);
  const [status, setStatus] = useState("In progress");
  const [screenshotUrls, setScreenshotUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadScreenshot(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Uploading screenshot...");
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("file", file);
    const response = await fetch("/api/portal/uploads", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Upload failed.");
      return;
    }
    setScreenshotUrls((current) => [current, data.url].filter(Boolean).join("\n"));
    setMessage("Screenshot uploaded.");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/portal/projects/${projectId}/worklogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, changesMade, timeMinutes, progress, status, screenshotUrls })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Work log could not be saved.");
      return;
    }
    setMessage("Work log saved. Refreshing latest progress.");
    window.location.reload();
  }

  return (
    <section className="glass rounded-xl p-5">
      <h2 className="font-semibold text-white">Submit daily work</h2>
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What did you work on today?" className="min-h-24 rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
        <textarea value={changesMade} onChange={(event) => setChangesMade(event.target.value)} placeholder="Detailed changes made, pages updated, SEO tasks, GMB changes, fixes, notes..." className="min-h-32 rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            Time spent minutes
            <input type="number" min={0} value={timeMinutes} onChange={(event) => setTimeMinutes(Number(event.target.value) || 0)} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="text-sm text-slate-300">
            Project progress %
            <input type="number" min={0} max={100} value={progress} onChange={(event) => setProgress(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="text-sm text-slate-300">
            Status
            <input value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
        </div>
        <textarea value={screenshotUrls} onChange={(event) => setScreenshotUrls(event.target.value)} placeholder="Screenshot URLs, one per line. You can paste uploaded image links here." className="min-h-20 rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/8 px-4 font-semibold text-white soft-border hover:bg-white/12">
          <CloudUploadIcon fontSize="small" />
          Upload screenshot proof
          <input type="file" accept="image/*" onChange={uploadScreenshot} className="hidden" />
        </label>
        {message && <div className="rounded-lg bg-sky-400/12 p-3 text-sm text-sky-100 soft-border">{message}</div>}
        <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
          <SaveIcon fontSize="small" />
          {busy ? "Saving..." : "Save daily work"}
        </button>
      </form>
    </section>
  );
}
