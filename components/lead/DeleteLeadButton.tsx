"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon from "@mui/icons-material/Close";

export function DeleteLeadButton({ leadId, companyName }: { leadId: string; companyName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function deleteLead() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Lead could not be deleted.");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-400/12 px-4 text-sm font-semibold text-rose-100 transition soft-border hover:bg-rose-400/20"
      >
        <DeleteForeverIcon fontSize="small" />
        Delete lead
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-rose-400/10 p-3 soft-border" role="alert">
      <p className="text-sm text-rose-100">Delete {companyName}? This permanently removes the lead and its outreach history.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={deleteLead}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
        >
          <DeleteForeverIcon fontSize="small" />
          {busy ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white/6 px-3 text-sm font-semibold text-slate-200 transition soft-border hover:bg-white/10 disabled:opacity-60"
        >
          <CloseIcon fontSize="small" />
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
    </div>
  );
}
