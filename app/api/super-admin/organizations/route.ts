import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/roles";
import { createOrganization, createOrganizationAdmin, deleteOrganizationAdmin, listOrganizations, updateOrganization, updateOrganizationApiSettings } from "@/lib/saasStore";

async function requireSuperAdmin() {
  const user = await currentUser();
  if (!user || !isSuperAdminRole(user.role)) return null;
  return user;
}

export async function GET() {
  const user = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  return NextResponse.json({ organizations: await listOrganizations() });
}

export async function POST(request: NextRequest) {
  const user = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    await createOrganization(body);
    return NextResponse.json({ organizations: await listOrganizations() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Client organization could not be created." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Organization id is required." }, { status: 400 });
  try {
    if (body.section === "api") {
      await updateOrganizationApiSettings(id, body);
    } else if (body.section === "admin") {
      await createOrganizationAdmin(id, body);
    } else if (body.section === "deleteAdmin") {
      await deleteOrganizationAdmin(id, body.userId);
    } else {
      await updateOrganization(id, body);
    }
    return NextResponse.json({ organizations: await listOrganizations() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Client organization could not be updated." },
      { status: 400 }
    );
  }
}
