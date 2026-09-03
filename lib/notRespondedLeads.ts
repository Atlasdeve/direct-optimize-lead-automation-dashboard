import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LeadLastActivity, NotRespondedLeadRecord } from "@/lib/notRespondedLeadTypes";

const inactivityDays = 30;
const meaningfulOutreachWhere: Prisma.OutreachLogWhereInput = {
  OR: [
    { channel: { in: ["email", "contact_form", "whatsapp"] } },
    { action: "lead_reactivated" }
  ]
};

function newestActivity(items: Array<{ at: Date | null | undefined; label: string }>) {
  return items
    .filter((item): item is { at: Date; label: string } => item.at instanceof Date)
    .sort((left, right) => right.at.getTime() - left.at.getTime())[0];
}

export async function getLeadLastActivity(leadId: string, fallback: { createdAt: string; lastContactedAt?: string | null }): Promise<LeadLastActivity> {
  const [outreach, call] = await Promise.all([
    prisma.outreachLog.findFirst({
      where: { leadId, ...meaningfulOutreachWhere },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, action: true, channel: true }
    }),
    prisma.callLog.findFirst({
      where: { leadId, status: { not: "planned" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  ]);
  const activity = newestActivity([
    { at: new Date(fallback.createdAt), label: "Lead created" },
    { at: fallback.lastContactedAt ? new Date(fallback.lastContactedAt) : null, label: "Last contacted" },
    { at: outreach?.createdAt, label: outreach?.action === "lead_reactivated" ? "Lead reactivated" : outreach?.channel === "contact_form" ? "Contact form activity" : "Outreach activity" },
    { at: call?.createdAt, label: "Voice call activity" }
  ]);
  return { at: activity.at.toISOString(), label: activity.label };
}

export async function listNotRespondedLeads(organizationId?: string | null): Promise<NotRespondedLeadRecord[]> {
  const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      archived: false,
      replied: false,
      unsubscribed: false,
      doNotContact: false,
      createdAt: { lte: cutoff }
    },
    include: {
      outreachLogs: {
        where: meaningfulOutreachWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, action: true, channel: true }
      },
      callLogs: {
        where: { status: { not: "planned" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 500
  });

  return leads.flatMap((lead) => {
    const outreach = lead.outreachLogs[0];
    const call = lead.callLogs[0];
    const activity = newestActivity([
      { at: lead.createdAt, label: "Lead created; no later contact recorded" },
      { at: lead.lastContactedAt, label: "Last contacted; no response recorded" },
      { at: outreach?.createdAt, label: outreach?.action === "lead_reactivated" ? "Lead reactivated" : outreach?.channel === "contact_form" ? "Contact form activity; no response recorded" : "Outreach sent; no response recorded" },
      { at: call?.createdAt, label: "Voice call activity; no response recorded" }
    ]);
    if (activity.at > cutoff) return [];
    return [{
      id: lead.id,
      companyName: lead.companyName,
      region: lead.region,
      country: lead.country,
      city: lead.city ?? "",
      category: lead.category ?? lead.businessType ?? "Uncategorized",
      email: lead.email,
      phone: lead.phone,
      outreachStatus: "Not Responded",
      previousStatus: lead.outreachStatus,
      createdAt: lead.createdAt.toISOString(),
      lastActivityAt: activity.at.toISOString(),
      lastActivityLabel: activity.label,
      inactiveDays: Math.max(inactivityDays, Math.floor((Date.now() - activity.at.getTime()) / (24 * 60 * 60 * 1000)))
    }];
  });
}

export async function reactivateNotRespondedLead(leadId: string, organizationId?: string | null) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...(organizationId ? { organizationId } : {}) } });
  if (!lead) throw new Error("Lead not found.");
  if (lead.unsubscribed || lead.doNotContact) {
    throw new Error("This lead is suppressed and cannot be reactivated.");
  }

  const nextStatus = lead.emailSent || lead.whatsappSent || lead.lastContactedAt ? "Follow-up" : "New";
  const [updated] = await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        archived: false,
        outreachStatus: nextStatus,
        outreachApproved: false,
        outreachApprovedAt: null,
        nextFollowUpAt: null
      }
    }),
    prisma.outreachLog.create({
      data: {
        leadId,
        channel: "system",
        action: "lead_reactivated",
        status: "completed",
        message: "Lead returned to active review from the Not Responded queue."
      }
    })
  ]);
  return {
    id: updated.id,
    companyName: updated.companyName,
    outreachStatus: updated.outreachStatus
  };
}
