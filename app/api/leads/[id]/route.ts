import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { deleteDbLead, getDbLead, updateDbLeadDetails } from "@/lib/dbStore";

const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const nullableUrl = z.string().trim().max(2048).transform((value, context) => {
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid URL." });
    return z.NEVER;
  }
});
const leadDetailsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(200),
  city: nullableText(120),
  category: nullableText(160),
  businessType: nullableText(160),
  email: z.string().trim().max(320).transform((value, context) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (!z.string().email().safeParse(normalized).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address." });
      return z.NEVER;
    }
    return normalized;
  }),
  phone: nullableText(50),
  website: nullableUrl,
  googleMapsUrl: nullableUrl,
  ownerName: nullableText(160),
  ceoName: nullableText(160),
  managerName: nullableText(160),
  decisionMakerName: nullableText(160),
  decisionMakerTitle: nullableText(160),
  linkedinUrl: nullableUrl
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getDbLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await deleteDbLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ deleted: true, lead });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = leadDetailsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid lead details." }, { status: 400 });
  }

  const { id } = await params;
  const lead = await updateDbLeadDetails(id, parsed.data);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}
