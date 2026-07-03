import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const filePattern = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const contentTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_: NextRequest, { params }: { params: Promise<{ projectId: string; fileName: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId, fileName } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !filePattern.test(fileName)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const project = await prisma.clientProject.findUnique({
    where: { id: projectId },
    select: { clientUserId: true, employeeUserId: true }
  });
  const permitted = user.role === "admin" || (user.role === "client" && project?.clientUserId === user.id) || (user.role === "employee" && project?.employeeUserId === user.id);
  if (!permitted) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const extension = fileName.split(".").pop()!;
    const file = await readFile(path.join(process.cwd(), "storage", "project-uploads", projectId, fileName));
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentTypes[extension],
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
