import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getDbLead } from "@/lib/dbStore";
import { buildLocalCompetitorBenchmark } from "@/lib/localCompetitorBenchmark";
import { withOrganizationProviderEnv } from "@/lib/organizationSettings";
import { isOperationsRole } from "@/lib/roles";

const benchmarkRequest = z.object({
  leadId: z.string().trim().min(1).max(191),
  keywords: z.array(z.string().trim().min(2).max(120)).max(4).optional()
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = benchmarkRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a business and provide up to four search keywords." }, { status: 400 });

  const lead = await getDbLead(parsed.data.leadId, user.organizationId);
  if (!lead) return NextResponse.json({ error: "Business record not found." }, { status: 404 });

  try {
    const benchmark = await withOrganizationProviderEnv(user.organizationId, () => buildLocalCompetitorBenchmark(lead, {
      keywords: parsed.data.keywords
    }));
    return NextResponse.json({ benchmark });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competitor comparison could not be completed." }, { status: 400 });
  }
}
