import { NextResponse } from "next/server";
import { dbAnalytics } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json(await dbAnalytics());
}
