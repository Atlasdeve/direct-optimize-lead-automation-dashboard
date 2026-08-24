import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordLeadWebsiteVisit } from "@/lib/dbStore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

const liveVisitSchema = z.object({
  leadId: z.string().trim().min(8).max(120).optional().nullable(),
  utmContent: z.string().trim().max(160).optional().nullable(),
  visitorId: z.string().trim().min(8).max(120),
  pageUrl: z.string().trim().max(2048).optional().nullable(),
  pageTitle: z.string().trim().max(250).optional().nullable(),
  referrer: z.string().trim().max(2048).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
  utmTerm: z.string().trim().max(120).optional().nullable()
});

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) }
  });
}

function leadIdFromPayload(input: { leadId?: string | null; utmContent?: string | null }) {
  if (input.leadId) return input.leadId;
  const match = input.utmContent?.match(/^lead_(.+)$/);
  return match?.[1] ?? null;
}

function requestMeta(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const parsed = liveVisitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid live visit payload." }, { status: 400 });

  const leadId = leadIdFromPayload(parsed.data);
  if (!leadId) return json({ recorded: false, reason: "No lead attribution found." }, { status: 202 });

  const result = await recordLeadWebsiteVisit({
    leadId,
    visitorId: parsed.data.visitorId,
    pageUrl: parsed.data.pageUrl,
    pageTitle: parsed.data.pageTitle,
    referrer: parsed.data.referrer,
    utmCampaign: parsed.data.utmCampaign,
    utmTerm: parsed.data.utmTerm,
    ...requestMeta(request)
  });
  return json(result, { status: result.recorded ? 200 : 202 });
}
