import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { createDbLeadFromExtension } from "@/lib/dbStore";
import { prohibitedLeadTerm } from "@/lib/restrictedLeadPolicy";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

const leadCaptureSchema = z.object({
  region: z.string().trim().min(2).max(80),
  companyName: z.string().trim().min(1).max(200),
  website: z.string().trim().url().max(2048),
  pageTitle: z.string().trim().max(250).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(50).optional().nullable(),
  category: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable()
});

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) }
  });
}

async function authorized(request: NextRequest) {
  const configuredKey = process.env.LEAD_CAPTURE_API_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (configuredKey && bearer && bearer === configuredKey) return { organizationId: "org_direct_optimize" };
  if (bearer) {
    const tenant = await prisma.organizationApiSetting.findFirst({ where: { leadCaptureApiKey: bearer }, select: { organizationId: true } });
    if (tenant) return { organizationId: tenant.organizationId };
  }
  const user = await currentUser().catch(() => null);
  return user && isOperationsRole(user.role) ? { organizationId: user.organizationId } : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const authorization = await authorized(request);
  if (!authorization) {
    return json({ error: "Unauthorized. Add LEAD_CAPTURE_API_KEY to the app and extension settings." }, { status: 401 });
  }

  const parsed = leadCaptureSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message || "Invalid lead capture payload." }, { status: 400 });
  }

  const blockedTerm = prohibitedLeadTerm(
    parsed.data.companyName,
    parsed.data.website,
    parsed.data.pageTitle,
    parsed.data.description,
    parsed.data.category
  );
  if (blockedTerm) {
    return json({ error: `This category cannot be imported through lead capture (${blockedTerm}).` }, { status: 400 });
  }

  try {
    const result = await createDbLeadFromExtension({
      regionName: parsed.data.region,
      companyName: parsed.data.companyName,
      website: parsed.data.website,
      pageTitle: parsed.data.pageTitle,
      description: parsed.data.description,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      category: parsed.data.category,
      city: parsed.data.city,
      organizationId: authorization.organizationId
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Lead could not be captured." }, { status: 400 });
  }
}
