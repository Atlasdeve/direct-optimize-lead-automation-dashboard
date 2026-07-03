import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { updateClientProfile } from "@/lib/portalStore";

export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await updateClientProfile(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile could not be updated." }, { status: 400 });
  }
}
