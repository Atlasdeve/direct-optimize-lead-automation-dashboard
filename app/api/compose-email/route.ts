import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createComposeEmailLog, updateComposeEmailLogResult } from "@/lib/dbStore";
import { getOrganizationApiConfig, organizationCtas } from "@/lib/organizationSettings";
import { sendComposedEmail } from "@/lib/providers";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function appBaseUrl() {
  return (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function workspaceDefaultCtas(user: Awaited<ReturnType<typeof currentUser>>) {
  const workspaceName = user?.organization?.companyName || "Direct Optimize";
  if (!user?.organization?.slug || user.organization.slug === "direct-optimize") {
    return [
      { label: "Visit Direct Optimize", url: "https://directoptimize.com", variant: "primary" as const },
      { label: "Create Your Portal", url: "https://directoptimize.com/client-portal/", variant: "secondary" as const }
    ];
  }
  const portalUrl = `${appBaseUrl()}/o/${user.organization.slug}/login`;
  return [
    { label: `Visit ${workspaceName}`, url: portalUrl, variant: "primary" as const },
    { label: "Open Your Portal", url: portalUrl, variant: "secondary" as const }
  ];
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !["super_admin", "admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    organizationId: user.organizationId,
    to,
    subject,
    heading,
    body: message,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined
  });

  const settings = user.role === "super_admin" ? null : await getOrganizationApiConfig(user.organizationId);
  const defaultCtas = organizationCtas(settings, workspaceDefaultCtas(user));
  const result = await sendComposedEmail({
    to,
    subject,
    heading,
    body: message,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined
  }, {
    trackingLogId: log.id,
    config: user.role === "super_admin" ? undefined : {
      brevoApiKey: settings?.brevoApiKey,
      smtpHost: settings?.smtpHost,
      smtpPort: settings?.smtpPort,
      smtpUser: settings?.smtpUser,
      smtpPass: settings?.smtpPass,
      smtpFrom: settings?.smtpUser,
      smtpFromName: user.organization?.companyName,
      brandName: user.organization?.companyName,
      defaultCtas
    }
  });

  await updateComposeEmailLogResult(log.id, result);

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Email send failed.", result: { ...result, logId: log.id } }, { status: 400 });
  }

  return NextResponse.json({ result: { ...result, logId: log.id, trackingEnabled: Boolean(result.trackingEnabled) } });
}
