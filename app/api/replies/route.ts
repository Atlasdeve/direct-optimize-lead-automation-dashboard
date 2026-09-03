import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listDbAiDrafts, listDbReplies } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  return NextResponse.json({ replies: await listDbReplies(organizationId), drafts: await listDbAiDrafts(organizationId) });
}
