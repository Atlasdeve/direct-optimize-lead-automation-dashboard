"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordIcon from "@mui/icons-material/Password";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    setBusy(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error ?? "Password could not be changed.");
    router.push("/login");
    router.refresh();
  }

  const inputClass = "mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300";
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
    <label className="text-sm text-slate-300">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label>
    <label className="text-sm text-slate-300">New password<input required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /></label>
    <label className="text-sm text-slate-300">Confirm password<input required minLength={12} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label>
    {error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border md:col-span-3">{error}</div>}
    <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60 md:col-span-3 md:justify-self-start">
      <PasswordIcon fontSize="small" />{busy ? "Updating..." : "Change password"}
    </button>
  </form>;
}
