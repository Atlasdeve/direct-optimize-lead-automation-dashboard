import { providerSettings } from "@/lib/templates";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { currentUser } from "@/lib/auth";
import { getOrganizationApiConfig } from "@/lib/organizationSettings";
import { TenantProviderSettingsForm } from "@/components/TenantProviderSettingsForm";
import { organizationCtas } from "@/lib/organizationSettings";

export default async function SettingsPage() {
  const user = await currentUser();
  const tenantApiSettings = user?.role === "super_admin" ? undefined : await getOrganizationApiConfig(user?.organizationId);
  const settings = providerSettings(tenantApiSettings);
  const appBaseUrl = (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const workspacePortalUrl = user?.organization?.slug ? `${appBaseUrl}/o/${user.organization.slug}/login` : appBaseUrl;
  const defaultCtas = [
    { label: `Visit ${user?.organization?.companyName || "our website"}`, url: workspacePortalUrl },
    { label: "Open your portal", url: workspacePortalUrl }
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-semibold text-white">Settings</h1>
      {user?.organization && user.role !== "super_admin" && <section className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">Workspace onboarding</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{user.organization.companyName}</h2>
            <p className="mt-1 text-sm text-slate-400">Package: <span className="text-slate-200">{user.organization.plan === "agency_pro" ? "Agency/Pro" : user.organization.plan === "growth" ? "Growth" : "Starter"}</span></p>
          </div>
          <div className="rounded-lg bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 soft-border">{user.organization.systemStatus === "active" ? "Workspace active" : "Workspace paused"}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Google Places", "Email provider", "Telnyx calling", "OpenAI AI calls"].map((label, index) => {
            const configured = [settings?.providers.googlePlaces, settings?.providers.email, settings?.providers.calling, settings?.providers.openai][index];
            return <div key={label} className="rounded-lg bg-white/6 p-3 soft-border"><div className="text-sm text-slate-300">{label}</div><div className={configured ? "mt-1 text-sm text-emerald-200" : "mt-1 text-sm text-amber-200"}>{configured ? "Connected" : "Needs setup"}</div></div>;
          })}
        </div>
      </section>}
      <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">Account security</h2>
        <ChangePasswordForm />
      </section>
      <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">Provider readiness</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(settings?.providers ?? {}).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-white/6 p-3 soft-border">
              <span className="text-sm text-slate-300">{key}</span>
              <span className={value ? "text-emerald-200" : "text-slate-500"}>{value ? "Configured" : "Missing"}</span>
            </div>
          ))}
        </div>
      </section>
      {user?.organizationId && user.role !== "super_admin" && <section className="glass rounded-xl p-5">
        <h2 className="mb-4 font-semibold text-white">Workspace provider settings</h2>
        <TenantProviderSettingsForm initialCtas={organizationCtas(tenantApiSettings ?? null, defaultCtas)} />
      </section>}
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
