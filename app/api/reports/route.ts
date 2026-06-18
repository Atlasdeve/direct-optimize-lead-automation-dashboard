import { NextRequest, NextResponse } from "next/server";
import { listContactFormQueue, listDbLeads, listDbReplies } from "@/lib/dbStore";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  const [leads, forms, replies] = await Promise.all([
    listDbLeads(region),
    listContactFormQueue(region),
    listDbReplies()
  ]);
  const regionReplies = region ? replies.filter((reply) => leads.some((lead) => lead.id === reply.leadId)) : replies;
  const categories = new Map<string, { leads: number; emails: number; forms: number; contacted: number; replies: number }>();

  for (const lead of leads) {
    const key = lead.category || "Uncategorized";
    const row = categories.get(key) ?? { leads: 0, emails: 0, forms: 0, contacted: 0, replies: 0 };
    row.leads += 1;
    if (lead.email) row.emails += 1;
    if ((lead.contact_forms?.length ?? 0) > 0) row.forms += 1;
    if (lead.email_sent || lead.whatsapp_sent) row.contacted += 1;
    if (lead.replied) row.replies += 1;
    categories.set(key, row);
  }

  return NextResponse.json({
    summary: {
      leads: leads.length,
      emailsFound: leads.filter((lead) => lead.email).length,
      formsFound: forms.length,
      emailsSent: leads.filter((lead) => lead.email_sent).length,
      formsSubmitted: forms.filter((form) => form.status === "submitted").length,
      replies: regionReplies.length,
      meetings: leads.filter((lead) => lead.outreach_status === "Meeting Booked").length
    },
    categories: [...categories.entries()].map(([category, data]) => ({
      category,
      ...data,
      replyRate: data.contacted ? Math.round((data.replies / data.contacted) * 100) : 0
    }))
  });
}
