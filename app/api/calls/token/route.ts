import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getOrganizationApiConfig } from "@/lib/organizationSettings";
import { createTelnyxAccessToken, telnyxCallingConfigured } from "@/lib/telnyxCalling";

export async function GET() {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = user.role === "super_admin" ? null : await getOrganizationApiConfig(user.organizationId);
  const telnyxConfig = user.role === "super_admin" ? undefined : {
    apiKey: settings?.telnyxApiKey,
    telephonyCredentialId: settings?.telnyxConnectionId,
    phoneNumber: settings?.telnyxPhoneNumber
  };
  if (!telnyxCallingConfigured(telnyxConfig)) {
    return NextResponse.json({ error: "Telnyx calling is not configured yet." }, { status: 503 });
  }
  try {
    return NextResponse.json({
      token: await createTelnyxAccessToken(telnyxConfig),
      callerNumber: telnyxConfig?.phoneNumber || process.env.TELNYX_PHONE_NUMBER
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create a Telnyx token." }, { status: 502 });
  }
}
