import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getProjectForUser, updateProject } from "@/lib/portalStore";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({
      project: await updateProject(id, {
        employeeUserId: body.employeeUserId,
        clientUserId: body.clientUserId,
        status: body.status,
        progress: body.progress === undefined ? undefined : Number(body.progress),
        websiteUrl: body.websiteUrl,
        gmbUrl: body.gmbUrl,
        notes: body.notes,
        estimatedMinutes: body.estimatedMinutes === undefined ? undefined : Number(body.estimatedMinutes)
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project could not be updated." }, { status: 400 });
  }
}
