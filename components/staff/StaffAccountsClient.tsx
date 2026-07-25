"use client";

import { useState } from "react";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

type StaffAccount = {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  phone?: string | null;
  role: string;
  createdAt?: string | Date;
};

const emptyForm = { role: "manager", name: "", username: "", email: "", password: "" };

function roleDetails(role: string) {
  return role === "admin"
    ? {
        label: "Administrator",
        description: "Full dashboard access, including staff account creation.",
        className: "border-sky-300/25 bg-sky-300/10 text-sky-100",
        icon: AdminPanelSettingsIcon
      }
    : {
        label: "Manager",
        description: "Operational access without permission to create privileged staff.",
        className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
        icon: ManageAccountsIcon
      };
}

export function StaffAccountsClient({ initialStaff }: { initialStaff: StaffAccount[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createStaff(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Staff account could not be created.");
      return;
    }
    setStaff((current) => [...current, data.staff]);
    setForm(emptyForm);
    setShowPassword(false);
    setMessage(`${data.staff.name || data.staff.username || data.staff.email} can now sign in.`);
  }

  const selectedRole = roleDetails(form.role);

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form onSubmit={createStaff} className="glass rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-sky-400/12 text-sky-200 soft-border">
              <PersonAddIcon />
            </div>
            <div>
              <h2 className="font-semibold text-white">Create staff account</h2>
              <p className="mt-1 text-sm text-slate-400">The new user signs in from the regular dashboard login page.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              Access role
              <select value={form.role} onChange={(event) => update("role", event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Full name
              <input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Team member name" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Username
              <input required value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="username" autoCapitalize="none" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Email address
              <input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@directoptimize.com" autoCapitalize="none" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Temporary password
              <span className="relative">
                <input required minLength={12} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 12 characters" autoComplete="new-password" className="h-11 w-full rounded-lg bg-black/20 px-3 pr-12 text-white outline-none soft-border focus:border-sky-300/50" />
                <button type="button" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-white/7 hover:text-white">
                  {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </button>
              </span>
            </label>
          </div>

          {error && <div className="mt-4 rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-100 soft-border">{error}</div>}
          {message && <div className="mt-4 rounded-lg bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 soft-border">{message}</div>}
          <button disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <PersonAddIcon fontSize="small" />
            {busy ? "Creating..." : `Create ${selectedRole.label}`}
          </button>
        </form>

        <aside className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Role permissions</h2>
          <div className="mt-4 space-y-3">
            {["admin", "manager"].map((role) => {
              const details = roleDetails(role);
              const Icon = details.icon;
              return (
                <div key={role} className={`rounded-lg border p-4 ${details.className}`}>
                  <div className="flex items-center gap-2 font-semibold"><Icon fontSize="small" />{details.label}</div>
                  <p className="mt-2 text-sm opacity-80">{details.description}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Use a unique account for every person. Do not share the primary administrator password.</p>
        </aside>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Dashboard staff</h2>
            <p className="mt-1 text-sm text-slate-400">{staff.length} privileged account{staff.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((account) => {
            const details = roleDetails(account.role);
            const Icon = details.icon;
            return (
              <article key={account.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{account.name || account.username || account.email}</div>
                    <div className="mt-1 truncate text-sm text-slate-400">{account.email}</div>
                    <div className="mt-1 text-xs text-slate-500">@{account.username}</div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${details.className}`}>
                    <Icon sx={{ fontSize: 15 }} />
                    {details.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
