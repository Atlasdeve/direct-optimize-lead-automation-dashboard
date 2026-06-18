import { NextResponse } from "next/server";
import { syncInboxReplies } from "@/lib/replySync";

export async function POST() {
  const result = await syncInboxReplies();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
