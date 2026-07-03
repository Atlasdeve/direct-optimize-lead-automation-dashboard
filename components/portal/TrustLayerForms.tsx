"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SummarizeIcon from "@mui/icons-material/Summarize";

async function uploadFile(projectId: string, file: File) {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("file", file);
  const response = await fetch("/api/portal/uploads", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Upload failed.");
  return data.url as string;
}

export function TrustLayerForms({ projectId, role }: { projectId: string; role: string }) {
  const [comment, setComment] = useState("");
  const [milestone, setMilestone] = useState({ title: "", description: "", amount: 0, dueDate: "" });
  const [snapshot, setSnapshot] = useState({ kind: "Before", title: "", summary: "", screenshotUrls: "" });
  const [message, setMessage] = useState<string | null>(null);
  const canManage = role === "admin";
  const canWork = role === "admin" || role === "employee";

  async function postJson(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Action failed.");
    window.dispatchEvent(new CustomEvent("portal-data-refresh"));
    return data;
  }

  async function submitComment(type = "comment", approved = false) {
    setMessage(null);
    try {
      await postJson(`/api/portal/projects/${projectId}/comments`, { body: comment, type, approved });
      setComment("");
      setMessage(approved ? "Approval sent." : "Comment sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Comment failed.");
    }
  }

  async function submitMilestone(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await postJson(`/api/portal/projects/${projectId}/milestones`, milestone);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Milestone failed.");
    }
  }

  async function submitSnapshot(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await postJson(`/api/portal/projects/${projectId}/snapshots`, snapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot failed.");
    }
  }

  async function uploadSnapshotFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Uploading screenshot...");
    try {
      const url = await uploadFile(projectId, file);
      setSnapshot((current) => ({ ...current, screenshotUrls: [current.screenshotUrls, url].filter(Boolean).join("\n") }));
      setMessage("Screenshot uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function weeklyReport() {
    setMessage(null);
    try {
      await postJson(`/api/portal/projects/${projectId}/weekly-report`, {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report failed.");
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">{role === "client" ? "Comment or approve" : "Add client note"}</h2>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment, approval note, or feedback..." className="mt-4 min-h-28 w-full rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button onClick={() => submitComment()} disabled={!comment} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/8 px-3 text-sm font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-60">
            <AddIcon fontSize="small" />
            Add comment
          </button>
          <button onClick={() => submitComment("approval", true)} disabled={!comment} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
            Approve work
          </button>
        </div>
      </div>

      {canManage && (
        <form onSubmit={submitMilestone} className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Invoice milestone</h2>
          <input value={milestone.title} onChange={(event) => setMilestone({ ...milestone, title: event.target.value })} placeholder="Milestone title" className="mt-4 h-10 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={milestone.description} onChange={(event) => setMilestone({ ...milestone, description: event.target.value })} placeholder="Description" className="mt-3 h-10 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="number" value={milestone.amount} onChange={(event) => setMilestone({ ...milestone, amount: Number(event.target.value) || 0 })} placeholder="Amount" className="h-10 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
            <input type="date" value={milestone.dueDate} onChange={(event) => setMilestone({ ...milestone, dueDate: event.target.value })} className="h-10 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </div>
          <button disabled={!milestone.title} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            Add milestone
          </button>
        </form>
      )}

      {canWork && (
        <form onSubmit={submitSnapshot} className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Before / after snapshot</h2>
          <select value={snapshot.kind} onChange={(event) => setSnapshot({ ...snapshot, kind: event.target.value })} className="mt-4 h-10 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300">
            <option>Before</option>
            <option>After</option>
            <option>Progress</option>
          </select>
          <input value={snapshot.title} onChange={(event) => setSnapshot({ ...snapshot, title: event.target.value })} placeholder="Snapshot title" className="mt-3 h-10 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <textarea value={snapshot.summary} onChange={(event) => setSnapshot({ ...snapshot, summary: event.target.value })} placeholder="What changed or what this proves..." className="mt-3 min-h-20 w-full rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
          <label className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/8 px-3 text-sm font-semibold text-white soft-border hover:bg-white/12">
            <CloudUploadIcon fontSize="small" />
            Upload screenshot
            <input type="file" accept="image/*" onChange={uploadSnapshotFile} className="hidden" />
          </label>
          <button disabled={!snapshot.title} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            Save snapshot
          </button>
        </form>
      )}

      {canWork && (
        <div className="glass rounded-xl p-5 lg:col-span-3">
          <button onClick={weeklyReport} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 font-semibold text-slate-950 hover:bg-emerald-300">
            <SummarizeIcon fontSize="small" />
            Generate weekly client report
          </button>
          {message && <div className="mt-3 rounded-lg bg-sky-400/12 p-3 text-sm text-sky-100 soft-border">{message}</div>}
        </div>
      )}
    </section>
  );
}
