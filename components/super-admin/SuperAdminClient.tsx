"use client";

import { useState } from "react";
import BusinessIcon from "@mui/icons-material/Business";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SaveIcon from "@mui/icons-material/Save";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { clsx } from "clsx";

type Plan = {
  label: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
  description: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
  plan: string;
  planLabel: string;
  billingStatus: string;
  setupFeeStatus: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
  systemStatus: string;
  customDomain: string | null;
  subdomain: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  counts: {
    users: number;
    leads: number;
    clientProjects: number;
    notifications: number;
  };
  admins: Array<{
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    createdAt: string;
  }>;
  apiReadiness: {
    googlePlaces: boolean;
    googleSearch: boolean;
    email: boolean;
    calling: boolean;
    ai: boolean;
  };
};

type FormState = {
  name: string;
  companyName: string;
  slug: string;
  plan: string;
  monthlyPrice: string;
  setupFee: string;
  customDomain: string;
  logoUrl: string;
  brandColor: string;
};

const emptyForm: FormState = {
  name: "",
  companyName: "",
  slug: "",
  plan: "starter",
  monthlyPrice: "99",
  setupFee: "250",
  customDomain: "",
  logoUrl: "",
  brandColor: "#38bdf8"
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function tenantLoginPath(organization: Organization) {
  return `/o/${organization.slug}/login`;
}

function customDomainUrl(organization: Organization) {
  return organization.customDomain ? `https://${organization.customDomain}/login` : null;
}

export function SuperAdminClient({ initialOrganizations, plans }: { initialOrganizations: Organization[]; plans: Record<string, Plan> }) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingApiFor, setEditingApiFor] = useState<string | null>(null);
  const [editingAdminFor, setEditingAdminFor] = useState<string | null>(null);
  const [apiForm, setApiForm] = useState<Record<string, string | boolean>>({});
  const [adminForm, setAdminForm] = useState({ name: "", email: "", username: "", password: "" });
  const [adminError, setAdminError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/super-admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Client could not be onboarded.");
      return;
    }
    setOrganizations(data.organizations ?? []);
    setForm(emptyForm);
    setMessage("Client workspace created.");
  }

  async function patchOrganization(payload: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/super-admin/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Update failed.");
      return { ok: false, error: data.error ?? "Update failed." };
    }
    setOrganizations(data.organizations ?? []);
    setMessage("Client workspace updated.");
    return { ok: true, error: null };
  }

  async function saveApiSettings(organizationId: string) {
    await patchOrganization({ id: organizationId, section: "api", ...apiForm });
    setEditingApiFor(null);
    setApiForm({});
  }

  async function createClientAdmin(organizationId: string) {
    setAdminError(null);
    const result = await patchOrganization({ id: organizationId, section: "admin", ...adminForm });
    if (!result.ok) {
      setAdminError(result.error);
      return;
    }
    setEditingAdminFor(null);
    setAdminForm({ name: "", email: "", username: "", password: "" });
  }

  async function deleteClientAdmin(organizationId: string, userId: string, label: string) {
    if (!window.confirm(`Delete ${label}'s login credentials?`)) return;
    await patchOrganization({ id: organizationId, section: "deleteAdmin", userId });
  }

  const totalMonthly = organizations.reduce((sum, organization) => organization.billingStatus === "active" && organization.systemStatus === "active" ? sum + organization.monthlyPriceCents : sum, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="glass rounded-xl p-5">
          <div className="text-sm text-slate-400">Client systems</div>
          <div className="mt-2 text-3xl font-semibold text-white">{organizations.length}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-sm text-slate-400">Active systems</div>
          <div className="mt-2 text-3xl font-semibold text-white">{organizations.filter((item) => item.systemStatus === "active").length}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-sm text-slate-400">Monthly revenue</div>
          <div className="mt-2 text-3xl font-semibold text-white">{money(totalMonthly)}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-sm text-slate-400">Projects managed</div>
          <div className="mt-2 text-3xl font-semibold text-white">{organizations.reduce((sum, item) => sum + item.counts.clientProjects, 0)}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={submit} className="glass rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-sky-400/12 text-sky-200 soft-border">
              <BusinessIcon />
            </div>
            <div>
              <h2 className="font-semibold text-white">Onboard client</h2>
              <p className="mt-1 text-sm text-slate-400">Create a tenant workspace and white-label login URL.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              Client name
              <input required value={form.name} onChange={(event) => update("name", event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Brand/company name
              <input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="Shown inside their portal" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              URL slug
              <input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="client-company" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Custom domain
              <input value={form.customDomain} onChange={(event) => update("customDomain", event.target.value)} placeholder="portal.client.com" className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Package
              <select value={form.plan} onChange={(event) => {
                const plan = plans[event.target.value];
                update("plan", event.target.value);
                if (plan) {
                  setForm((current) => ({ ...current, monthlyPrice: String(plan.monthlyPriceCents / 100), setupFee: String(plan.setupFeeCents / 100) }));
                }
              }} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border">
                {Object.entries(plans).map(([key, plan]) => <option key={key} value={key}>{plan.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Brand color
              <input type="color" value={form.brandColor} onChange={(event) => update("brandColor", event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 text-white soft-border" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Monthly price
              <input value={form.monthlyPrice} onChange={(event) => update("monthlyPrice", event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Setup fee
              <input value={form.setupFee} onChange={(event) => update("setupFee", event.target.value)} className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Logo URL
              <input value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://..." className="h-11 rounded-lg bg-black/20 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
            </label>
          </div>

          {error && <div className="mt-4 rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-100 soft-border">{error}</div>}
          {message && <div className="mt-4 rounded-lg bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 soft-border">{message}</div>}
          <button disabled={saving} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <SaveIcon fontSize="small" />
            {saving ? "Creating..." : "Create SaaS client"}
          </button>
        </form>

        <div className="space-y-4">
          {Object.entries(plans).map(([key, plan]) => (
            <article key={key} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{plan.label}</h3>
                  <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{money(plan.monthlyPriceCents)}/mo</div>
                  <div className="text-xs text-slate-500">{money(plan.setupFeeCents)} setup</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-white">Client systems</h2>
        <div className="grid gap-4">
          {organizations.map((organization) => (
            <article key={organization.id} className="glass rounded-xl p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-4 w-4 rounded-full soft-border" style={{ backgroundColor: organization.brandColor }} />
                    <h3 className="text-xl font-semibold text-white">{organization.name}</h3>
                    <span className={clsx("rounded-md px-2 py-1 text-xs font-semibold soft-border", organization.systemStatus === "active" ? "bg-emerald-400/10 text-emerald-100" : "bg-amber-400/10 text-amber-100")}>{organization.systemStatus}</span>
                    <span className="rounded-md bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 soft-border">{organization.planLabel}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                    <a className="inline-flex items-center gap-1 text-sky-200 underline-offset-4 hover:underline" href={tenantLoginPath(organization)} target="_blank" rel="noreferrer">
                      <LinkIcon fontSize="small" /> Open {tenantLoginPath(organization)}
                    </a>
                    {customDomainUrl(organization) && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        Custom domain: {customDomainUrl(organization)}
                      </span>
                    )}
                    <span>{organization.counts.users} users</span>
                    <span>{organization.counts.leads} leads</span>
                    <span>{organization.counts.clientProjects} projects</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={organization.plan}
                    onChange={(event) => patchOrganization({ id: organization.id, plan: event.target.value })}
                    className="h-10 rounded-lg bg-black/20 px-3 text-sm text-white soft-border"
                    title="Change package"
                  >
                    {Object.entries(plans).map(([key, plan]) => <option key={key} value={key}>{plan.label}</option>)}
                  </select>
                  <select
                    value={organization.billingStatus}
                    onChange={(event) => patchOrganization({ id: organization.id, billingStatus: event.target.value })}
                    className="h-10 rounded-lg bg-black/20 px-3 text-sm text-white soft-border"
                    title="Billing status"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => patchOrganization({ id: organization.id, systemStatus: organization.systemStatus === "active" ? "paused" : "active" })}
                    className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-200 soft-border hover:bg-white/7"
                  >
                    {organization.systemStatus === "active" ? <PauseCircleIcon fontSize="small" /> : <PlayCircleIcon fontSize="small" />}
                    {organization.systemStatus === "active" ? "Pause" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingApiFor((current) => current === organization.id ? null : organization.id)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-200 soft-border hover:bg-white/7"
                  >
                    <VpnKeyIcon fontSize="small" />
                    APIs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminError(null);
                      setEditingAdminFor((current) => current === organization.id ? null : organization.id);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-200 soft-border hover:bg-white/7"
                  >
                    <PersonAddIcon fontSize="small" />
                    Create admin
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-black/10 p-4 soft-border">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-white">Client admins</h4>
                  <span className="text-xs text-slate-500">{organization.admins.length} account{organization.admins.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {organization.admins.length === 0 && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-400 soft-border md:col-span-2 xl:col-span-3">
                      No client admin has been created yet. Click Create admin and use a temporary password with at least 12 characters.
                    </div>
                  )}
                  {organization.admins.map((admin) => (
                    <div key={admin.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 soft-border">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{admin.name || admin.username || admin.email}</div>
                        <div className="truncate text-xs text-slate-400">{admin.email}</div>
                        <div className="mt-1 text-xs text-slate-500">@{admin.username} · {admin.role}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteClientAdmin(organization.id, admin.id, admin.name || admin.username || admin.email)}
                        title="Delete admin credentials"
                        aria-label="Delete admin credentials"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-rose-200 transition hover:bg-rose-400/10"
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(organization.apiReadiness).map(([key, configured]) => (
                  <div key={key} className={clsx("rounded-lg px-3 py-2 text-sm soft-border", configured ? "bg-emerald-400/10 text-emerald-100" : "bg-white/5 text-slate-400")}>
                    <SettingsInputComponentIcon sx={{ fontSize: 16 }} /> {key}: {configured ? "configured" : "missing"}
                  </div>
                ))}
              </div>

              {editingAdminFor === organization.id && (
                <div className="mt-4 grid gap-3 rounded-xl bg-black/15 p-4 soft-border md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-300">
                    Admin name
                    <input value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-300">
                    Email
                    <input type="email" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-300">
                    Username
                    <input value={adminForm.username} onChange={(event) => setAdminForm((current) => ({ ...current, username: event.target.value }))} placeholder="Optional, generated from email if blank" className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-300">
                    Temporary password
                    <input type="password" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} placeholder="At least 12 characters" className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
                  </label>
                  <div className="rounded-lg bg-sky-400/10 px-3 py-2 text-sm text-sky-100 soft-border md:col-span-2">
                    This admin will sign in at <span className="font-semibold">{tenantLoginPath(organization)}</span> and will belong to {organization.companyName}.
                  </div>
                  {adminError && (
                    <div className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-100 soft-border md:col-span-2">
                      {adminError}
                    </div>
                  )}
                  <button type="button" onClick={() => createClientAdmin(organization.id)} className="h-10 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 md:col-span-2">
                    Create client admin
                  </button>
                </div>
              )}

              {editingApiFor === organization.id && (
                <div className="mt-4 grid gap-3 rounded-xl bg-black/15 p-4 soft-border md:grid-cols-2">
                  {[
                    ["googlePlacesApiKey", "Google Places API key"],
                    ["googleSearchApiKey", "Google Search API key"],
                    ["googleSearchCx", "Google Search CX"],
                    ["brevoApiKey", "Brevo API key"],
                    ["brevoSmtpKey", "Brevo SMTP key"],
                    ["smtpHost", "SMTP host"],
                    ["smtpUser", "SMTP user"],
                    ["smtpPass", "SMTP password"],
                    ["telnyxApiKey", "Telnyx API key"],
                    ["telnyxConnectionId", "Telnyx Call Control App ID"],
                    ["telnyxPhoneNumber", "Telnyx phone number"],
                    ["openaiApiKey", "OpenAI API key"]
                  ].map(([key, label]) => (
                    <label key={key} className="grid gap-2 text-sm text-slate-300">
                      {label}
                      <input
                        type={key.toLowerCase().includes("key") || key.toLowerCase().includes("pass") ? "password" : "text"}
                        value={String(apiForm[key] ?? "")}
                        onChange={(event) => setApiForm((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Leave blank to keep unchanged"
                        className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50"
                      />
                    </label>
                  ))}
                  <label className="grid gap-2 text-sm text-slate-300">
                    SMTP port
                    <input value={String(apiForm.smtpPort ?? "")} onChange={(event) => setApiForm((current) => ({ ...current, smtpPort: event.target.value }))} className="h-10 rounded-lg bg-black/25 px-3 text-white outline-none soft-border focus:border-sky-300/50" />
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-300">
                    <input type="checkbox" checked={apiForm.smtpSecure === true} onChange={(event) => setApiForm((current) => ({ ...current, smtpSecure: event.target.checked }))} className="h-4 w-4 accent-sky-400" />
                    SMTP secure connection
                  </label>
                  <button type="button" onClick={() => saveApiSettings(organization.id)} className="h-10 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 md:col-span-2">
                    Save API readiness
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
