import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import {
  listFollowUpReminders,
  scheduleFollowUpReminder,
  updateFollowUpReminder
} from "@/lib/followUpReminders";
import { followUpReminderOptions } from "@/lib/followUpReminderOptions";
import { isOperationsRole } from "@/lib/roles";

const presets = followUpReminderOptions.map((option) => option.value) as [
  (typeof followUpReminderOptions)[number]["value"],
  ...(typeof followUpReminderOptions)[number]["value"][]
];

const createSchema = z.object({
  leadId: z.string().cuid().optional(),
  adultLeadId: z.string().cuid().optional(),
  preset: z.enum(presets),
  note: z.string().trim().max(1000).nullable().optional()
}).strict().refine((value) => Boolean(value.leadId) !== Boolean(value.adultLeadId), {
  message: "Choose exactly one lead."
});

const updateSchema = z.object({
  id: z.string().cuid(),
  action: z.enum(["complete", "cancel"])
}).strict();

async function operationsSession() {
  const session = await currentSession();
  return isOperationsRole(session?.role) ? session : null;
}

export async function GET() {
  const session = await operationsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = session.organizationId;
  return NextResponse.json({ reminders: await listFollowUpReminders(organizationId) });
}

export async function POST(request: NextRequest) {
  const session = await operationsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reminder." }, { status: 400 });
  }
  try {
    const organizationId = session.organizationId;
    const reminder = await scheduleFollowUpReminder({
      ...parsed.data,
      organizationId,
      createdByUserId: session.userId
    });
    return NextResponse.json({ reminder });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Reminder could not be scheduled."
    }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await operationsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reminder update." }, { status: 400 });
  }
  try {
    const organizationId = session.organizationId;
    return NextResponse.json({
      reminder: await updateFollowUpReminder(parsed.data.id, parsed.data.action, organizationId)
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Reminder could not be updated."
    }, { status: 400 });
  }
}
