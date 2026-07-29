import { createAppNotification } from "@/lib/appNotifications";
import {
  followUpReminderOptions,
  type FollowUpReminderPreset,
  type FollowUpReminderRecord
} from "@/lib/followUpReminderOptions";
import { prisma } from "@/lib/prisma";

type ReminderWithLead = Awaited<ReturnType<typeof reminderWithLead>>;

function reminderWithLead(id: string) {
  return prisma.followUpReminder.findUnique({
    where: { id },
    include: {
      lead: { select: { companyName: true, country: true, region: true } },
      adultLead: { select: { businessName: true, country: true } }
    }
  });
}

function optionForPreset(preset: string) {
  return followUpReminderOptions.find((option) => option.value === preset);
}

function toRecord(reminder: NonNullable<ReminderWithLead>): FollowUpReminderRecord {
  const adult = Boolean(reminder.adultLeadId);
  const option = optionForPreset(reminder.preset);
  return {
    id: reminder.id,
    leadId: reminder.leadId,
    adultLeadId: reminder.adultLeadId,
    leadType: adult ? "adult_lead" : "lead",
    leadName: reminder.adultLead?.businessName ?? reminder.lead?.companyName ?? "Deleted lead",
    country: reminder.adultLead?.country ?? reminder.lead?.country ?? reminder.lead?.region ?? "",
    preset: reminder.preset as FollowUpReminderPreset,
    presetLabel: option?.label ?? reminder.preset,
    note: reminder.note,
    dueAt: reminder.dueAt.toISOString(),
    status: reminder.status,
    notifiedAt: reminder.notifiedAt?.toISOString() ?? null,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    actionUrl: adult ? "/adult-leads" : `/leads/${reminder.leadId}`
  };
}

export async function listFollowUpReminders() {
  const reminders = await prisma.followUpReminder.findMany({
    include: {
      lead: { select: { companyName: true, country: true, region: true } },
      adultLead: { select: { businessName: true, country: true } }
    },
    orderBy: [
      { completedAt: "asc" },
      { dueAt: "asc" }
    ],
    take: 500
  });
  return reminders.map(toRecord);
}

export async function getActiveFollowUpReminder(input: { leadId?: string; adultLeadId?: string }) {
  const reminder = await prisma.followUpReminder.findFirst({
    where: {
      ...(input.leadId ? { leadId: input.leadId } : {}),
      ...(input.adultLeadId ? { adultLeadId: input.adultLeadId } : {}),
      status: { in: ["Scheduled", "Due"] }
    },
    include: {
      lead: { select: { companyName: true, country: true, region: true } },
      adultLead: { select: { businessName: true, country: true } }
    },
    orderBy: { dueAt: "asc" }
  });
  return reminder ? toRecord(reminder) : null;
}

export async function getActiveAdultLeadReminderMap() {
  const reminders = await prisma.followUpReminder.findMany({
    where: {
      adultLeadId: { not: null },
      status: { in: ["Scheduled", "Due"] }
    },
    include: {
      lead: { select: { companyName: true, country: true, region: true } },
      adultLead: { select: { businessName: true, country: true } }
    },
    orderBy: { dueAt: "asc" }
  });
  return Object.fromEntries(reminders.map((reminder) => [reminder.adultLeadId!, toRecord(reminder)]));
}

export async function scheduleFollowUpReminder(input: {
  leadId?: string;
  adultLeadId?: string;
  preset: FollowUpReminderPreset;
  note?: string | null;
  createdByUserId?: string | null;
}) {
  if (Boolean(input.leadId) === Boolean(input.adultLeadId)) {
    throw new Error("Choose exactly one lead for the reminder.");
  }
  const option = optionForPreset(input.preset);
  if (!option) throw new Error("Select a valid reminder delay.");

  if (input.leadId) {
    const exists = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
    if (!exists) throw new Error("Lead was not found.");
  }
  if (input.adultLeadId) {
    const exists = await prisma.adultLead.findUnique({ where: { id: input.adultLeadId }, select: { id: true } });
    if (!exists) throw new Error("Adult Lead was not found.");
  }

  const dueAt = new Date(Date.now() + option.days * 24 * 60 * 60 * 1000);
  const reminder = await prisma.$transaction(async (tx) => {
    await tx.followUpReminder.updateMany({
      where: {
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.adultLeadId ? { adultLeadId: input.adultLeadId } : {}),
        status: { in: ["Scheduled", "Due"] }
      },
      data: { status: "Cancelled", completedAt: new Date() }
    });
    return tx.followUpReminder.create({
      data: {
        leadId: input.leadId,
        adultLeadId: input.adultLeadId,
        createdByUserId: input.createdByUserId,
        preset: option.value,
        note: input.note?.trim().slice(0, 1000) || null,
        dueAt
      }
    });
  });
  const full = await reminderWithLead(reminder.id);
  if (!full) throw new Error("Reminder could not be loaded.");
  return toRecord(full);
}

export async function updateFollowUpReminder(id: string, action: "complete" | "cancel") {
  const reminder = await prisma.followUpReminder.update({
    where: { id },
    data: {
      status: action === "complete" ? "Completed" : "Cancelled",
      completedAt: new Date()
    }
  });
  const full = await reminderWithLead(reminder.id);
  if (!full) throw new Error("Reminder could not be loaded.");
  return toRecord(full);
}

export async function sendDueLeadFollowUpReminders(now = new Date()) {
  const due = await prisma.followUpReminder.findMany({
    where: {
      status: "Scheduled",
      notifiedAt: null,
      dueAt: { lte: now }
    },
    include: {
      lead: { select: { companyName: true } },
      adultLead: { select: { businessName: true } }
    },
    orderBy: { dueAt: "asc" },
    take: 100
  });

  let sent = 0;
  for (const reminder of due) {
    const claimed = await prisma.followUpReminder.updateMany({
      where: { id: reminder.id, status: "Scheduled", notifiedAt: null },
      data: { status: "Due", notifiedAt: now }
    });
    if (claimed.count !== 1) continue;

    const adult = Boolean(reminder.adultLeadId);
    const leadName = reminder.adultLead?.businessName ?? reminder.lead?.companyName ?? "Lead";
    try {
      await createAppNotification({
        type: "lead_follow_up_reminder",
        title: `Follow up with ${leadName}`,
        message: reminder.note || "This lead is ready for your scheduled follow-up.",
        actionUrl: adult ? "/adult-leads" : `/leads/${reminder.leadId}`
      });
      sent += 1;
    } catch (error) {
      await prisma.followUpReminder.update({
        where: { id: reminder.id },
        data: { status: "Scheduled", notifiedAt: null }
      });
      throw error;
    }
  }
  return { sent };
}
