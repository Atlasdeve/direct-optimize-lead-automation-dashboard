import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createProject, listProjectsForUser } from "@/lib/portalStore";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ projects: await listProjectsForUser(user) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const project = await createProject({
      leadId: body.leadId,
      clientUserId: body.clientUserId,
      employeeUserId: body.employeeUserId,
      companyName: body.companyName,
      websiteUrl: body.websiteUrl,
      gmbUrl: body.gmbUrl,
      status: body.status,
      progress: Number(body.progress ?? 5),
      estimatedMinutes: Number(body.estimatedMinutes ?? 0),
      notes: body.notes
    });
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project could not be created." }, { status: 400 });
  }
}
