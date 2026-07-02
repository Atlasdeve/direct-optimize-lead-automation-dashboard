import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Lead } from "@/lib/types";

export type PortalRole = "admin" | "employee" | "client";

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function projectInclude() {
  return {
    lead: true,
    client: { select: { id: true, name: true, email: true, username: true, role: true } },
    employee: { select: { id: true, name: true, email: true, username: true, role: true } },
    comments: {
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" as const }
    },
    milestones: { orderBy: [{ status: "asc" as const }, { dueDate: "asc" as const }] },
    snapshots: { orderBy: { createdAt: "desc" as const } },
    weeklyReports: { orderBy: { createdAt: "desc" as const } },
    workLogs: {
      include: { employee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" as const }
    }
  };
}

type ProjectRecord = Prisma.ClientProjectGetPayload<{ include: ReturnType<typeof projectInclude> }>;

export function serializeProject(project: ProjectRecord, viewerRole: string = "admin") {
  const logs = viewerRole === "client" ? project.workLogs.filter((log) => log.clientVisible) : project.workLogs;
  const comments = viewerRole === "client" ? project.comments.filter((comment) => comment.clientVisible) : project.comments;
  const totalMinutes = logs.reduce((sum, log) => sum + log.timeMinutes, 0);
  const daily = new Map<string, { date: string; minutes: number; logs: number }>();
  for (const log of logs) {
    const date = log.createdAt.toISOString().slice(0, 10);
    const row = daily.get(date) ?? { date, minutes: 0, logs: 0 };
    row.minutes += log.timeMinutes;
    row.logs += 1;
    daily.set(date, row);
  }
  return {
    id: project.id,
    leadId: project.leadId,
    companyName: project.companyName,
    websiteUrl: project.websiteUrl,
    gmbUrl: project.gmbUrl,
    status: project.status,
    progress: project.progress,
    estimatedMinutes: project.estimatedMinutes,
    notes: project.notes,
    client: project.client,
    employee: project.employee,
    lead: project.lead ? {
      id: project.lead.id,
      companyName: project.lead.companyName,
      region: project.lead.region,
      city: project.lead.city,
      email: project.lead.email
    } : null,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    workLogs: logs.map((log) => ({
      id: log.id,
      title: log.title,
      summary: log.summary,
      changesMade: log.changesMade,
      timeMinutes: log.timeMinutes,
      screenshotUrls: Array.isArray(log.screenshotUrls) ? log.screenshotUrls.map(String).filter(Boolean) : [],
      clientVisible: log.clientVisible,
      employee: log.employee,
      createdAt: log.createdAt.toISOString()
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      type: comment.type,
      approved: comment.approved,
      clientVisible: comment.clientVisible,
      author: comment.author,
      createdAt: comment.createdAt.toISOString()
    })),
    milestones: project.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      amount: milestone.amount,
      status: milestone.status,
      dueDate: milestone.dueDate?.toISOString() ?? null,
      completedAt: milestone.completedAt?.toISOString() ?? null
    })),
    snapshots: project.snapshots.map((snapshot) => ({
      id: snapshot.id,
      kind: snapshot.kind,
      title: snapshot.title,
      summary: snapshot.summary,
      metrics: snapshot.metrics,
      screenshotUrls: Array.isArray(snapshot.screenshotUrls) ? snapshot.screenshotUrls.map(String).filter(Boolean) : [],
      createdAt: snapshot.createdAt.toISOString()
    })),
    weeklyReports: project.weeklyReports.map((report) => ({
      id: report.id,
      weekStart: report.weekStart.toISOString(),
      weekEnd: report.weekEnd.toISOString(),
      summary: report.summary,
      wins: Array.isArray(report.wins) ? report.wins.map(String).filter(Boolean) : [],
      nextSteps: Array.isArray(report.nextSteps) ? report.nextSteps.map(String).filter(Boolean) : [],
      totalMinutes: report.totalMinutes,
      createdAt: report.createdAt.toISOString()
    })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export async function listPortalUsers(role?: string) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function createPortalUser(input: { email: string; username?: string; name?: string; password: string; role: PortalRole }) {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username || email.split("@")[0]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username must be 3-32 characters.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { id: true } });
  if (existing) throw new Error("A user with that email or username already exists.");
  return prisma.user.create({
    data: {
      email,
      username,
      name: input.name || username,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 12)
    },
    select: { id: true, email: true, username: true, name: true, role: true }
  });
}

export async function listProjectsForUser(user: { id: string; role: string }) {
  const where =
    user.role === "client" ? { clientUserId: user.id } :
    user.role === "employee" ? { employeeUserId: user.id } :
    {};
  const projects = await prisma.clientProject.findMany({
    where,
    include: projectInclude(),
    orderBy: { updatedAt: "desc" }
  });
  return projects.map((project) => serializeProject(project, user.role));
}

export async function getProjectForUser(projectId: string, user: { id: string; role: string }) {
  const project = await prisma.clientProject.findUnique({
    where: { id: projectId },
    include: projectInclude()
  });
  if (!project) return null;
  if (user.role === "client" && project.clientUserId !== user.id) return null;
  if (user.role === "employee" && project.employeeUserId !== user.id) return null;
  return serializeProject(project, user.role);
}

export async function getProjectByLeadId(leadId: string) {
  const project = await prisma.clientProject.findFirst({
    where: { leadId },
    include: projectInclude(),
    orderBy: { createdAt: "asc" }
  });
  return project ? serializeProject(project) : null;
}

export async function createProject(input: {
  leadId?: string;
  clientUserId?: string;
  employeeUserId?: string;
  companyName: string;
  websiteUrl?: string;
  gmbUrl?: string;
  status?: string;
  progress?: number;
  estimatedMinutes?: number;
  notes?: string;
}) {
  let lead: Lead | null = null;
  if (input.leadId) {
    const existingProject = await getProjectByLeadId(input.leadId);
    if (existingProject) return existingProject;
    const dbLead = await prisma.lead.findUnique({ where: { id: input.leadId } });
    lead = dbLead ? {
      id: dbLead.id,
      company_name: dbLead.companyName,
      region: dbLead.region,
      country: dbLead.country,
      city: dbLead.city ?? "",
      category: dbLead.category ?? "",
      business_type: dbLead.businessType ?? "",
      website: dbLead.website,
      google_maps_url: dbLead.googleMapsUrl,
      phone: dbLead.phone,
      email: dbLead.email,
      whatsapp_available: dbLead.whatsappAvailable,
      whatsapp_status: dbLead.whatsappStatus as Lead["whatsapp_status"],
      source_platform: dbLead.sourcePlatform,
      lead_score: dbLead.leadScore,
      outreach_status: dbLead.outreachStatus as Lead["outreach_status"],
      outreach_approved: dbLead.outreachApproved,
      email_sent: dbLead.emailSent,
      whatsapp_sent: dbLead.whatsappSent,
      replied: dbLead.replied,
      do_not_contact: dbLead.doNotContact,
      consent_status: dbLead.consentStatus,
      unsubscribed: dbLead.unsubscribed,
      created_at: dbLead.createdAt.toISOString(),
      updated_at: dbLead.updatedAt.toISOString()
    } : null;
  }
  const project = await prisma.clientProject.create({
    data: {
      leadId: input.leadId || undefined,
      clientUserId: input.clientUserId || undefined,
      employeeUserId: input.employeeUserId || undefined,
      companyName: input.companyName || lead?.company_name || "Client project",
      websiteUrl: input.websiteUrl || lead?.website || undefined,
      gmbUrl: input.gmbUrl || lead?.google_maps_url || undefined,
      status: input.status || "Onboarding",
      progress: Math.max(0, Math.min(100, input.progress ?? 5)),
      estimatedMinutes: Math.max(0, input.estimatedMinutes ?? 0),
      notes: input.notes || undefined
    },
    include: projectInclude()
  });
  return serializeProject(project);
}

export async function updateProject(projectId: string, input: Partial<{ employeeUserId: string; clientUserId: string; status: string; progress: number; websiteUrl: string; gmbUrl: string; notes: string; estimatedMinutes: number }>) {
  const project = await prisma.clientProject.update({
    where: { id: projectId },
    data: {
      employeeUserId: input.employeeUserId || undefined,
      clientUserId: input.clientUserId || undefined,
      status: input.status || undefined,
      progress: input.progress === undefined ? undefined : Math.max(0, Math.min(100, input.progress)),
      websiteUrl: input.websiteUrl || undefined,
      gmbUrl: input.gmbUrl || undefined,
      notes: input.notes || undefined,
      estimatedMinutes: input.estimatedMinutes === undefined ? undefined : Math.max(0, input.estimatedMinutes)
    },
    include: projectInclude()
  });
  return serializeProject(project);
}

export async function addWorkLog(projectId: string, user: { id: string; role: string }, input: { title: string; summary: string; changesMade: string; timeMinutes: number; screenshotUrls: string[]; clientVisible?: boolean; progress?: number; status?: string }) {
  const project = await prisma.clientProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");
  if (user.role === "employee" && project.employeeUserId !== user.id) throw new Error("This project is not assigned to you.");
  await prisma.workLog.create({
    data: {
      projectId,
      employeeUserId: user.role === "employee" ? user.id : project.employeeUserId || user.id,
      title: input.title,
      summary: input.summary,
      changesMade: input.changesMade,
      timeMinutes: Math.max(0, input.timeMinutes || 0),
      screenshotUrls: input.screenshotUrls,
      clientVisible: input.clientVisible !== false
    }
  });
  const updated = await prisma.clientProject.update({
    where: { id: projectId },
    data: {
      progress: input.progress === undefined ? undefined : Math.max(0, Math.min(100, input.progress)),
      status: input.status || undefined
    },
    include: projectInclude()
  });
  return serializeProject(updated, user.role);
}

export async function addProjectComment(projectId: string, user: { id: string; role: string }, input: { body: string; type?: string; approved?: boolean; clientVisible?: boolean }) {
  const project = await prisma.clientProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");
  if (user.role === "client" && project.clientUserId !== user.id) throw new Error("Project not found.");
  await prisma.projectComment.create({
    data: {
      projectId,
      authorUserId: user.id,
      body: input.body,
      type: input.type || "comment",
      approved: Boolean(input.approved),
      clientVisible: input.clientVisible !== false
    }
  });
  const updated = await prisma.clientProject.findUniqueOrThrow({ where: { id: projectId }, include: projectInclude() });
  return serializeProject(updated, user.role);
}

export async function createMilestone(projectId: string, input: { title: string; description?: string; amount?: number; status?: string; dueDate?: string }) {
  await prisma.projectMilestone.create({
    data: {
      projectId,
      title: input.title,
      description: input.description || undefined,
      amount: Math.max(0, input.amount || 0),
      status: input.status || "Pending",
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined
    }
  });
  const updated = await prisma.clientProject.findUniqueOrThrow({ where: { id: projectId }, include: projectInclude() });
  return serializeProject(updated);
}

export async function updateMilestone(milestoneId: string, input: { status?: string }) {
  const milestone = await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data: {
      status: input.status || undefined,
      completedAt: input.status === "Paid" || input.status === "Completed" ? new Date() : undefined
    }
  });
  const updated = await prisma.clientProject.findUniqueOrThrow({ where: { id: milestone.projectId }, include: projectInclude() });
  return serializeProject(updated);
}

export async function createSnapshot(projectId: string, input: { kind: string; title: string; summary: string; metrics?: Record<string, unknown>; screenshotUrls?: string[] }) {
  await prisma.projectSnapshot.create({
    data: {
      projectId,
      kind: input.kind || "Before",
      title: input.title,
      summary: input.summary,
      metrics: (input.metrics || {}) as Prisma.InputJsonValue,
      screenshotUrls: input.screenshotUrls || []
    }
  });
  const updated = await prisma.clientProject.findUniqueOrThrow({ where: { id: projectId }, include: projectInclude() });
  return serializeProject(updated);
}

export async function createWeeklyReport(projectId: string) {
  const project = await prisma.clientProject.findUnique({
    where: { id: projectId },
    include: projectInclude()
  });
  if (!project) throw new Error("Project not found.");
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  const logs = project.workLogs.filter((log) => log.createdAt >= weekStart && log.createdAt <= weekEnd);
  const totalMinutes = logs.reduce((sum, log) => sum + log.timeMinutes, 0);
  const wins = logs.slice(0, 5).map((log) => log.title);
  const nextSteps = [
    project.progress < 50 ? "Continue implementation and collect more proof-of-work screenshots." : "Move toward review, QA, and client approval.",
    project.gmbUrl ? "Review GMB impact and update next profile actions." : "Confirm Google Business Profile URL with client.",
    project.websiteUrl ? "Check website changes against current audit findings." : "Confirm website URL or website creation scope."
  ];
  await prisma.weeklyReport.create({
    data: {
      projectId,
      weekStart,
      weekEnd,
      summary: `${project.companyName} received ${logs.length} progress update(s) this week with ${Math.round((totalMinutes / 60) * 10) / 10} hours logged. Current project progress is ${project.progress}%.`,
      wins,
      nextSteps,
      totalMinutes
    }
  });
  const updated = await prisma.clientProject.findUniqueOrThrow({ where: { id: projectId }, include: projectInclude() });
  return serializeProject(updated);
}
