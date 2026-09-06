import { prisma } from "@/lib/prisma";

const leadDiscoveryAutomationKey = "lead_discovery_automation";

function storageKey(organizationId?: string | null) {
  return organizationId ? `${leadDiscoveryAutomationKey}:${organizationId}` : leadDiscoveryAutomationKey;
}

export async function getLeadDiscoveryAutomationEnabled(organizationId?: string | null) {
  const setting = await prisma.setting.findUnique({ where: { key: storageKey(organizationId) } });
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? setting.value as Record<string, unknown>
    : {};
  return value.enabled !== false;
}

export async function saveLeadDiscoveryAutomationEnabled(enabled: boolean, organizationId?: string | null) {
  await prisma.setting.upsert({
    where: { key: storageKey(organizationId) },
    update: { value: { enabled } },
    create: { key: storageKey(organizationId), value: { enabled } }
  });
  return enabled;
}
