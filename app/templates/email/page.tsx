import { emailTemplates } from "@/lib/templates";
import { currentUser } from "@/lib/auth";
import Link from "next/link";

export default async function EmailTemplatesPage() {
  const user = await currentUser();
  const workspaceName = user?.organization?.companyName || "Direct Optimize";
  const showDirectOptimizeInitialTemplate = !user?.organizationId || user.organizationId === "org_direct_optimize";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-medium text-sky-200">Branded outreach</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Email templates</h1>
        </div>
        <Link href="/compose-email" className="inline-flex h-11 items-center justify-center rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300">
          Compose Email
        </Link>
      </div>
      <section className="glass rounded-xl p-5">
        <div className="text-lg font-semibold text-white">{workspaceName} branded template</div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Dark navy dashboard theme, glass-style container, sky accent CTA, plain-text fallback, unsubscribe language, and optional open/click tracking for automated outreach.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">HTML + plain text</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">SMTP compatible</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Used by compose page</div>
        </div>
      </section>
      {showDirectOptimizeInitialTemplate ? (
        <section className="glass rounded-xl p-5">
          <div className="text-sm font-medium text-sky-200">Day 1 campaign email</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Free 14-day Google Business Profile optimization</h2>
          <p className="mt-2 text-sm text-slate-400">
            Subject: Free 14-day Google Business Profile optimization for [business name]
          </p>
          <div className="mt-4 rounded-lg bg-white/6 p-4 text-sm leading-6 text-slate-300 soft-border">
            <p>Hi [owner or business team],</p>
            <p className="mt-3">In [city, country], [business name] has real potential to attract more local customers. The message highlights the available Google Business Profile rating, reviews, and a relevant profile opportunity, plus a brief website observation when an audit is available.</p>
            <p className="mt-3">We’re offering a complimentary 14-day Google Business Profile optimization. We’ll agree on priorities first and make changes only with approval.</p>
            <p className="mt-3">An anonymized specialist-work case-study PDF is attached. It is not presented as Direct Optimize client case studies. The email asks the recipient to reply YES for a brief plan and retains the unsubscribe footer.</p>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Attachment: Direct Optimize - GBP Keyword Case Studies.pdf. The lead-specific GMB and website audit PDFs are not attached to this initial email. Buttons: Visit Direct Optimize · Create Your Portal.
          </p>
        </section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {emailTemplates.map((template) => (
          <div key={template.id} className="glass rounded-xl p-5">
            <div className="text-lg font-semibold text-white">{template.name}</div>
            <div className="mt-2 text-sm text-slate-400">{template.subject}</div>
            <div className="mt-4 rounded-lg bg-white/6 p-3 text-xs text-slate-300 soft-border">
              Includes company, industry, region, website status, online presence, GMB optimization angle, and unsubscribe text.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
