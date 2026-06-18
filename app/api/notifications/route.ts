import { NextResponse } from "next/server";
import { listDbNotifications } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json({ notifications: await listDbNotifications() });
}
