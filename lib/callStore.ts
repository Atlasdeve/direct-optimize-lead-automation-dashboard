import { prisma } from "@/lib/prisma";

export const callOutcomes = ["Interested", "Callback", "Voicemail", "No answer", "Not interested", "Wrong number", "Qualified"] as const;

export function serializeCallLog(call: Awaited<ReturnType<typeof prisma.callLog.findFirst>> & { user?: { name: string | null; username: string | null } | null }) {
  if (!call) return null;
  return {
    id: call.id,
    leadId: call.leadId,
    userId: call.userId,
    contactName: call.contactName,
    companyName: call.companyName,
    agent: call.user?.name || call.user?.username || "Unassigned",
    provider: call.provider,
    providerCallSid: call.providerCallSid,
    direction: call.direction,
    phone: call.phone,
    status: call.status,
    outcome: call.outcome,
    notes: call.notes,
    durationSeconds: call.durationSeconds,
    startedAt: call.startedAt?.toISOString() ?? null,
    answeredAt: call.answeredAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    followUpAt: call.followUpAt?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString()
  };
}

export async function listLeadCallLogs(leadId: string) {
  const calls = await prisma.callLog.findMany({
    where: { leadId },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return calls.map(serializeCallLog);
}

export async function listRecentCallLogs() {
  const calls = await prisma.callLog.findMany({
    include: {
      user: { select: { name: true, username: true } },
      lead: { select: { companyName: true, region: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return calls.map((call) => ({
    ...serializeCallLog(call),
    companyName: call.lead?.companyName || call.companyName || call.contactName || call.phone,
    region: call.lead?.region || "Custom call"
  }));
}

export async function listStandaloneCallLogs() {
  const calls = await prisma.callLog.findMany({
    where: { leadId: null },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return calls.map(serializeCallLog);
}

export async function createCallLog(input: {
  leadId?: string | null;
  userId: string;
  contactName?: string;
  companyName?: string;
  provider: "telnyx" | "manual";
  phone: string;
  status?: string;
  outcome?: string;
  notes?: string;
  durationSeconds?: number;
  followUpAt?: Date | null;
}) {
  const call = await prisma.callLog.create({
    data: {
      leadId: input.leadId,
      userId: input.userId,
      contactName: input.contactName,
      companyName: input.companyName,
      provider: input.provider,
      phone: input.phone,
      status: input.status ?? (input.provider === "manual" ? "completed" : "initiated"),
      outcome: input.outcome,
      notes: input.notes,
      durationSeconds: input.durationSeconds ?? 0,
      startedAt: new Date(),
      endedAt: input.provider === "manual" ? new Date() : null,
      followUpAt: input.followUpAt
    },
    include: { user: { select: { name: true, username: true } } }
  });
  return serializeCallLog(call);
}

export async function getCallLog(id: string) {
  return prisma.callLog.findUnique({ where: { id }, include: { lead: true } });
}

export async function updateCallLog(id: string, input: {
  providerCallSid?: string;
  status?: string;
  outcome?: string | null;
  notes?: string | null;
  durationSeconds?: number;
  followUpAt?: Date | null;
}) {
  const now = new Date();
  const call = await prisma.callLog.update({
    where: { id },
    data: {
      providerCallSid: input.providerCallSid,
      status: input.status,
      outcome: input.outcome,
      notes: input.notes,
      durationSeconds: input.durationSeconds,
      followUpAt: input.followUpAt,
      answeredAt: input.status === "in-progress" ? now : undefined,
      endedAt: ["completed", "busy", "failed", "no-answer", "canceled"].includes(input.status ?? "") ? now : undefined
    },
    include: { user: { select: { name: true, username: true } } }
  });
  return serializeCallLog(call);
}
