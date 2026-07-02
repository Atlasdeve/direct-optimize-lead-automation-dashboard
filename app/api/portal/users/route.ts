import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createPortalUser, listPortalUsers, type PortalRole } from "@/lib/portalStore";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = request.nextUrl.searchParams.get("role") ?? undefined;
  return NextResponse.json({ users: await listPortalUsers(role) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const created = await createPortalUser({
      email: body.email,
      username: body.username,
      name: body.name,
      password: body.password,
      role: (body.role === "employee" || body.role === "client" ? body.role : "client") as PortalRole
    });
    return NextResponse.json({ user: created });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User could not be created." }, { status: 400 });
  }
}
