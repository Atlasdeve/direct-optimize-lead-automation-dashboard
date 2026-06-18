import { NextResponse } from "next/server";
import { emailTemplates, whatsappIdentificationRules } from "@/lib/templates";

export async function GET() {
  return NextResponse.json({ emailTemplates, whatsappIdentificationRules });
}
