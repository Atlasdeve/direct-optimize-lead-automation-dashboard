import { NextResponse } from "next/server";
import { listDbAiDrafts, listDbReplies } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json({ replies: await listDbReplies(), drafts: await listDbAiDrafts() });
}
