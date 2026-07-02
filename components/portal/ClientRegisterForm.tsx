"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

export function ClientRegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", name: "", username: "", email: "", password: "", websiteUrl: "", gmbUrl: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/client/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Account could not be created.");
      return;
    }
    router.push("/client-portal");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-2xl space-y-4 rounded-xl p-6">
      <div>
        <div className="text-sm font-medium text-sky-200">Client onboarding</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Create your progress portal</h1>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="Company name" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <input value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="Username" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <input value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="Email" type="email" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <input value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Password" type="password" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300 md:col-span-2" />
        <input value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="Website URL" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <input value={form.gmbUrl} onChange={(event) => update("gmbUrl", event.target.value)} placeholder="Google Business Profile URL" className="h-11 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
      </div>
      {error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}
      <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
        <PersonAddIcon fontSize="small" />
        {busy ? "Creating..." : "Create client portal"}
      </button>
    </form>
  );
}
