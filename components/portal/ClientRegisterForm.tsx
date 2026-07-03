"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { regions } from "@/lib/regions";

export function ClientRegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", region: "Canada", name: "", phone: "", username: "", email: "", password: "", websiteUrl: "", gmbUrl: "" });
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
    <form onSubmit={submit} className="glass w-full max-w-3xl space-y-6 rounded-lg p-5 sm:p-7 lg:p-8">
      <div>
        <div className="text-sm font-medium text-sky-200">Client onboarding</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Create your progress portal</h1>
      </div>
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-300">Company name
          <input required autoComplete="organization" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="Your company" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Region
          <select required value={form.region} onChange={(event) => update("region", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-[#091629] px-3 text-white outline-none focus:border-sky-300">
            {regions.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-300">Your name
          <input required autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Full name" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Phone number
          <input required autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+1 555 123 4567" type="tel" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Username
          <input required autoComplete="username" value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="Choose a username" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Email
          <input required autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@company.com" type="email" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300 md:col-span-2">Password
          <input required minLength={12} autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 12 characters" type="password" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Website URL <span className="font-normal text-slate-500">(optional)</span>
          <input value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://example.com" type="url" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
        <label className="text-sm font-medium text-slate-300">Google Business Profile URL <span className="font-normal text-slate-500">(optional)</span>
          <input value={form.gmbUrl} onChange={(event) => update("gmbUrl", event.target.value)} placeholder="https://maps.google.com/..." type="url" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        </label>
      </div>
      {error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}
      <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
        <PersonAddIcon fontSize="small" />
        {busy ? "Creating..." : "Create client portal"}
      </button>
    </form>
  );
}
