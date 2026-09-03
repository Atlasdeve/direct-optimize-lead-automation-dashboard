import { NextResponse } from "next/server";
import { buildGmbAuditPdf } from "@/lib/auditPdf";
import { currentUser } from "@/lib/auth";
import { getDbLead, getLatestGmbAudit } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const { id } = await params;
  const [lead, audit] = await Promise.all([getDbLead(id, organizationId), getLatestGmbAudit(id)]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!audit) return NextResponse.json({ error: "Run the GMB audit before downloading its PDF." }, { status: 404 });

  const pdf = await buildGmbAuditPdf(lead, audit, { brandName: user.organization?.companyName });
  return new NextResponse(new Uint8Array(pdf.content), {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Content-Length": String(pdf.content.length),
      "Cache-Control": "private, no-store"
    }
  });
}
