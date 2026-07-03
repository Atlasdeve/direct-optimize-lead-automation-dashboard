"use client";

import { useState } from "react";
import SendIcon from "@mui/icons-material/Send";

export function ClientCommentForm({ projectId, employeeName }: { projectId: string; employeeName?: string | null }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/portal/projects/${projectId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, type: "comment", clientVisible: true })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Your comment could not be sent.");
      setBusy(false);
      return;
    }
    setComment("");
    setBusy(false);
    setMessage("Comment sent to your project team.");
    window.dispatchEvent(new CustomEvent("portal-data-refresh", { detail: { type: "client_comment", projectId } }));
  }

  return (
    <form onSubmit={submit} className="glass rounded-xl p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-white">Message the project team</h2>
          <p className="mt-1 text-sm text-slate-400">
            Send feedback or questions to {employeeName || "your assigned specialist"} and the administrator.
          </p>
        </div>
        <div className="text-xs text-slate-500">{comment.length}/2000</div>
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value.slice(0, 2000))}
        placeholder="Write your comment about the latest work update..."
        className="mt-4 min-h-28 w-full resize-y rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm text-sky-100">{message}</div>
        <button
          type="submit"
          disabled={busy || !comment.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SendIcon fontSize="small" />
          {busy ? "Sending..." : "Send comment"}
        </button>
      </div>
    </form>
  );
}
