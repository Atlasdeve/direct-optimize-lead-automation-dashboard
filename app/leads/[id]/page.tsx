import Link from "next/link";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import { StatusBadge } from "@/components/StatusBadge";
import { getDbLead, getDbLeadContacts, getLeadEmailTracking } from "@/lib/dbStore";
import { LeadOutreachControls } from "@/components/lead/LeadOutreachControls";
import { LeadScoreBreakdown } from "@/components/lead/LeadScoreBreakdown";
import { LeadResearchChecklist } from "@/components/lead/LeadResearchChecklist";
import { CreateOpportunityPanel } from "@/components/lead/CreateOpportunityPanel";
import { LeadIntelligencePanel } from "@/components/lead/LeadIntelligencePanel";
import { GmbAuditPanel } from "@/components/lead/GmbAuditPanel";
import { buildPersonalizedEmail } from "@/lib/providers";
import { whatsappNumberFromPhone } from "@/lib/whatsappIdentification";

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
  const preview = buildPersonalizedEmail(lead);
  const whatsappNumber = whatsappNumberFromPhone(lead.phone);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="glass rounded-xl p-6">
        <Link href="/" className="text-sm text-sky-200">Back to dashboard</Link>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-white">{lead.company_name}</h1>
            <p className="mt-2 text-slate-400">{lead.city}, {lead.country} · {lead.category}</p>
          </div>
          <StatusBadge status={lead.outreach_status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold text-white">Contact channels</h2>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2"><EmailIcon fontSize="small" />{lead.email ?? "Email discovery pending"}</div>
            <div className="flex items-center gap-2">
              <PhoneIcon fontSize="small" />
              {lead.phone ?? "Phone pending"}
              {whatsappNumber && (
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" title="Open WhatsApp chat" className="text-emerald-300 hover:text-emerald-200">
                  <WhatsAppIcon fontSize="small" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2"><LanguageIcon fontSize="small" />{lead.website ?? "No website detected"}</div>
            {contactForms.length > 0 && (
              <div className="flex items-center gap-2">
                <ContactPageIcon fontSize="small" />
                <a className="text-sky-200 hover:text-sky-100" href={contactForms[0].value} target="_blank" rel="noreferrer">
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

      <section className="glass rounded-xl p-5">
        <h2 className="mb-3 font-semibold text-white">Notes and compliance</h2>
        <p className="text-sm leading-6 text-slate-300">{lead.notes}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Unsubscribed: {lead.unsubscribed ? "Yes" : "No"}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">Email sent: {lead.email_sent ? "Yes" : "No"}</div>
          <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">WhatsApp signal: {whatsappNumber ? "Phone shortcut available" : "No usable phone"}</div>
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
