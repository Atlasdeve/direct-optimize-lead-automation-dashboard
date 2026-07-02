import { NextRequest, NextResponse } from "next/server";
import { listContactFormQueue, listDbLeads, listDbReplies } from "@/lib/dbStore";
import { leadOpportunitySummary, leadTemperature, nextBestAction } from "@/lib/leadStrategy";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  const [leads, forms, replies] = await Promise.all([
    listDbLeads(region),
    listContactFormQueue(region),
    listDbReplies()
  ]);
  const regionReplies = region ? replies.filter((reply) => leads.some((lead) => lead.id === reply.leadId)) : replies;
  const categories = new Map<string, { leads: number; emails: number; forms: number; contacted: number; replies: number }>();
  const temperatureRows = { Hot: 0, Warm: 0, Cold: 0 };
  const actionRows = new Map<string, number>();

  for (const lead of leads) {
    const key = lead.category || "Uncategorized";
    const row = categories.get(key) ?? { leads: 0, emails: 0, forms: 0, contacted: 0, replies: 0 };
    row.leads += 1;
    if (lead.email) row.emails += 1;
    if ((lead.contact_forms?.length ?? 0) > 0) row.forms += 1;
    if (lead.email_sent || lead.whatsapp_sent) row.contacted += 1;
    if (lead.replied) row.replies += 1;
    categories.set(key, row);
    temperatureRows[leadTemperature(lead)] += 1;
    const action = nextBestAction(lead);
    actionRows.set(action, (actionRows.get(action) ?? 0) + 1);
  }

  const contacted = leads.filter((lead) => lead.email_sent || lead.whatsapp_sent).length;
  const emailsFound = leads.filter((lead) => lead.email).length;
  const formReady = leads.filter((lead) => (lead.contact_forms?.length ?? 0) > 0).length;
  const hotLeads = leads.filter((lead) => leadOpportunitySummary(lead).temperature === "Hot").length;

  return NextResponse.json({
    summary: {
      leads: leads.length,
      hotLeads,
      emailsFound,
      formsFound: forms.length,
      contactCoverage: leads.length ? Math.round(((emailsFound + formReady) / leads.length) * 100) : 0,
      emailsSent: leads.filter((lead) => lead.email_sent).length,
      formsSubmitted: forms.filter((form) => form.status === "submitted").length,
      replies: regionReplies.length,
      replyRate: contacted ? Math.round((regionReplies.length / contacted) * 100) : 0,
      meetings: leads.filter((lead) => lead.outreach_status === "Meeting Booked").length,
      pendingFollowUps: leads.filter((lead) => lead.outreach_status === "Follow-up" || (lead.email_sent && !lead.replied)).length,
      failedOrBounced: leads.filter((lead) => lead.outreach_status === "Failed" || lead.do_not_contact).length
    },
    temperatures: Object.entries(temperatureRows).map(([name, value]) => ({ name, value })),
    nextActions: [...actionRows.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    categories: [...categories.entries()].map(([category, data]) => ({
      category,
      ...data,
      replyRate: data.contacted ? Math.round((data.replies / data.contacted) * 100) : 0
    }))
  });
}
