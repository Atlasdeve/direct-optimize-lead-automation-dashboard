import { prisma } from "@/lib/prisma";

export type OrganizationApiConfig = Awaited<ReturnType<typeof getOrganizationApiConfig>>;

export async function getOrganizationApiConfig(organizationId?: string | null) {
  if (!organizationId) return null;
  return prisma.organizationApiSetting.findUnique({ where: { organizationId } });
}

export function organizationCtas(settings: Awaited<ReturnType<typeof getOrganizationApiConfig>>, fallback: Array<{ label: string; url: string; variant?: "primary" | "secondary" }> = []) {
  const stored = [
    settings?.primaryCtaLabel && settings.primaryCtaUrl ? { label: settings.primaryCtaLabel, url: settings.primaryCtaUrl, variant: "primary" as const } : null,
    settings?.secondaryCtaLabel && settings.secondaryCtaUrl ? { label: settings.secondaryCtaLabel, url: settings.secondaryCtaUrl, variant: "secondary" as const } : null
  ].filter((cta): cta is { label: string; url: string; variant: "primary" | "secondary" } => Boolean(cta));
  return stored.length === 2 ? stored : fallback;
}

export function configuredValue(tenantValue?: string | null, envValue?: string) {
  return tenantValue?.trim() || envValue || "";
}

export async function withOrganizationProviderEnv<T>(organizationId: string | null | undefined, task: () => Promise<T>) {
  if (!organizationId) return task();
  if (organizationId === "org_direct_optimize") return task();
  const settings = await getOrganizationApiConfig(organizationId);
  const overrides: Record<string, string | null | undefined> = {
    GOOGLE_PLACES_API_KEY: settings?.googlePlacesApiKey,
    GOOGLE_SEARCH_API_KEY: settings?.googleSearchApiKey,
    GOOGLE_SEARCH_CX: settings?.googleSearchCx,
    BREVO_API_KEY: settings?.brevoApiKey,
    SMTP_HOST: settings?.smtpHost,
    SMTP_PORT: settings?.smtpPort ? String(settings.smtpPort) : undefined,
    SMTP_USER: settings?.smtpUser,
    SMTP_PASS: settings?.smtpPass,
    SMTP_FROM: settings?.smtpUser,
    TELNYX_API_KEY: settings?.telnyxApiKey,
    TELNYX_CALL_CONTROL_CONNECTION_ID: settings?.telnyxConnectionId,
    TELNYX_PHONE_NUMBER: settings?.telnyxPhoneNumber,
    OPENAI_API_KEY: settings?.openaiApiKey
  };
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
  try {
    return await task();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
