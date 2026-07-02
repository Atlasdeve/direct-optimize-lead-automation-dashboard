import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role === "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || "general").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload a screenshot file." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Only PNG, JPG, WEBP, or GIF images are allowed." }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "Screenshot must be under 6MB." }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "projects", projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/projects/${projectId}/${fileName}` });
}
