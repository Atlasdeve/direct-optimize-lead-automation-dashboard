import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { createAdultLeadCountry, listAdultLeadCountries } from "@/lib/adultLeadStore";

async function isAdmin() {
  const session = await currentSession();
  return isOperationsRole(session?.role);
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ countries: await listAdultLeadCountries() });
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const country = await createAdultLeadCountry(typeof body.name === "string" ? body.name : "");
    return NextResponse.json({ country, countries: await listAdultLeadCountries() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Country could not be added." },
      { status: 400 }
    );
  }
}
