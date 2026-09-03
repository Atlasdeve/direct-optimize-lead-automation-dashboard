import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { createStaffAccount, listStaffAccounts, type StaffRole } from "@/lib/staffStore";

export async function GET() {
  const user = await currentUser();
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ staff: await listStaffAccounts(user.role === "super_admin" ? undefined : user.organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    const role = body.role === "admin" ? "admin" : body.role === "manager" ? "manager" : null;
    if (!role) throw new Error("Select Administrator or Manager.");
    const staff = await createStaffAccount({
      email: typeof body.email === "string" ? body.email : "",
      username: typeof body.username === "string" ? body.username : "",
      name: typeof body.name === "string" ? body.name : "",
      password: typeof body.password === "string" ? body.password : "",
      role: role as StaffRole,
      organizationId: user.organizationId
    });
    return NextResponse.json({ staff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Staff account could not be created." },
      { status: 400 }
    );
  }
}
