import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createMilestone, getProjectForUser } from "@/lib/portalStore";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({
      project: await createMilestone(id, {
        title: String(body.title || "Project milestone"),
        description: body.description ? String(body.description) : undefined,
        amount: Number(body.amount || 0),
        status: body.status ? String(body.status) : undefined,
        dueDate: body.dueDate ? String(body.dueDate) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Milestone could not be saved." }, { status: 400 });
  }
}
