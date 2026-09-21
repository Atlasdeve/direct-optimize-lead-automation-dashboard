import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOperationsRole } from "@/lib/roles";

const requestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(500).transform((ids) => [...new Set(ids)])
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select between 1 and 500 leads to delete." }, { status: 400 });
  }

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: parsed.data.ids },
      ...(user.organizationId ? { organizationId: user.organizationId } : {})
    },
    select: { id: true }
  });
  const deletedIds = leads.map((lead) => lead.id);
  if (!deletedIds.length) {
    return NextResponse.json({ error: "No matching leads were found." }, { status: 404 });
  }

  const result = await prisma.lead.deleteMany({ where: { id: { in: deletedIds } } });
  return NextResponse.json({ deleted: true, deletedCount: result.count, deletedIds });
}
