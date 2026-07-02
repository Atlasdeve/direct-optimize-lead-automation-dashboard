"use client";

import { useMemo, useState } from "react";
import SendIcon from "@mui/icons-material/Send";
import PreviewIcon from "@mui/icons-material/Preview";
import { renderBrandedEmailHtml } from "@/lib/brandedEmailTemplate";

const defaultMessage = `Hi there,

I was reviewing your local online presence and noticed a few quick opportunities around Google visibility, website conversion, and review trust signals.

I can send a short audit with the first fixes I would prioritize for your business.`;

export function ComposeEmailForm() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Quick local visibility wins");
  const [heading, setHeading] = useState("A few local growth opportunities");
  const [message, setMessage] = useState(defaultMessage);
  const [ctaLabel, setCtaLabel] = useState("Request a quick audit");
  const [ctaUrl, setCtaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const previewHtml = useMemo(() => renderBrandedEmailHtml({
    heading,
    body: message,
    ctaLabel,
    ctaUrl
  }), [heading, message, ctaLabel, ctaUrl]);

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/compose-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, heading, message, ctaLabel, ctaUrl })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus({ type: "error", text: data.error ?? "Email could not be sent." });
      return;
    }
    setStatus({
      type: "success",
      text: data.result?.provider === "brevo"
        ? `Brevo accepted ${to}. Inbox delivery now depends on recipient spam filters and domain authentication.`
        : data.result?.accepted?.length
        ? `SMTP accepted ${to}. Inbox delivery now depends on recipient spam filters and domain authentication.`
        : data.result?.trackingEnabled
          ? `Email sent to ${to}. Open and click tracking is enabled.`
          : `Email sent to ${to}. Tracking will activate after APP_PUBLIC_URL is set to your public HTTPS app URL.`
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass rounded-xl p-5">
        <div className="mb-5">
          <h2 className="font-semibold text-white">Compose message</h2>
          <p className="mt-1 text-sm text-slate-400">Send a branded Direct Optimize email through your configured Brevo or SMTP sender.</p>
        </div>
        <form onSubmit={sendEmail} className="space-y-4">
          <label className="block text-sm text-slate-300">
            Recipient email
            <input value={to} onChange={(event) => setTo(event.target.value)} type="email" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="block text-sm text-slate-300">
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="block text-sm text-slate-300">
            Template heading
            <input value={heading} onChange={(event) => setHeading(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="block text-sm text-slate-300">
            Email body
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-56 w-full rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-300">
              CTA label
              <input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
            </label>
            <label className="block text-sm text-slate-300">
              CTA URL
              <input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="https://directoptimize.com" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
            </label>
          </div>

          {status && (
            <div className={status.type === "success" ? "rounded-lg bg-emerald-400/12 p-3 text-sm text-emerald-100 soft-border" : "rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border"}>
              {status.text}
            </div>
          )}

          <button disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <SendIcon fontSize="small" />
            {busy ? "Sending..." : "Send Email"}
          </button>
        </form>
      </section>

      <section className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <PreviewIcon className="text-sky-200" fontSize="small" />
          <h2 className="font-semibold text-white">Template preview</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-slate-950">
          <iframe title="Email template preview" srcDoc={previewHtml} className="h-[720px] w-full bg-slate-950" />
        </div>
      </section>
    </div>
  );
}
