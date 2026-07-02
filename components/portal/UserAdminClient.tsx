"use client";

import { useState } from "react";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

type PortalUser = { id: string; email: string; username?: string | null; name?: string | null; role: string };

export function UserAdminClient({ initialUsers }: { initialUsers: PortalUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({ role: "employee", name: "", username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/portal/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "User could not be created.");
      return;
    }
    setUsers([data.user, ...users]);
    setForm({ role: "employee", name: "", username: "", email: "", password: "" });
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">Create portal user</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 md:grid-cols-3">
          <select value={form.role} onChange={(event) => update("role", event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300">
            <option value="employee">Employee</option>
            <option value="client">Client</option>
          </select>
          <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Name" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="Username" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="Email" type="email" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <input value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Password" type="password" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <PersonAddIcon fontSize="small" />
            {busy ? "Creating..." : "Create user"}
          </button>
        </form>
        {error && <div className="mt-3 rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {users.map((user) => (
          <div key={user.id} className="glass rounded-xl p-4">
            <div className="font-semibold text-white">{user.name || user.username || user.email}</div>
            <div className="mt-1 text-sm text-slate-400">{user.email} · {user.role}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
