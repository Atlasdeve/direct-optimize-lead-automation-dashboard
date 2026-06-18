import { NextRequest, NextResponse } from "next/server";
import { listContactFormQueue, listDbLeads, listDbReplies } from "@/lib/dbStore";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "leads";
  const region = request.nextUrl.searchParams.get("region") ?? undefined;

  let rows: Record<string, unknown>[] = [];
  if (type === "contact_forms") rows = await listContactFormQueue(region);
  else if (type === "replies") {
    rows = (await listDbReplies()).map((reply) => ({
      id: reply.id,
      leadId: reply.leadId,
      fromEmail: reply.fromEmail,
      subject: reply.subject,
      receivedAt: reply.receivedAt.toISOString(),
      body: reply.body
    }));
  } else {
    rows = (await listDbLeads(region)).map((lead) => ({
      id: lead.id,
      company: lead.company_name,
      region: lead.region,
      city: lead.city,
      category: lead.category,
      website: lead.website,
      email: lead.email,
      phone: lead.phone,
      score: lead.lead_score,
      status: lead.outreach_status,
      approved: lead.outreach_approved,
      contactForms: lead.contact_forms?.join(" | ")
    }));
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${region ?? "all"}.csv"`
    }
  });
}
