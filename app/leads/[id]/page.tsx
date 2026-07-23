import Link from "next/link";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import { StatusBadge } from "@/components/StatusBadge";
import { getDbLead, getDbLeadContacts, getLatestGmbAudit, getLatestLeadIntelligence, getLeadEmailTracking, runGmbAudit, runLeadIntelligenceAudit } from "@/lib/dbStore";
import { LeadOutreachControls } from "@/components/lead/LeadOutreachControls";
import { LeadScoreBreakdown } from "@/components/lead/LeadScoreBreakdown";
import { LeadResearchChecklist } from "@/components/lead/LeadResearchChecklist";
import { CreateOpportunityPanel } from "@/components/lead/CreateOpportunityPanel";
import { LeadIntelligencePanel } from "@/components/lead/LeadIntelligencePanel";
import { GmbAuditPanel } from "@/components/lead/GmbAuditPanel";
import { buildPersonalizedEmail } from "@/lib/providers";
import { whatsappNumberFromPhone } from "@/lib/whatsappIdentification";
import { leadOpportunitySummary } from "@/lib/leadStrategy";
import { CreateProjectFromLeadButton } from "@/components/portal/CreateProjectFromLeadButton";
import { getProjectByLeadId } from "@/lib/portalStore";
import { LeadCallingPanel } from "@/components/lead/LeadCallingPanel";
import { DeleteLeadButton } from "@/components/lead/DeleteLeadButton";
import { DecisionMakerPanel } from "@/components/lead/DecisionMakerPanel";
import { EditLeadDetailsButton } from "@/components/lead/EditLeadDetailsButton";

function websiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getDbLead(id);

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl glass rounded-xl p-8">
        <h1 className="text-2xl font-semibold text-white">Lead not found</h1>
        <Link href="/" className="mt-4 inline-block text-sky-200">Back to dashboard</Link>
      </div>
    );
  }

  const fields = [
    ["Company", lead.company_name],
    ["Region", lead.region],
    ["Country", lead.country],
    ["City", lead.city],
    ["Category", lead.category],
    ["Business type", lead.business_type],
    ["Owner", lead.owner_name ?? "Pending enrichment"],
    ["CEO", lead.ceo_name ?? "Pending enrichment"],
    ["Manager", lead.manager_name ?? "Pending enrichment"],
    ["Source", lead.source_platform],
    ["Consent status", lead.consent_status],
    ["Next follow-up", lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : "Not scheduled"]
  ];
  const contacts = await getDbLeadContacts(lead.id);
  const emailTracking = await getLeadEmailTracking(lead.id);
  const contactForms = contacts.filter((contact) => contact.type === "contact_form");
  const [websiteAudit, gmbAudit] = await Promise.all([
    getLatestLeadIntelligence(lead.id).then((audit) => audit ?? runLeadIntelligenceAudit(lead.id)),
    getLatestGmbAudit(lead.id).then((audit) => audit ?? runGmbAudit(lead.id))
  ]);
  const preview = buildPersonalizedEmail(lead, "local SEO and website conversion", { website: websiteAudit, gmb: gmbAudit });
  const whatsappNumber = whatsappNumberFromPhone(lead.phone);
  const opportunitySummary = leadOpportunitySummary(lead);
  const existingProject = await getProjectByLeadId(lead.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="glass rounded-xl p-6">
        <Link href={`/dashboard?region=${encodeURIComponent(lead.region)}`} className="text-sm text-sky-200">Back to {lead.region} leads</Link>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-white">{lead.company_name}</h1>
            <p className="mt-2 text-slate-400">{lead.city}, {lead.country} · {lead.category}</p>
            <CreateProjectFromLeadButton lead={lead} existingProjectId={existingProject?.id ?? null} />
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <StatusBadge status={lead.outreach_status} />
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <EditLeadDetailsButton lead={lead} />
              <DeleteLeadButton leadId={lead.id} companyName={lead.company_name} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold text-white">Contact channels</h2>
          <div className="space-y-3 text-sm text-slate-300">
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 transition hover:text-sky-200"
                title={`Email ${lead.email}`}
              >
                <EmailIcon fontSize="small" />
                <span className="truncate underline-offset-4 hover:underline">{lead.email}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 text-slate-500"><EmailIcon fontSize="small" />Email discovery pending</div>
            )}
            <div className="flex items-center gap-2">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 transition hover:text-sky-200"
                  title={`Call ${lead.phone}`}
                >
                  <PhoneIcon fontSize="small" />
                  <span className="truncate underline-offset-4 hover:underline">{lead.phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2 text-slate-500"><PhoneIcon fontSize="small" />Phone pending</div>
              )}
              {whatsappNumber && (
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" title="Open WhatsApp chat" className="text-emerald-300 hover:text-emerald-200">
                  <WhatsAppIcon fontSize="small" />
                </a>
              )}
            </div>
            {lead.website ? (
              <a
                href={websiteHref(lead.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 transition hover:text-sky-200"
                title={`Open ${lead.website}`}
              >
                <LanguageIcon fontSize="small" />
                <span className="truncate underline-offset-4 hover:underline">{lead.website}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 text-slate-500"><LanguageIcon fontSize="small" />No website detected</div>
            )}
            {contactForms.length > 0 && (
              <div className="flex items-center gap-2">
                <ContactPageIcon fontSize="small" />
                <a className="text-sky-200 hover:text-sky-100" href={contactForms[0].value} target="_blank" rel="noopener noreferrer">
                  Contact form found
                </a>
              </div>
            )}
          </div>
          <div className="mt-6">
            <LeadScoreBreakdown lead={lead} />
          </div>
        </section>

        <section className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold text-white">Lead detail</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-sm text-slate-200">{value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <DecisionMakerPanel
        leadId={lead.id}
        name={lead.decision_maker_name}
        title={lead.decision_maker_title}
        source={lead.decision_maker_source}
        confidence={lead.decision_maker_confidence}
        linkedinUrl={lead.linkedin_url}
      />

      <section className="glass rounded-xl p-5">
        <h2 className="mb-3 font-semibold text-white">Notes and compliance</h2>
        <p className="text-sm leading-6 text-slate-300">{lead.notes}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Unsubscribed: {lead.unsubscribed ? "Yes" : "No"}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Email sent: {lead.email_sent ? "Yes" : "No"}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">WhatsApp signal: {whatsappNumber ? "Phone shortcut available" : "No usable phone"}</div>
        </div>
      </section>

      <LeadCallingPanel
        leadId={lead.id}
        phone={lead.phone}
        region={lead.region}
        companyName={lead.company_name}
        websiteFlags={websiteAudit.seoFlags}
        gmbFlags={gmbAudit.gmbFlags}
      />

      <section className="glass rounded-xl p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-semibold text-white">Recommended sequence</h2>
            <p className="mt-1 text-sm text-slate-400">{opportunitySummary.action}</p>
          </div>
          <div className="rounded-lg bg-sky-400/12 px-3 py-2 text-sm font-semibold text-sky-100 soft-border">
            {opportunitySummary.temperature} · {opportunitySummary.quality}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {opportunitySummary.sequence.map((step) => (
            <div key={step.day} className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-xs uppercase text-slate-500">{step.day}</div>
              <div className="mt-1 font-semibold text-white">{step.channel}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{step.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-xl p-5">
        <h2 className="mb-3 font-semibold text-white">Email tracking</h2>
        {emailTracking.length === 0 && (
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No tracked email sends yet.</div>
        )}
        {emailTracking.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {emailTracking.map((item) => (
              <div key={item.id} className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{item.status}</span>
                  <span className="text-xs text-slate-500">{new Date(item.sentAt).toLocaleString()}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500">Opens</div>
                    <div className="mt-1 text-xl font-semibold text-white">{item.openCount}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.lastOpenedAt ? new Date(item.lastOpenedAt).toLocaleString() : "Not opened"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Clicks</div>
                    <div className="mt-1 text-xl font-semibold text-white">{item.clickCount}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.lastClickedAt ? new Date(item.lastClickedAt).toLocaleString() : "No clicks"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <LeadOutreachControls lead={lead} preview={preview} />
      <LeadIntelligencePanel leadId={lead.id} />
      <GmbAuditPanel leadId={lead.id} />
      <LeadResearchChecklist leadId={lead.id} />
      <CreateOpportunityPanel leadId={lead.id} companyName={lead.company_name} />
    </div>
  );
}
