"use client";

import { useCallback, useEffect, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import { classifyReply, replyClassificationLabel, replyTextWithoutQuotedHistory } from "@/lib/replyClassifier";

type ReplyItem = {
  id: string;
  fromEmail: string;
  subject?: string | null;
  body: string;
  receivedAt: string;
};

export function LiveReplyInbox({ initialReplies }: { initialReplies: ReplyItem[] }) {
  const [replies, setReplies] = useState(initialReplies);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/replies", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setReplies(data.replies ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function syncNow() {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/replies/sync", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.reason || data.error || "Inbox sync failed.");
      await refresh();
      setMessage(`Inbox checked. ${data.stored ?? 0} new reply/replies added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inbox sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Inbox replies</h1>
          <p className="mt-1 text-sm text-slate-400">Updates automatically every 15 seconds.</p>
        </div>
        <button type="button" onClick={syncNow} disabled={syncing} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
          <RefreshIcon fontSize="small" className={syncing ? "animate-spin" : ""} />
          {syncing ? "Checking inbox..." : "Sync inbox now"}
        </button>
      </div>
      {message && <p className="rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border" role="status">{message}</p>}
      {replies.length === 0 && <div className="glass rounded-xl p-5 text-sm text-slate-400">No matched lead replies yet.</div>}
      <div className="space-y-4">
        {replies.map((reply) => {
          const cleanBody = replyTextWithoutQuotedHistory(reply.body);
          return (
            <article key={reply.id} className="glass rounded-xl p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="font-semibold text-white">{reply.subject || "No subject"}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white/7 px-3 py-1 text-xs capitalize text-sky-100 soft-border">
                    {replyClassificationLabel(classifyReply(reply.subject ?? "", reply.body))}
                  </span>
                  <div className="text-sm text-slate-400">{new Date(reply.receivedAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-400">{reply.fromEmail}</div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{cleanBody || reply.body}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
