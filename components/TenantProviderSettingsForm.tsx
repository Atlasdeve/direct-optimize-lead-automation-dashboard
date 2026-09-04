"use client";

import { useState } from "react";
import SaveIcon from "@mui/icons-material/Save";

const fields = [
  ["googlePlacesApiKey", "Google Places API key"],
  ["googleSearchApiKey", "Google Search API key"],
  ["googleSearchCx", "Google Search CX"],
  ["brevoApiKey", "Brevo API key"],
  ["brevoSmtpKey", "Brevo SMTP key"],
  ["smtpHost", "SMTP host"],
  ["smtpUser", "SMTP username"],
  ["smtpPass", "SMTP password"],
  ["telnyxApiKey", "Telnyx API key"],
  ["telnyxConnectionId", "Telnyx connection ID"],
  ["telnyxPhoneNumber", "Telnyx phone number"],
  ["openaiApiKey", "OpenAI API key"]
  , ["leadCaptureApiKey", "Lead capture extension API key"]
] as const;

export function TenantProviderSettingsForm({ initialCtas = [] }: { initialCtas?: Array<{ label?: string | null; url?: string | null }> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState(initialCtas[0]?.label || "Visit our website");
  const [primaryCtaUrl, setPrimaryCtaUrl] = useState(initialCtas[0]?.url || "");
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState(initialCtas[1]?.label || "Create your portal");
  const [secondaryCtaUrl, setSecondaryCtaUrl] = useState(initialCtas[1]?.url || "");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, smtpPort: Number(smtpPort), smtpSecure, primaryCtaLabel, primaryCtaUrl, secondaryCtaLabel, secondaryCtaUrl })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Settings could not be saved.");
    setValues({});
    setMessage(data.message || "Settings saved.");
  }

  const inputClass = "h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/60";
  return <form onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-6 text-slate-400">Add this workspace&apos;s own provider credentials. Existing values stay saved when a field is left blank.</p>
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map(([key, label]) => <label key={key} className="grid gap-2 text-sm text-slate-300">
        {label}
        <input type={key.toLowerCase().includes("pass") || key.toLowerCase().includes("key") ? "password" : "text"} value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder="Leave blank to keep current value" className={inputClass} autoComplete="off" />
      </label>)}
      <label className="grid gap-2 text-sm text-slate-300">SMTP port<input type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} className={inputClass} /></label>
      <label className="flex items-center gap-3 self-end text-sm text-slate-300"><input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} className="h-4 w-4 accent-sky-400" />Use secure SMTP/TLS</label>
    </div>
    <div className="rounded-xl border border-line bg-white/5 p-4">
      <h3 className="font-semibold text-white">Tracked email button URLs</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">These two buttons are added to workspace emails. Clicks are recorded before the recipient is redirected.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">Primary button label<input value={primaryCtaLabel} onChange={(event) => setPrimaryCtaLabel(event.target.value)} className={inputClass} /></label>
        <label className="grid gap-2 text-sm text-slate-300">Primary button URL<input required value={primaryCtaUrl} onChange={(event) => setPrimaryCtaUrl(event.target.value)} placeholder="https://your-company.com" type="url" className={inputClass} /></label>
        <label className="grid gap-2 text-sm text-slate-300">Secondary button label<input value={secondaryCtaLabel} onChange={(event) => setSecondaryCtaLabel(event.target.value)} className={inputClass} /></label>
        <label className="grid gap-2 text-sm text-slate-300">Secondary button URL<input required value={secondaryCtaUrl} onChange={(event) => setSecondaryCtaUrl(event.target.value)} placeholder="https://your-company.com/portal" type="url" className={inputClass} /></label>
      </div>
    </div>
    {error && <div className="rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-100 soft-border">{error}</div>}
    {message && <div className="rounded-lg bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 soft-border">{message}</div>}
    <button disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60"><SaveIcon fontSize="small" />{busy ? "Saving..." : "Save provider settings"}</button>
  </form>;
}
