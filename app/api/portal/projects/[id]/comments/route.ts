import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addProjectComment, getProjectForUser } from "@/lib/portalStore";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({
      project: await addProjectComment(id, user, {
        body: String(body.body || ""),
        type: body.type === "approval" ? "approval" : "comment",
        approved: Boolean(body.approved),
        clientVisible: body.clientVisible !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Comment could not be saved." }, { status: 400 });
  }
}
