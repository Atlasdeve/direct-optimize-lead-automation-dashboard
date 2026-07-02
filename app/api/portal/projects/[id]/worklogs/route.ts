import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addWorkLog, getProjectForUser } from "@/lib/portalStore";

function screenshotUrls(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (typeof value === "string") return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  return [];
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role === "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    const updated = await addWorkLog(id, user, {
      title: String(body.title || "Daily progress"),
      summary: String(body.summary || ""),
      changesMade: String(body.changesMade || ""),
      timeMinutes: Number(body.timeMinutes || 0),
      screenshotUrls: screenshotUrls(body.screenshotUrls),
      clientVisible: body.clientVisible !== false,
      progress: body.progress === undefined ? undefined : Number(body.progress),
      status: body.status
    });
    return NextResponse.json({ project: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Work log could not be saved." }, { status: 400 });
  }
}
