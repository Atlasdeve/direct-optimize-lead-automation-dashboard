import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getLeadDiscoveryCategories, saveLeadDiscoveryCategories } from "@/lib/leadCategories";
import { isOperationsRole } from "@/lib/roles";

async function authorized() {
  const user = await currentUser();
  return Boolean(user && isOperationsRole(user.role));
}

export async function GET() {
  if (!await authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ categories: await getLeadDiscoveryCategories() });
}

export async function POST(request: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const categories = await saveLeadDiscoveryCategories(body.categories);
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lead categories could not be saved." },
      { status: 400 }
    );
  }
}
