import { NextRequest, NextResponse } from "next/server";
import { createComposeEmailLog, updateComposeEmailLogResult } from "@/lib/dbStore";
import { sendComposedEmail } from "@/lib/providers";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const to = cleanString(body.to);
  const subject = cleanString(body.subject);
  const heading = cleanString(body.heading);
  const message = cleanString(body.message);
  const ctaLabel = cleanString(body.ctaLabel);
  const ctaUrl = cleanString(body.ctaUrl);

  if (!validEmail(to)) {
    return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
  }
  if (subject.length < 3) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (heading.length < 3) {
    return NextResponse.json({ error: "Template heading is required." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Message should be at least 10 characters." }, { status: 400 });
  }

  const log = await createComposeEmailLog({
    to,
    subject,
    heading,
    body: message,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined
  });

  const result = await sendComposedEmail({
    to,
    subject,
    heading,
    body: message,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined
  }, { trackingLogId: log.id });

  await updateComposeEmailLogResult(log.id, result);

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Email send failed.", result: { ...result, logId: log.id } }, { status: 400 });
  }

  return NextResponse.json({ result: { ...result, logId: log.id, trackingEnabled: true } });
}
