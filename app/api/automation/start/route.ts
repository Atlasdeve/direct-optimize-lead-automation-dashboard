import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { enqueueAutomation } from "@/lib/queue";
import { isOperationsRole } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" ? body.region : "Canada";
  const city = typeof body.city === "string" ? body.city : undefined;
  const categories = Array.isArray(body.categories) ? body.categories.filter((item: unknown): item is string => typeof item === "string") : undefined;
  const maxResults = typeof body.maxResults === "number" ? body.maxResults : undefined;
  const result = await enqueueAutomation(region, { city, categories, maxResults, organizationId: user.organizationId });
  return NextResponse.json(result);
}
