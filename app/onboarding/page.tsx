import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getOrganizationApiConfig } from "@/lib/organizationSettings";
import { providerSettings } from "@/lib/templates";
import { listEnabledRegions } from "@/lib/regionStore";

function Step({ number, title, detail, href, complete }: { number: string; title: string; detail: string; href: string; complete: boolean }) {
  return <div className="flex gap-4 rounded-xl bg-white/5 p-4 soft-border">
    <div className={complete ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400 text-slate-950" : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-400/15 text-sky-200 soft-border"}>{complete ? "✓" : number}</div>
    <div className="min-w-0 flex-1"><div className="font-semibold text-white">{title}</div><p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p></div>
    <Link href={href} className="self-center text-sm font-semibold text-sky-200 hover:text-white">{complete ? "Review" : "Open"}</Link>
  </div>;
}

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.role === "super_admin" || !user.organizationId || !user.organization) redirect("/");
  const [api, regions] = await Promise.all([getOrganizationApiConfig(user.organizationId), listEnabledRegions(user.organizationId)]);
  const readiness = providerSettings(api);
  const hasProvider = readiness.providers.googlePlaces || readiness.providers.googleSearch || readiness.providers.email;
  const hasRegion = regions.some((region) => region.name !== "Custom");
  const planLabel = user.organization.plan === "agency_pro" ? "Agency/Pro" : user.organization.plan === "growth" ? "Growth" : "Starter";

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-sm font-semibold text-emerald-300">Workspace setup</p><h1 className="mt-2 text-4xl font-semibold text-white">Get {user.organization.companyName} ready</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Complete these steps before your team starts discovery and outreach. Your current package is <span className="text-slate-200">{planLabel}</span>.</p></header>
    <section className="glass rounded-xl p-5"><div className="grid gap-3"><Step number="01" title="Connect provider accounts" detail="Add the workspace-owned Google, email, Telnyx, OpenAI, and extension credentials in one secure settings area." href="/settings" complete={hasProvider} /><Step number="02" title="Choose your first region" detail="Confirm at least one region and its city/category schedule before discovery runs." href="/campaigns" complete={hasRegion} /><Step number="03" title="Review outreach rules" detail="Set follow-up timing, daily batch size, and confirm unsubscribe handling before sending." href="/automation" complete={false} /><Step number="04" title="Run a controlled test" detail="Capture or discover one lead, review its audit, then approve one message before scaling up." href="/review" complete={false} /><Step number="05" title="Invite your delivery team" detail="Growth and Agency/Pro workspaces can create client and employee portal accounts after the first project is ready." href="/portal-users" complete={false} /></div></section>
    <section className="rounded-xl bg-amber-400/10 p-5 text-sm leading-6 text-amber-100 soft-border"><strong>Before public launch:</strong> replace the starter Privacy Policy and Terms pages with your final legal documents, confirm provider terms and consent requirements, and test this workspace with a separate client account.</section>
  </div>;
}
