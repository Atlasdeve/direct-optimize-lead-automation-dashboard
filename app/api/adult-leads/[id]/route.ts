import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { deleteAdultLead, updateAdultLead } from "@/lib/adultLeadStore";

const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const website = z.string().trim().min(1, "Website is required.").max(2048).transform((value, context) => {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    url.hash = "";
    return url.toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid website URL." });
    return z.NEVER;
  }
});

const updateSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required.").max(200).optional(),
  country: z.string().trim().min(2).max(80).regex(/^[A-Za-z][A-Za-z .'-]*$/, "Enter a valid country name.").optional(),
  city: nullableText(120).optional(),
  category: z.enum(["adult_products", "sexual_wellness", "dating_platforms", "adult_entertainment", "casino", "betting", "cannabis"]).optional(),
  website: website.optional(),
  email: z.string().trim().max(320).transform((value, context) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (!z.string().email().safeParse(normalized).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address." });
      return z.NEVER;
    }
    return normalized;
  }).optional(),
  phone: nullableText(50).optional(),
  reviewStatus: z.enum(["Unverified", "Reviewed", "Rejected"]).optional(),
  notes: z.string().max(2000).nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "No changes were provided.");

async function requireAdmin() {
  const user = await currentUser();
  return user && isOperationsRole(user.role) ? user : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update." }, { status: 400 });
  }
  try {
    const { id } = await params;
    return NextResponse.json({ lead: await updateAdultLead(id, { ...parsed.data, organizationId: user.organizationId }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    await deleteAdultLead(id, user.organizationId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead could not be deleted." }, { status: 400 });
  }
}
