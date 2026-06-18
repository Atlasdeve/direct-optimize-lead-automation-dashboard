import { NextResponse } from "next/server";
import { providerSettings } from "@/lib/templates";

export async function GET() {
  return NextResponse.json({ settings: providerSettings() });
}
