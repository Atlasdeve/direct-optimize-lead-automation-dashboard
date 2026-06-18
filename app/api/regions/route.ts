import { NextResponse } from "next/server";
import { regions } from "@/lib/regions";

export async function GET() {
  return NextResponse.json({ regions });
}
