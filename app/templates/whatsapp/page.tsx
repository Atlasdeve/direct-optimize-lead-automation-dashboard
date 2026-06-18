import { whatsappIdentificationRules } from "@/lib/templates";

export default function WhatsappTemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-semibold text-white">WhatsApp number identification</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {whatsappIdentificationRules.map((rule) => (
          <div key={rule.id} className="glass rounded-xl p-5">
            <div className="text-lg font-semibold text-white">{rule.name}</div>
            <div className="mt-2 text-sm text-slate-400">{rule.description}</div>
            <div className="mt-4 flex gap-3 text-sm">
              <span className="rounded-md bg-white/6 px-3 py-1 text-slate-300 soft-border">{rule.active ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="glass rounded-xl p-5 text-sm text-slate-300">
        WhatsApp is now used only as a contact-identification signal. The app does not connect to Meta, receive WhatsApp webhooks, or send WhatsApp messages.
      </div>
    </div>
  );
}
