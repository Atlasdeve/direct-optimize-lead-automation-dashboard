import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createWeeklyReport, getProjectForUser } from "@/lib/portalStore";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role === "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  try {
    return NextResponse.json({ project: await createWeeklyReport(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Weekly report could not be generated." }, { status: 400 });
  }
}
