import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { updateMilestone } from "@/lib/portalStore";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({ project: await updateMilestone(id, { status: String(body.status || "") }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Milestone could not be updated." }, { status: 400 });
  }
}
