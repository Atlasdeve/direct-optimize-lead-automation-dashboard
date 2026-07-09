import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAppNotification } from "@/lib/appNotifications";
import { getRegion } from "@/lib/regions";
import { scoreLead } from "@/lib/scoring";
import { discoverEmailsFromWebsite } from "@/lib/emailDiscovery";
import { auditLeadWebsite, type LeadIntelligenceAudit } from "@/lib/leadIntelligence";
import { auditGmbProfile, type GmbAudit } from "@/lib/gmbAudit";
import { enrichLeadWithProviders } from "@/lib/leadEnrichment";
import { hasWhatsappContactSignal } from "@/lib/whatsappIdentification";
import { sendEmailFollowUp, sendEmailOutreach } from "@/lib/providers";
import type { AutomationResult, Lead, PlaceLeadCandidate } from "@/lib/types";

type DbLead = Prisma.LeadGetPayload<Record<string, never>> & {
  contacts?: Array<{ type: string; value: string }>;
  outreachLogs?: Array<{ openCount?: number; clickCount?: number; status?: string; action?: string }>;
  callLogs?: Array<{ id: string }>;
};

export type ReviewQueueKey = "needs_review" | "approved" | "do_not_contact" | "contacted" | "replied" | "contact_forms";

export type OutreachAutomationSettings = {
  firstFollowUpDays: number;
  finalFollowUpDays: number;
  batchSize: number;
};

const outreachSettingsKey = "outreach_automation";

export async function getOutreachAutomationSettings(): Promise<OutreachAutomationSettings> {
  const defaults: OutreachAutomationSettings = {
    firstFollowUpDays: Number(process.env.FIRST_FOLLOW_UP_DAYS || 3),
    finalFollowUpDays: Number(process.env.FINAL_FOLLOW_UP_DAYS || 7),
    batchSize: Number(process.env.OUTREACH_AUTOMATION_BATCH_SIZE || 10)
  };
  const setting = await prisma.setting.findUnique({ where: { key: outreachSettingsKey } });
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? setting.value as Record<string, unknown>
    : {};
  const firstFollowUpDays = Math.max(1, Math.min(14, Number(value.firstFollowUpDays) || defaults.firstFollowUpDays));
  return {
    firstFollowUpDays,
    finalFollowUpDays: Math.max(firstFollowUpDays + 1, Math.min(30, Number(value.finalFollowUpDays) || defaults.finalFollowUpDays)),
    batchSize: Math.max(1, Math.min(50, Number(value.batchSize) || defaults.batchSize))
  };
}

export async function saveOutreachAutomationSettings(input: Partial<OutreachAutomationSettings>) {
  const current = await getOutreachAutomationSettings();
  const firstFollowUpDays = Math.max(1, Math.min(14, Number(input.firstFollowUpDays) || current.firstFollowUpDays));
  const value: OutreachAutomationSettings = {
    firstFollowUpDays,
    finalFollowUpDays: Math.max(firstFollowUpDays + 1, Math.min(30, Number(input.finalFollowUpDays) || current.finalFollowUpDays)),
    batchSize: Math.max(1, Math.min(50, Number(input.batchSize) || current.batchSize))
  };
  await prisma.setting.upsert({
    where: { key: outreachSettingsKey },
    update: { value },
    create: { key: outreachSettingsKey, value }
  });
  return value;
}

export function toLead(lead: DbLead): Lead {
  return {
    id: lead.id,
    company_name: lead.companyName,
    region: lead.region,
    country: lead.country,
    city: lead.city ?? "",
    category: lead.category ?? "",
    business_type: lead.businessType ?? "",
    website: lead.website,
    google_maps_url: lead.googleMapsUrl,
    phone: lead.phone,
    email: lead.email,
    whatsapp_available: lead.whatsappAvailable,
    whatsapp_status: lead.whatsappStatus as Lead["whatsapp_status"],
    owner_name: lead.ownerName,
    ceo_name: lead.ceoName,
    manager_name: lead.managerName,
    linkedin_url: lead.linkedinUrl,
    decision_maker_name: lead.decisionMakerName,
    decision_maker_title: lead.decisionMakerTitle,
    decision_maker_source: lead.decisionMakerSource,
    decision_maker_confidence: lead.decisionMakerConfidence,
    source_platform: lead.sourcePlatform,
    lead_score: lead.leadScore,
    outreach_status: lead.outreachStatus as Lead["outreach_status"],
    outreach_approved: lead.outreachApproved,
    outreach_approved_at: lead.outreachApprovedAt?.toISOString() ?? null,
    email_sent: lead.emailSent,
    email_opened: lead.outreachLogs?.some((log) => (log.openCount ?? 0) > 0) ?? false,
    email_clicked: lead.outreachLogs?.some((log) => (log.clickCount ?? 0) > 0) ?? false,
    voice_called: (lead.callLogs?.length ?? 0) > 0,
    whatsapp_sent: lead.whatsappSent,
    replied: lead.replied,
    last_contacted_at: lead.lastContactedAt?.toISOString() ?? null,
    next_follow_up_at: lead.nextFollowUpAt?.toISOString() ?? null,
    notes: lead.notes,
    rating: lead.rating ?? undefined,
    review_count: lead.reviewCount ?? undefined,
    missing_seo_metadata: lead.missingSeoMetadata,
    contact_forms: lead.contacts?.filter((contact) => contact.type === "contact_form").map((contact) => contact.value) ?? [],
    do_not_contact: lead.doNotContact,
    archived: lead.archived,
    consent_status: lead.consentStatus,
    unsubscribed: lead.unsubscribed,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString()
  };
}

export async function listDbLeads(region?: string) {
  const leads = await prisma.lead.findMany({
    where: { ...(region ? { region } : {}), archived: false },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      },
      outreachLogs: {
        where: { channel: "email", OR: [{ openCount: { gt: 0 } }, { clickCount: { gt: 0 } }] },
        select: { openCount: true, clickCount: true },
        take: 1
      },
      callLogs: {
        where: { status: { not: "planned" } },
        select: { id: true },
        take: 1
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });
  return leads.map(toLead);
}

export async function listReviewQueue(queue: ReviewQueueKey = "needs_review", region?: string) {
  const where: Prisma.LeadWhereInput = {
    ...(region ? { region } : {}),
    archived: false
  };

  if (queue === "needs_review") {
    Object.assign(where, {
      outreachApproved: false,
      doNotContact: false,
      unsubscribed: false,
      emailSent: false
    });
  }
  if (queue === "approved") Object.assign(where, { outreachApproved: true, emailSent: false, doNotContact: false, unsubscribed: false });
  if (queue === "do_not_contact") Object.assign(where, { OR: [{ doNotContact: true }, { unsubscribed: true }] });
  if (queue === "contacted") Object.assign(where, { OR: [{ emailSent: true }, { whatsappSent: true }] });
  if (queue === "replied") Object.assign(where, { replied: true });
  if (queue === "contact_forms") {
    Object.assign(where, {
      contacts: {
        some: { type: "contact_form" }
      }
    });
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    },
    orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
    take: 100
  });
  return leads.map(toLead);
}

export async function getDbLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    }
  });
  return lead ? toLead(lead) : null;
}

export async function deleteDbLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, companyName: true }
  });
  if (!lead) return null;

  await prisma.lead.delete({ where: { id } });
  return lead;
}

export type EditableLeadDetails = {
  companyName: string;
  city: string | null;
  category: string | null;
  businessType: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  ownerName: string | null;
  ceoName: string | null;
  managerName: string | null;
  decisionMakerName: string | null;
  decisionMakerTitle: string | null;
  linkedinUrl: string | null;
};

export async function updateDbLeadDetails(id: string, details: EditableLeadDetails) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return null;

  const changedFields = Object.entries(details)
    .filter(([key, value]) => existing[key as keyof typeof existing] !== value)
    .map(([key]) => key);
  const phoneHasWhatsapp = hasWhatsappContactSignal(details.phone);
  const decisionMakerChanged = existing.decisionMakerName !== details.decisionMakerName || existing.decisionMakerTitle !== details.decisionMakerTitle;

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...details,
      whatsappAvailable: phoneHasWhatsapp,
      whatsappStatus: phoneHasWhatsapp ? "available" : "unknown",
      decisionMakerSource: decisionMakerChanged && details.decisionMakerName ? "Manual edit" : existing.decisionMakerSource,
      decisionMakerConfidence: decisionMakerChanged && details.decisionMakerName ? 100 : existing.decisionMakerConfidence
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    }
  });

  if (details.email && details.email !== existing.email) {
    await prisma.leadContact.upsert({
      where: { id: enrichmentContactId("email", id, details.email) },
      update: { status: "manual" },
      create: { id: enrichmentContactId("email", id, details.email), leadId: id, type: "email", value: details.email, status: "manual" }
    });
  }

  if (changedFields.length > 0) {
    await prisma.outreachLog.create({
      data: {
        leadId: id,
        channel: "system",
        action: "lead_details_updated",
        status: "completed",
        message: `Lead details updated manually: ${changedFields.join(", ")}.`,
        metadata: { changedFields }
      }
    });
  }

  return toLead(updated);
}

export async function getDbLeadContacts(leadId: string) {
  return prisma.leadContact.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLatestLeadIntelligence(leadId: string) {
  const log = await prisma.outreachLog.findFirst({
    where: {
      leadId,
      action: "lead_intelligence_audit"
    },
    orderBy: { createdAt: "desc" }
  });
  return (log?.metadata as LeadIntelligenceAudit | null) ?? null;
}

export async function runLeadIntelligenceAudit(leadId: string) {
  const lead = await getDbLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const audit = await auditLeadWebsite(lead);
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "lead_intelligence_audit",
      status: audit.error ? "failed" : "completed",
      message: audit.error ? `Lead intelligence audit failed: ${audit.error}` : `Lead intelligence audit completed. ${audit.seoFlags.length} opportunity flag(s) found.`,
      metadata: audit
    }
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      missingSeoMetadata: audit.seoFlags.some((flag) => /title|meta|h1|schema/i.test(flag)),
      notes: lead.notes?.includes(audit.fitSummary) ? lead.notes : [lead.notes, audit.fitSummary].filter(Boolean).join("\n\n")
    }
  });

  return audit;
}

export async function getLatestGmbAudit(leadId: string) {
  const log = await prisma.outreachLog.findFirst({
    where: {
      leadId,
      action: "gmb_profile_audit"
    },
    orderBy: { createdAt: "desc" }
  });
  return (log?.metadata as GmbAudit | null) ?? null;
}

export async function runGmbAudit(leadId: string) {
  const lead = await getDbLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const audit = await auditGmbProfile(lead);
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "gmb_profile_audit",
      status: audit.error ? "failed" : "completed",
      message: audit.error ? `GMB audit failed: ${audit.error}` : `GMB audit completed. ${audit.gmbFlags.length} opportunity flag(s) found.`,
      metadata: audit
    }
  });
  return audit;
}

export async function listContactFormQueue(region?: string) {
  const contacts = await prisma.leadContact.findMany({
    where: {
      type: "contact_form",
      lead: { ...(region ? { region } : {}), archived: false }
    },
    include: {
      lead: true
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100
  });

  return contacts.map((contact) => ({
    id: contact.id,
    leadId: contact.leadId,
    companyName: contact.lead.companyName,
    region: contact.lead.region,
    city: contact.lead.city,
    value: contact.value,
    status: contact.status,
    updatedAt: contact.updatedAt.toISOString()
  }));
}

export async function getLeadEmailTracking(leadId: string) {
  const logs = await prisma.outreachLog.findMany({
    where: {
      leadId,
      channel: "email",
      action: "send_outreach"
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return logs.map((log) => ({
    id: log.id,
    status: log.status,
    providerId: log.providerId,
    sentAt: log.createdAt.toISOString(),
    openedAt: log.openedAt?.toISOString() ?? null,
    lastOpenedAt: log.lastOpenedAt?.toISOString() ?? null,
    openCount: log.openCount,
    clickedAt: log.clickedAt?.toISOString() ?? null,
    lastClickedAt: log.lastClickedAt?.toISOString() ?? null,
    clickCount: log.clickCount
  }));
}

export async function markContactFormAction(contactId: string, action: "opened" | "submitted" | "skipped", message?: string) {
  const statusByAction = {
    opened: "opened",
    submitted: "submitted",
    skipped: "skipped"
  } as const;

  const contact = await prisma.leadContact.update({
    where: { id: contactId },
    data: { status: statusByAction[action] },
    include: { lead: true }
  });

  await prisma.outreachLog.create({
    data: {
      leadId: contact.leadId,
      channel: "contact_form",
      action: `contact_form_${action}`,
      status: action === "submitted" ? "completed" : "logged",
      message: message || `Contact form ${action}.`,
      metadata: {
        contactId: contact.id,
        url: contact.value
      }
    }
  });

  if (action === "submitted") {
    const now = new Date();
    await prisma.lead.update({
      where: { id: contact.leadId },
      data: {
        outreachStatus: "Contacted",
        lastContactedAt: now,
        nextFollowUpAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      }
    });
  }

  return {
    id: contact.id,
    leadId: contact.leadId,
    companyName: contact.lead.companyName,
    value: contact.value,
    status: contact.status
  };
}

export async function archiveDuplicateLead(leadId: string) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      archived: true,
      outreachApproved: false,
      outreachStatus: "Failed"
    }
  });
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "archive_duplicate",
      status: "completed",
      message: "Lead archived from duplicate review."
    }
  });
  return toLead(lead);
}

export async function getLeadChecklist(leadId: string) {
  return prisma.leadChecklist.upsert({
    where: { leadId },
    update: {},
    create: { leadId }
  });
}

export async function updateLeadChecklist(leadId: string, data: {
  websiteChecked?: boolean;
  gbpChecked?: boolean;
  reviewsChecked?: boolean;
  contactFormChecked?: boolean;
  decisionMakerSearched?: boolean;
  notes?: string;
}) {
  const checklist = await prisma.leadChecklist.upsert({
    where: { leadId },
    update: data,
    create: { leadId, ...data }
  });
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "research_checklist_updated",
      status: "completed",
      message: "Lead research checklist updated.",
      metadata: data
    }
  });
  return checklist;
}

export async function listOpportunities() {
  return prisma.opportunity.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: { lead: { select: { companyName: true, region: true, city: true } } }
  });
}

export async function createOpportunity(input: {
  leadId: string;
  title?: string;
  stage?: string;
  value?: number;
  notes?: string;
  nextActionAt?: string | null;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");
  const opportunity = await prisma.opportunity.create({
    data: {
      leadId: input.leadId,
      title: input.title || `${lead.companyName} opportunity`,
      stage: input.stage || "New",
      value: input.value ?? 0,
      notes: input.notes,
      nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null
    }
  });
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { outreachStatus: "Meeting Booked" }
  });
  return opportunity;
}

export async function listDbNotifications(user: { id: string; role: string }) {
  return prisma.notification.findMany({
    where: user.role === "admin" ? { recipientUserId: null } : { recipientUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}

export async function listDbReplies() {
  return prisma.inboxReply.findMany({ orderBy: { receivedAt: "desc" } });
}

export async function listDbAiDrafts() {
  return prisma.aiReplyDraft.findMany({
    orderBy: { createdAt: "desc" },
    include: { lead: { select: { companyName: true } } }
  });
}

async function ensureDbRegion(regionName: string) {
  const region = getRegion(regionName);
  await prisma.region.upsert({
    where: { name: region.name },
    update: {
      country: region.country,
      timezone: region.timezone,
      enabled: true
    },
    create: {
      name: region.name,
      country: region.country,
      timezone: region.timezone,
      enabled: true
    }
  });
  return region;
}

export async function createDbDemoLeads(regionName: string) {
  const region = await ensureDbRegion(regionName);
  const city = region.name === "USA" ? "Austin" : region.name === "Canada" ? "Vancouver" : region.name === "UK" ? "Manchester" : region.name === "UAE" ? "Abu Dhabi" : "Doha";
  const base = {
    id: `lead_${region.name.toLowerCase()}_${Date.now()}`,
    companyName: `${region.name} Growth Clinic`,
    region: region.name,
    country: region.country,
    city,
    category: "Local service business",
    businessType: "SMB",
    website: null,
    googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${region.name} Growth Clinic`)}`,
    phone: "+1555010101",
    email: `hello+${region.name.toLowerCase()}@example.com`,
    whatsappAvailable: false,
    whatsappStatus: "unknown",
    managerName: "Operations Manager",
    sourcePlatform: process.env.GOOGLE_PLACES_API_KEY ? "google_places" : "demo_google_places",
    outreachStatus: "New",
    notes: "Generated by safe demo automation. Configure official provider keys for live lead discovery.",
    rating: 3.5,
    reviewCount: 4,
    missingSeoMetadata: false,
    consentStatus: "legitimate_interest",
    unsubscribed: false
  };
  const leadScore = scoreLead({
    company_name: base.companyName,
    region: base.region,
    country: base.country,
    city: base.city,
    category: base.category,
    business_type: base.businessType,
    website: base.website,
    phone: base.phone,
    email: base.email,
    whatsapp_available: base.whatsappAvailable,
    whatsapp_status: "unknown",
    source_platform: base.sourcePlatform,
    lead_score: 0,
    outreach_status: "New",
    email_sent: false,
    whatsapp_sent: false,
    replied: false,
    consent_status: base.consentStatus,
    unsubscribed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rating: base.rating,
    review_count: base.reviewCount,
    missing_seo_metadata: base.missingSeoMetadata
  });
  const lead = await prisma.lead.create({
    data: {
      ...base,
      leadScore
    }
  });
  await prisma.outreachLog.create({
    data: {
      leadId: lead.id,
      channel: "system",
      action: "lead_created",
      status: "completed",
      message: "Lead stored from compliant demo Google Places flow."
    }
  });
  return [toLead(lead)];
}

export async function createDbLeadsFromPlaces(regionName: string, candidates: PlaceLeadCandidate[]) {
  const created: Lead[] = [];
  const region = await ensureDbRegion(regionName);

  for (const candidate of candidates) {
    const duplicate = await prisma.lead.findFirst({
      where: {
        OR: [
          candidate.googleMapsUrl ? { googleMapsUrl: candidate.googleMapsUrl } : undefined,
          {
            companyName: candidate.companyName,
            region: region.name
          }
        ].filter(Boolean) as Prisma.LeadWhereInput[]
      }
    });

    if (duplicate) continue;

    const leadScore = candidate.qualificationScore ?? scoreLead({
      company_name: candidate.companyName,
      region: candidate.region,
      country: candidate.country,
      city: candidate.city,
      category: candidate.category,
      business_type: candidate.businessType,
      website: candidate.website,
      phone: candidate.phone,
      email: null,
      whatsapp_available: hasWhatsappContactSignal(candidate.phone),
      whatsapp_status: hasWhatsappContactSignal(candidate.phone) ? "available" : "unknown",
      source_platform: "google_places",
      lead_score: 0,
      outreach_status: "New",
      email_sent: false,
      whatsapp_sent: false,
      replied: false,
      consent_status: "legitimate_interest",
      unsubscribed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rating: candidate.rating ?? undefined,
      review_count: candidate.reviewCount ?? undefined,
      missing_seo_metadata: candidate.missingSeoMetadata ?? false
    });

    const lead = await prisma.lead.create({
      data: {
        companyName: candidate.companyName,
        region: region.name,
        country: candidate.country,
        city: candidate.city,
        category: candidate.category,
        businessType: candidate.businessType,
        website: candidate.website,
        googleMapsUrl: candidate.googleMapsUrl,
        phone: candidate.phone,
        email: null,
        whatsappAvailable: hasWhatsappContactSignal(candidate.phone),
        whatsappStatus: hasWhatsappContactSignal(candidate.phone) ? "available" : "unknown",
        sourcePlatform: `google_places:${candidate.placeId}`,
        leadScore,
        outreachStatus: "New",
        notes: [
          `Imported from Google Places Text Search. Query: ${candidate.sourceQuery}`,
          candidate.qualificationReasons?.length ? `Qualified opportunity: ${candidate.qualificationReasons.join("; ")}.` : null,
          candidate.websiteAuditFlags?.length ? `Website audit flags: ${candidate.websiteAuditFlags.join("; ")}.` : null
        ].filter(Boolean).join("\n"),
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
        missingSeoMetadata: candidate.missingSeoMetadata ?? false,
        consentStatus: "legitimate_interest"
      }
    });

    await prisma.outreachLog.create({
      data: {
        leadId: lead.id,
        channel: "system",
        action: "lead_created",
        status: "completed",
        providerId: candidate.placeId,
        message: "Lead stored from Google Places API."
      }
    });

    created.push(toLead(lead));
  }

  return created;
}

export async function markDbOutreach(leadId: string, channel: "email" | "whatsapp") {
  const now = new Date();
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      outreachStatus: "Contacted",
      emailSent: channel === "email" ? true : undefined,
      whatsappSent: channel === "whatsapp" ? true : undefined,
      lastContactedAt: now,
      nextFollowUpAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    }
  });
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel,
      action: "send_outreach",
      status: "completed",
      message: `${channel} outreach processed by automation.`
    }
  });
}

export async function sendTrackedEmailOutreach(lead: Lead) {
  const pendingLog = await prisma.outreachLog.create({
    data: {
      leadId: lead.id,
      channel: "email",
      action: "send_outreach",
      status: "pending",
      message: "Email outreach queued for SMTP delivery.",
      metadata: {
        to: lead.email,
        trackingEnabled: true
      }
    }
  });

  const result = await sendEmailOutreach(lead, { trackingLogId: pendingLog.id });

  if (result.sent) {
    const now = new Date();
    const schedule = await getOutreachAutomationSettings();
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        outreachStatus: "Contacted",
        emailSent: true,
        lastContactedAt: now,
        nextFollowUpAt: new Date(now.getTime() + schedule.firstFollowUpDays * 24 * 60 * 60 * 1000)
      }
    });
    await prisma.outreachLog.update({
      where: { id: pendingLog.id },
      data: {
        status: "completed",
        providerId: result.providerId,
        message: "Email outreach sent with open tracking enabled.",
        metadata: {
          to: lead.email,
          subject: result.message?.subject ?? null,
          auditAttachments: result.auditAttachments ?? [],
          gmbAuditStatus: result.gmbAudit?.error ? "failed" : "completed",
          websiteAuditStatus: result.websiteAudit?.error ? "failed" : "completed",
          trackingEnabled: true,
          providerStatus: result.status
        }
      }
    });
    return { ...result, logId: pendingLog.id };
  }

  await prisma.outreachLog.update({
    where: { id: pendingLog.id },
    data: {
      status: result.status,
      message: result.reason ?? "Email was not sent.",
      metadata: {
        to: lead.email,
        subject: result.message?.subject ?? null,
        trackingEnabled: false,
        providerStatus: result.status,
        reason: result.reason
      }
    }
  });

  return { ...result, logId: pendingLog.id };
}

export async function recordEmailOpen(logId: string, requestMeta: { userAgent?: string | null; ip?: string | null }) {
  const existing = await prisma.outreachLog.findUnique({ where: { id: logId } });
  const now = new Date();
  if (existing?.channel === "email") {
    await prisma.outreachLog.update({
      where: { id: logId },
      data: {
        openedAt: existing.openedAt ?? now,
        lastOpenedAt: now,
        openCount: { increment: 1 },
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          lastOpen: {
            at: now.toISOString(),
            userAgent: requestMeta.userAgent ?? null,
            ip: requestMeta.ip ?? null
          }
        }
      }
    });
    return { recorded: true, source: "outreach" };
  }

  const composeLog = await prisma.composeEmailLog.findUnique({ where: { id: logId } });
  if (!composeLog) return { recorded: false };
  await prisma.composeEmailLog.update({
    where: { id: logId },
    data: {
      openedAt: composeLog.openedAt ?? now,
      lastOpenedAt: now,
      openCount: { increment: 1 },
      metadata: {
        ...((composeLog.metadata as Record<string, unknown> | null) ?? {}),
        lastOpen: {
          at: now.toISOString(),
          userAgent: requestMeta.userAgent ?? null,
          ip: requestMeta.ip ?? null
        }
      }
    }
  });
  return { recorded: true, source: "compose" };
}

export async function recordEmailClick(logId: string, url: string, requestMeta: { userAgent?: string | null; ip?: string | null }) {
  const existing = await prisma.outreachLog.findUnique({ where: { id: logId } });
  const now = new Date();
  if (existing?.channel === "email") {
    await prisma.outreachLog.update({
      where: { id: logId },
      data: {
        clickedAt: existing.clickedAt ?? now,
        lastClickedAt: now,
        clickCount: { increment: 1 },
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          lastClick: {
            at: now.toISOString(),
            url,
            userAgent: requestMeta.userAgent ?? null,
            ip: requestMeta.ip ?? null
          }
        }
      }
    });
    return { recorded: true, source: "outreach" };
  }

  const composeLog = await prisma.composeEmailLog.findUnique({ where: { id: logId } });
  if (!composeLog) return { recorded: false };
  await prisma.composeEmailLog.update({
    where: { id: logId },
    data: {
      clickedAt: composeLog.clickedAt ?? now,
      lastClickedAt: now,
      clickCount: { increment: 1 },
      metadata: {
        ...((composeLog.metadata as Record<string, unknown> | null) ?? {}),
        lastClick: {
          at: now.toISOString(),
          url,
          userAgent: requestMeta.userAgent ?? null,
          ip: requestMeta.ip ?? null
        }
      }
    }
  });
  return { recorded: true, source: "compose" };
}

export async function createComposeEmailLog(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  return prisma.composeEmailLog.create({
    data: {
      toEmail: input.to,
      subject: input.subject,
      heading: input.heading,
      status: "pending",
      message: "Manual compose email queued for SMTP delivery.",
      metadata: {
        body: input.body,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        trackingEnabled: true
      }
    }
  });
}

export async function updateComposeEmailLogResult(
  logId: string,
  result: { sent: boolean; status: string; provider?: string; providerId?: string; reason?: string; trackingEnabled?: boolean; accepted?: string[]; rejected?: string[]; pending?: string[]; response?: string }
) {
  return prisma.composeEmailLog.update({
    where: { id: logId },
    data: {
      status: result.status,
      providerId: result.providerId,
      message: result.sent
        ? result.trackingEnabled
          ? "Manual compose email sent with open tracking enabled."
          : "Manual compose email sent. Tracking is disabled until APP_PUBLIC_URL points to a public HTTPS app URL."
        : result.reason ?? "Manual compose email was not sent.",
      metadata: {
        providerStatus: result.status,
        provider: result.provider ?? null,
        reason: result.reason ?? null,
        trackingEnabled: Boolean(result.sent && result.trackingEnabled),
        accepted: result.accepted ?? [],
        rejected: result.rejected ?? [],
        pending: result.pending ?? [],
        response: result.response ?? null
      }
    }
  });
}

export async function listComposeEmailLogs() {
  const logs = await prisma.composeEmailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12
  });
  return logs.map((log) => ({
    id: log.id,
    toEmail: log.toEmail,
    subject: log.subject,
    status: log.status,
    openCount: log.openCount,
    clickCount: log.clickCount,
    lastOpenedAt: log.lastOpenedAt?.toISOString() ?? null,
    lastClickedAt: log.lastClickedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString()
  }));
}

export async function approveLeadForOutreach(leadId: string) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      outreachApproved: true,
      outreachApprovedAt: new Date(),
      doNotContact: false,
      unsubscribed: false,
      outreachStatus: "Approved"
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    }
  });
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "approve_outreach",
      status: "completed",
      message: "Lead approved for reviewed email outreach."
    }
  });
  return toLead(lead);
}

export async function blockLeadFromOutreach(leadId: string) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      outreachApproved: false,
      outreachApprovedAt: null,
      doNotContact: true,
      unsubscribed: true,
      outreachStatus: "Failed"
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    }
  });
  await prisma.outreachLog.create({
    data: {
      leadId,
      channel: "system",
      action: "do_not_contact",
      status: "completed",
      message: "Lead marked as do-not-contact."
    }
  });
  return toLead(lead);
}

export async function discoverEmailForLead(lead: Lead) {
  if (!lead.website || lead.email || lead.unsubscribed) {
    return { updated: false, found: 0, failed: false, reason: "Lead has no website, already has email, or is unsubscribed" };
  }

  const result = await discoverEmailsFromWebsite(lead.website);
  const primaryEmail = result.emails[0];

  if (!primaryEmail) {
    await prisma.leadContact.deleteMany({
      where: {
        leadId: lead.id,
        type: "contact_form"
      }
    });

    for (const formUrl of result.contactForms) {
      await prisma.leadContact.upsert({
        where: {
          id: `contact_form_${lead.id}_${Buffer.from(formUrl).toString("base64url").slice(0, 42)}`
        },
        update: {
          status: "public_website"
        },
        create: {
          id: `contact_form_${lead.id}_${Buffer.from(formUrl).toString("base64url").slice(0, 42)}`,
          leadId: lead.id,
          type: "contact_form",
          value: formUrl,
          status: "public_website"
        }
      });
    }

    await prisma.outreachLog.create({
      data: {
        leadId: lead.id,
        channel: "system",
        action: "email_discovery",
        status: result.error ? "failed" : "completed",
        message: result.error ?? `No public email found after scanning ${result.pagesScanned} page(s).`,
        metadata: {
          website: lead.website,
          pagesScanned: result.pagesScanned,
          sourceUrls: result.sourceUrls,
          contactForms: result.contactForms,
          contactPages: result.contactPages
        }
      }
    });
    return {
      updated: false,
      found: 0,
      formsFound: result.contactForms.length,
      failed: Boolean(result.error),
      reason: result.error ?? (result.contactForms.length ? "No public email found; contact form found" : "No public email found")
    };
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      email: primaryEmail,
      leadScore: Math.min(100, lead.lead_score + 15)
    }
  });

  await prisma.leadContact.upsert({
    where: {
      id: `email_${lead.id}_${primaryEmail}`
    },
    update: {
      status: "public_website"
    },
    create: {
      id: `email_${lead.id}_${primaryEmail}`,
      leadId: lead.id,
      type: "email",
      value: primaryEmail,
      status: "public_website"
    }
  });

  await prisma.outreachLog.create({
    data: {
      leadId: lead.id,
      channel: "system",
      action: "email_discovery",
      status: "completed",
      message: `Found ${result.emails.length} public email(s); primary saved as ${primaryEmail}.`,
      metadata: {
        website: lead.website,
        pagesScanned: result.pagesScanned,
        emails: result.emails,
        sourceUrls: result.sourceUrls,
        contactForms: result.contactForms,
        contactPages: result.contactPages
      }
    }
  });

  return { updated: true, found: result.emails.length, formsFound: result.contactForms.length, failed: false, email: primaryEmail };
}

export async function discoverEmailsForLeads({ region, limit = 10 }: { region?: string; limit?: number }) {
  const rows = await prisma.lead.findMany({
    where: {
      ...(region ? { region } : {}),
      website: { not: null },
      email: null,
      unsubscribed: false
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 50))
  });

  let updated = 0;
  let found = 0;
  let formsFound = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await discoverEmailForLead(toLead(row));
    if (result.updated) updated += 1;
    found += result.found;
    formsFound += result.formsFound ?? 0;
    if (result.failed) failed += 1;
  }

  return { scanned: rows.length, updated, found, formsFound, failed };
}

function enrichmentContactId(type: string, leadId: string, value: string) {
  return `${type}_${leadId}_${Buffer.from(value).toString("base64url").slice(0, 42)}`;
}

export async function enrichLeadForDetails(lead: Lead) {
  const enrichment = await enrichLeadWithProviders(lead);
  const place = enrichment.placeDetails;
  const hunterEmail = enrichment.hunter.emails
    .filter((email) => email.value)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]?.value;
  const decisionMaker = enrichment.hunter.decisionMaker;
  const nextWebsite = lead.website ?? place.website ?? null;
  const nextPhone = lead.phone ?? place.phone ?? null;
  const nextEmail = lead.email ?? hunterEmail ?? null;
  const nextRating = lead.rating ?? place.rating ?? undefined;
  const nextReviewCount = lead.review_count ?? place.reviewCount ?? undefined;
  const missingSeoMetadata = Boolean(
    lead.missing_seo_metadata ||
    (enrichment.builtWith.configured && !enrichment.builtWith.hasAnalytics && !enrichment.builtWith.hasSeo)
  );

  const leadForScore: Partial<Lead> = {
    ...lead,
    website: nextWebsite,
    phone: nextPhone,
    email: nextEmail,
    rating: nextRating,
    review_count: nextReviewCount,
    missing_seo_metadata: missingSeoMetadata
  };

  const notes = [
    lead.notes,
    `Enriched ${new Date().toISOString()}: Google Places details ${place.error ? "skipped" : "checked"}, Hunter ${enrichment.hunter.configured ? "checked" : "not configured"}, BuiltWith ${enrichment.builtWith.configured ? "checked" : "not configured"}.`
  ].filter(Boolean).join("\n");

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      website: nextWebsite,
      googleMapsUrl: lead.google_maps_url ?? place.googleMapsUrl ?? null,
      phone: nextPhone,
      email: nextEmail,
      ownerName: decisionMaker?.roleGroup === "owner" ? decisionMaker.name : lead.owner_name,
      ceoName: decisionMaker?.roleGroup === "executive" ? decisionMaker.name : lead.ceo_name,
      managerName: decisionMaker?.roleGroup === "manager" ? decisionMaker.name : lead.manager_name,
      linkedinUrl: decisionMaker?.linkedinUrl ?? lead.linkedin_url,
      decisionMakerName: decisionMaker?.name ?? lead.decision_maker_name,
      decisionMakerTitle: decisionMaker?.title ?? lead.decision_maker_title,
      decisionMakerSource: decisionMaker ? "Hunter Domain Search" : lead.decision_maker_source,
      decisionMakerConfidence: decisionMaker?.confidence ?? lead.decision_maker_confidence,
      whatsappAvailable: hasWhatsappContactSignal(nextPhone),
      whatsappStatus: hasWhatsappContactSignal(nextPhone) ? "available" : lead.whatsapp_status,
      rating: nextRating,
      reviewCount: nextReviewCount,
      missingSeoMetadata,
      leadScore: scoreLead(leadForScore),
      notes
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    }
  });

  if (nextEmail) {
    await prisma.leadContact.upsert({
      where: { id: enrichmentContactId("email", lead.id, nextEmail) },
      update: { status: lead.email ? "existing" : "enriched" },
      create: {
        id: enrichmentContactId("email", lead.id, nextEmail),
        leadId: lead.id,
        type: "email",
        value: nextEmail,
        status: lead.email ? "existing" : "enriched"
      }
    });
  }

  for (const email of enrichment.hunter.emails.slice(0, 5)) {
    if (!email.value) continue;
    await prisma.leadContact.upsert({
      where: { id: enrichmentContactId("email", lead.id, email.value) },
      update: { status: `hunter_${email.confidence ?? "unknown"}` },
      create: {
        id: enrichmentContactId("email", lead.id, email.value),
        leadId: lead.id,
        type: "email",
        value: email.value,
        status: `hunter_${email.confidence ?? "unknown"}`
      }
    });
  }

  await prisma.outreachLog.create({
    data: {
      leadId: lead.id,
      channel: "system",
      action: "lead_enrichment",
      status: place.error && enrichment.hunter.error && enrichment.builtWith.error ? "failed" : "completed",
      message: [
        place.error ? `Google: ${place.error}` : "Google Places details checked",
        enrichment.hunter.error ? `Hunter: ${enrichment.hunter.error}` : `Hunter contacts: ${enrichment.hunter.emails.length}; decision maker: ${decisionMaker?.name ?? "not found"}`,
        enrichment.builtWith.error ? `BuiltWith: ${enrichment.builtWith.error}` : `BuiltWith tech: ${enrichment.builtWith.technologies.length}`
      ].join(" | "),
      metadata: {
        googlePlaces: {
          configured: place.configured,
          placeId: place.placeId,
          businessStatus: place.businessStatus,
          categories: place.categories.slice(0, 10),
          error: place.error
        },
        hunter: {
          configured: enrichment.hunter.configured,
          domain: enrichment.hunter.domain,
          organization: enrichment.hunter.organization,
          emails: enrichment.hunter.emails.slice(0, 5),
          decisionMaker,
          error: enrichment.hunter.error
        },
        builtWith: {
          configured: enrichment.builtWith.configured,
          domain: enrichment.builtWith.domain,
          technologies: enrichment.builtWith.technologies.slice(0, 12),
          categories: enrichment.builtWith.categories.slice(0, 12),
          groups: enrichment.builtWith.groups.slice(0, 12),
          hasAnalytics: enrichment.builtWith.hasAnalytics,
          hasAds: enrichment.builtWith.hasAds,
          hasCms: enrichment.builtWith.hasCms,
          hasSeo: enrichment.builtWith.hasSeo,
          error: enrichment.builtWith.error
        }
      }
    }
  });

  return {
    lead: toLead(updated),
    updated: true,
    emailAdded: !lead.email && Boolean(nextEmail),
    websiteAdded: !lead.website && Boolean(nextWebsite),
    phoneAdded: !lead.phone && Boolean(nextPhone),
    decisionMakerFound: Boolean(decisionMaker),
    providerErrors: [place.error, enrichment.hunter.configured ? enrichment.hunter.error : null, enrichment.builtWith.configured ? enrichment.builtWith.error : null].filter(Boolean) as string[]
  };
}

export async function enrichLeadsForDetails({ region, limit = 10 }: { region?: string; limit?: number }) {
  const rows = await prisma.lead.findMany({
    where: {
      ...(region ? { region } : {}),
      archived: false,
      unsubscribed: false
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    },
    orderBy: [{ updatedAt: "asc" }],
    take: Math.max(1, Math.min(limit, 50))
  });

  let emailAdded = 0;
  let websiteAdded = 0;
  let phoneAdded = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const row of rows) {
    const result = await enrichLeadForDetails(toLead(row));
    if (result.emailAdded) emailAdded += 1;
    if (result.websiteAdded) websiteAdded += 1;
    if (result.phoneAdded) phoneAdded += 1;
    if (result.providerErrors.length) failed += 1;
    logs.push(`${result.lead.company_name}: score ${result.lead.lead_score}, email=${result.lead.email ? "yes" : "no"}, website=${result.lead.website ? "yes" : "no"}, provider warnings=${result.providerErrors.length}.`);
  }

  return {
    scanned: rows.length,
    updated: rows.length,
    emailAdded,
    websiteAdded,
    phoneAdded,
    failed,
    providers: {
      googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      builtWith: Boolean(process.env.BUILTWITH_API_KEY)
    },
    logs
  };
}

export async function outreachReadiness(region?: string) {
  const where = {
    ...(region ? { region } : {}),
    email: { not: null },
    emailSent: false,
    unsubscribed: false,
    doNotContact: false
  };
  const [ready, approved] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, outreachApproved: true } })
  ]);
  return {
    ready,
    approved,
    liveSendingEnabled: process.env.OUTREACH_EMAIL_SEND_ENABLED === "true",
    dailyEmailCap: Number(process.env.DAILY_EMAIL_CAP || 150)
  };
}

function sendingWindowStatus(region?: string) {
  const businessHoursOnly = process.env.OUTREACH_EMAIL_BUSINESS_HOURS_ONLY !== "false";
  const timezone = region ? getRegion(region).timezone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const inBusinessWindow = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) && hour >= 9 && hour < 17;
  return {
    businessHoursOnly,
    inBusinessWindow,
    allowed: !businessHoursOnly || inBusinessWindow,
    timezone
  };
}

async function remainingDailyEmailAllowance() {
  const dailyCap = Number(process.env.DAILY_EMAIL_CAP || 150);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sentToday = await prisma.outreachLog.count({
    where: {
      channel: "email",
      action: { in: ["send_outreach", "send_follow_up_1", "send_follow_up_2"] },
      status: "completed",
      createdAt: { gte: startOfDay }
    }
  });
  return Math.max(0, dailyCap - sentToday);
}

export async function sendApprovedEmails({ region, limit = 25 }: { region?: string; limit?: number }) {
  const window = sendingWindowStatus(region);
  const remaining = await remainingDailyEmailAllowance();
  const take = Math.max(0, Math.min(limit, remaining));

  if (!window.allowed) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      remaining,
      liveSendingEnabled: process.env.OUTREACH_EMAIL_SEND_ENABLED === "true",
      logs: [`Business-hours safety is enabled; sending is paused outside Monday-Friday 9:00-17:00 in ${window.timezone}.`]
    };
  }

  if (take === 0) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      remaining,
      liveSendingEnabled: process.env.OUTREACH_EMAIL_SEND_ENABLED === "true",
      logs: ["Daily email cap reached or send limit is zero."]
    };
  }

  const rows = await prisma.lead.findMany({
    where: {
      ...(region ? { region } : {}),
      outreachApproved: true,
      email: { not: null },
      emailSent: false,
      unsubscribed: false,
      doNotContact: false
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      }
    },
    orderBy: [{ outreachApprovedAt: "asc" }, { createdAt: "asc" }],
    take
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const row of rows) {
    const lead = toLead(row);
    const result = await sendTrackedEmailOutreach(lead);
    if (result.sent) {
      sent += 1;
      logs.push(`Sent email to ${lead.company_name}.`);
      continue;
    }

    if (result.status === "failed") failed += 1;
    else skipped += 1;

    logs.push(`${lead.company_name}: ${result.reason ?? result.status}.`);
  }

  return {
    attempted: rows.length,
    sent,
    skipped,
    failed,
    remaining: Math.max(0, remaining - sent),
    liveSendingEnabled: process.env.OUTREACH_EMAIL_SEND_ENABLED === "true",
    logs
  };
}

export async function processDueFollowUps({ region, limit = 25 }: { region?: string; limit?: number }) {
  const window = sendingWindowStatus(region);
  const remaining = await remainingDailyEmailAllowance();
  const take = Math.max(0, Math.min(limit, remaining));
  if (!window.allowed) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, remaining, logs: [`Follow-ups are paused outside Monday-Friday 9:00-17:00 in ${window.timezone}.`] };
  }
  if (take === 0) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, remaining, logs: ["Daily email cap reached or follow-up limit is zero."] };
  }

  const rows = await prisma.lead.findMany({
    where: {
      ...(region ? { region } : {}),
      outreachApproved: true,
      email: { not: null },
      emailSent: true,
      replied: false,
      unsubscribed: false,
      doNotContact: false,
      nextFollowUpAt: { lte: new Date() }
    },
    include: {
      contacts: {
        where: { type: "contact_form" },
        select: { type: true, value: true }
      },
      outreachLogs: {
        where: { action: { in: ["send_follow_up_1", "send_follow_up_2"] }, status: { in: ["pending", "completed"] } },
        select: { action: true, status: true },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { nextFollowUpAt: "asc" },
    take
  });

  const schedule = await getOutreachAutomationSettings();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const row of rows) {
    const completed = row.outreachLogs.filter((log) => log.status === "completed");
    const hasPending = row.outreachLogs.some((log) => log.status === "pending");
    if (hasPending) {
      skipped += 1;
      logs.push(`${row.companyName}: a follow-up delivery is already pending.`);
      continue;
    }
    if (completed.length >= 2) {
      await prisma.lead.update({ where: { id: row.id }, data: { nextFollowUpAt: null } });
      skipped += 1;
      continue;
    }

    const stage = (completed.length + 1) as 1 | 2;
    const action = `send_follow_up_${stage}`;
    const pendingLog = await prisma.outreachLog.create({
      data: {
        leadId: row.id,
        channel: "email",
        action,
        status: "pending",
        message: `Follow-up ${stage} queued for delivery.`,
        metadata: { to: row.email, stage, trackingEnabled: true }
      }
    });
    const result = await sendEmailFollowUp(toLead(row), stage, { trackingLogId: pendingLog.id });
    if (result.sent) {
      const now = new Date();
      const gapDays = Math.max(1, schedule.finalFollowUpDays - schedule.firstFollowUpDays);
      await prisma.lead.update({
        where: { id: row.id },
        data: {
          outreachStatus: "Follow-up",
          lastContactedAt: now,
          nextFollowUpAt: stage === 1 ? new Date(now.getTime() + gapDays * 24 * 60 * 60 * 1000) : null
        }
      });
      await prisma.outreachLog.update({
        where: { id: pendingLog.id },
        data: {
          status: "completed",
          providerId: result.providerId,
          message: `Follow-up ${stage} sent with open tracking enabled.`,
          metadata: { to: row.email, stage, subject: result.message?.subject ?? null, trackingEnabled: true, providerStatus: result.status }
        }
      });
      sent += 1;
      logs.push(`Sent follow-up ${stage} to ${row.companyName}.`);
    } else {
      await prisma.outreachLog.update({
        where: { id: pendingLog.id },
        data: { status: result.status, message: result.reason ?? `Follow-up ${stage} was not sent.` }
      });
      if (result.status === "failed") failed += 1;
      else skipped += 1;
      logs.push(`${row.companyName}: ${result.reason ?? result.status}.`);
    }
  }

  return { attempted: rows.length, sent, skipped, failed, remaining: Math.max(0, remaining - sent), logs };
}

export async function runOutreachAutomationCycle(region: string) {
  const settings = await getOutreachAutomationSettings();
  const initial = await sendApprovedEmails({ region, limit: settings.batchSize });
  const followUps = await processDueFollowUps({ region, limit: Math.max(0, settings.batchSize - initial.sent) });
  const sent = initial.sent + followUps.sent;
  const failed = initial.failed + followUps.failed;
  if (sent > 0 || failed > 0) {
    await createAppNotification({
      type: failed > 0 ? "failure" : "automation",
      title: failed > 0 ? "Outreach automation needs attention" : "Outreach automation completed",
      message: `${region}: ${initial.sent} initial email(s), ${followUps.sent} follow-up(s), ${failed} failure(s).`,
      actionUrl: "/automation"
    });
  }
  return { region, initial, followUps, sent, failed };
}

export async function duplicateLeadSignals(region?: string) {
  const leads = await prisma.lead.findMany({
    where: region ? { region } : undefined,
    select: {
      id: true,
      companyName: true,
      region: true,
      city: true,
      website: true,
      phone: true,
      email: true,
      googleMapsUrl: true
    }
  });

  const buckets = new Map<string, typeof leads>();
  for (const lead of leads) {
    const keys = [
      lead.email ? `email:${lead.email.toLowerCase()}` : null,
      lead.phone ? `phone:${lead.phone.replace(/\D/g, "")}` : null,
      lead.website ? `website:${lead.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase()}` : null,
      lead.googleMapsUrl ? `maps:${lead.googleMapsUrl}` : null,
      `name:${lead.companyName.toLowerCase()}|${lead.city?.toLowerCase() ?? ""}|${lead.region.toLowerCase()}`
    ].filter(Boolean) as string[];

    for (const key of keys) {
      buckets.set(key, [...(buckets.get(key) ?? []), lead]);
    }
  }

  return [...buckets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      count: rows.length,
      leads: rows.map((lead) => ({ id: lead.id, companyName: lead.companyName, region: lead.region, city: lead.city }))
    }))
    .slice(0, 50);
}

export async function completeDbAutomation(result: AutomationResult) {
  await prisma.automationRun.create({
    data: {
      region: result.region,
      status: result.status,
      completedAt: new Date(),
      leadsFetched: result.leadsFetched,
      emailsSent: result.emailsSent,
      whatsappSent: result.whatsappSent,
      failedCount: result.failedCount,
      log: result.logs
    }
  });
  await createAppNotification({
    type: result.status === "completed" ? "automation" : "failure",
    title: result.status === "completed" ? "Automation completed" : "Automation failed",
    message: [
      `${result.region}: ${result.leadsFetched} leads, ${result.emailsSent} emails.`,
      result.status === "failed" ? result.logs.at(-1) : null
    ].filter(Boolean).join(" ")
  });
}

export async function dbAnalytics() {
  const leads = await listDbLeads();
  const today = new Date();
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const dayLeads = leads.filter((lead) => lead.created_at?.slice(0, 10) === key);
    return {
      day: date.toLocaleDateString("en", { weekday: "short" }),
      leads: dayLeads.length,
      emails: dayLeads.filter((lead) => lead.email_sent).length,
      whatsapp: dayLeads.filter((lead) => lead.whatsapp_sent).length,
      replies: dayLeads.filter((lead) => lead.replied).length
    };
  });
  const regions = ["Canada", "USA", "UK", "UAE", "Qatar"].map((region) => {
    const regionLeads = leads.filter((lead) => lead.region === region);
    return {
      region,
      leads: regionLeads.length,
      contacted: regionLeads.filter((lead) => lead.email_sent || lead.whatsapp_sent).length,
      replies: regionLeads.filter((lead) => lead.replied).length
    };
  });

  return {
    daily,
    regions,
    funnel: [
      { name: "New Lead", value: leads.length },
      { name: "Contacted", value: leads.filter((lead) => lead.email_sent || lead.whatsapp_sent).length },
      { name: "Replied", value: leads.filter((lead) => lead.replied).length },
      { name: "Meeting Booked", value: leads.filter((lead) => lead.outreach_status === "Meeting Booked").length },
      { name: "Client", value: leads.filter((lead) => lead.outreach_status === "Closed").length }
    ],
    scoreTiers: [
      { name: "Hot", value: leads.filter((lead) => lead.lead_score >= 75).length },
      { name: "Warm", value: leads.filter((lead) => lead.lead_score >= 45 && lead.lead_score < 75).length },
      { name: "Cold", value: leads.filter((lead) => lead.lead_score < 45).length }
    ],
    remaining: {
      emails: 450,
      whatsapp: 120,
      failed: leads.filter((lead) => lead.outreach_status === "Failed").length
    }
  };
}
