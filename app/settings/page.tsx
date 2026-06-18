import { providerSettings } from "@/lib/templates";

export default function SettingsPage() {
  const settings = providerSettings();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-semibold text-white">Settings</h1>
      <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">Provider readiness</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(settings?.providers ?? {}).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-white/6 p-3 soft-border">
              <span className="text-sm text-slate-300">{key}</span>
              <span className={value ? "text-emerald-200" : "text-slate-500"}>{value ? "Configured" : "Missing env"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">Rate limits and compliance</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Daily email cap: {settings?.rateLimits.dailyEmailCap}</div>
          {Object.entries(settings?.compliance ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">{key}: {value ? "Enabled" : "Disabled"}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
