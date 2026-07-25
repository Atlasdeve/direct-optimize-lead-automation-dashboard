import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { discoverAdultLeads, listAdultLeads } from "@/lib/adultLeadStore";

const discoverySchema = z.object({
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().max(120).optional().nullable(),
  categoryId: z.enum(["adult_products", "sexual_wellness", "dating_platforms", "adult_entertainment", "casino", "betting", "cannabis"]),
  limit: z.number().int().min(1).max(10).default(10)
});

async function requireAdmin() {
  const session = await currentSession();
  return session?.role === "admin";
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    leads: await listAdultLeads({
      country: request.nextUrl.searchParams.get("country") || undefined,
      category: request.nextUrl.searchParams.get("category") || undefined,
      status: request.nextUrl.searchParams.get("status") || undefined
    })
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = discoverySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid discovery request." }, { status: 400 });
  }
  try {
    return NextResponse.json(await discoverAdultLeads(parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed." }, { status: 400 });
  }
}
