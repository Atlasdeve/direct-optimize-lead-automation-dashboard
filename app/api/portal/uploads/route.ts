import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function validImageSignature(buffer: Buffer, type: string) {
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const rawProjectId = String(form.get("projectId") || "");
  const projectId = rawProjectId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!projectId || projectId !== rawProjectId) return NextResponse.json({ error: "A valid project is required." }, { status: 400 });
  const project = await prisma.clientProject.findUnique({ where: { id: projectId }, select: { employeeUserId: true } });
  if (!project || (user.role === "employee" && project.employeeUserId !== user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload a screenshot file." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Only PNG, JPG, or WEBP images are allowed." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Screenshot must be under 5MB." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validImageSignature(buffer, file.type)) return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "storage", "project-uploads", projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer, { flag: "wx", mode: 0o600 });
  return NextResponse.json({ url: `/api/portal/uploads/${projectId}/${fileName}` });
}
