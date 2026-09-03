import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getLeadDiscoveryCategories, saveLeadDiscoveryCategories } from "@/lib/leadCategories";
import { isOperationsRole } from "@/lib/roles";

async function authorized() {
  const user = await currentUser();
  return user && isOperationsRole(user.role) ? user : null;
}

export async function GET() {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ categories: await getLeadDiscoveryCategories(user.organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const categories = await saveLeadDiscoveryCategories(body.categories, user.organizationId);
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lead categories could not be saved." },
      { status: 400 }
    );
  }
}
