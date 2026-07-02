import { NextResponse } from "next/server";
import { buildWebsiteAuditPdf } from "@/lib/auditPdf";
import { getDbLead, getLatestLeadIntelligence } from "@/lib/dbStore";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, audit] = await Promise.all([getDbLead(id), getLatestLeadIntelligence(id)]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!audit) return NextResponse.json({ error: "Run the website audit before downloading its PDF." }, { status: 404 });

  const pdf = await buildWebsiteAuditPdf(lead, audit);
  return new NextResponse(new Uint8Array(pdf.content), {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Content-Length": String(pdf.content.length),
      "Cache-Control": "private, no-store"
    }
  });
}
