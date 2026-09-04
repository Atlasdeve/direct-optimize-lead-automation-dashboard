import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getOrganizationApiConfig } from "@/lib/organizationSettings";
import { providerSettings } from "@/lib/templates";
import { isAdminRole } from "@/lib/roles";
import { updateOrganizationApiSettings } from "@/lib/saasStore";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantApiSettings = user.role === "super_admin" ? undefined : await getOrganizationApiConfig(user.organizationId);
  return NextResponse.json({ settings: providerSettings(tenantApiSettings) });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || !isAdminRole(user.role) || user.role === "super_admin" || !user.organizationId) {
    return NextResponse.json({ error: "Only a client administrator can update workspace provider settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = [
    "googlePlacesApiKey", "googleSearchApiKey", "googleSearchCx", "brevoApiKey", "brevoSmtpKey",
    "smtpHost", "smtpUser", "smtpPass", "telnyxApiKey", "telnyxConnectionId", "telnyxPhoneNumber", "openaiApiKey",
    "primaryCtaLabel", "primaryCtaUrl", "secondaryCtaLabel", "secondaryCtaUrl"
  ];
  const input: Record<string, unknown> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string" && body[key].trim()) input[key] = body[key];
  }
  if (body.clearSecrets === true) {
    for (const key of allowed) input[key] = null;
  }
  if (body.smtpPort !== undefined) input.smtpPort = body.smtpPort;
  if (typeof body.smtpSecure === "boolean") input.smtpSecure = body.smtpSecure;

  await updateOrganizationApiSettings(user.organizationId, input);
  const settings = await getOrganizationApiConfig(user.organizationId);
  return NextResponse.json({ settings: providerSettings(settings), message: "Workspace provider settings saved." });
}
