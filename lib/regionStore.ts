import { prisma } from "@/lib/prisma";
import { regions as defaultRegions } from "@/lib/regions";
import type { RegionConfig } from "@/lib/types";

function encodeTenantRegionName(organizationId: string, label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "region";
  return `tenant:${organizationId}:${slug}`;
}

function tenantRegionLabel(name: string, country: string) {
  if (!name.startsWith("tenant:")) return undefined;
  return country;
}

function withDefaultCron(region: { name: string; country: string; timezone: string }): RegionConfig {
  const defaultRegion = defaultRegions.find((item) => item.name === region.name);
  return {
    name: region.name,
    label: tenantRegionLabel(region.name, region.country),
    country: region.country,
    timezone: region.timezone,
    morningCron: defaultRegion?.morningCron ?? "0 9 * * *"
  };
}

function sortRegions(rows: RegionConfig[]) {
  const defaultOrder = new Map(defaultRegions.map((region, index) => [region.name, index]));
  return [...rows].sort((left, right) => {
    const leftOrder = defaultOrder.get(left.name);
    const rightOrder = defaultOrder.get(right.name);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return (left.label || left.name).localeCompare(right.label || right.name);
  });
}

export async function ensureDefaultRegions() {
  await Promise.all(defaultRegions.map((region) => prisma.region.upsert({
    where: { name: region.name },
    update: {
      country: region.country,
      timezone: region.timezone,
      enabled: true
    },
    create: {
      name: region.name,
      country: region.country,
      timezone: region.timezone,
      enabled: true
    }
  })));
}

export async function listEnabledRegions(organizationId?: string | null) {
  await ensureDefaultRegions();
  const rows = await prisma.region.findMany({
    where: {
      enabled: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : [])
      ]
    },
    orderBy: { createdAt: "asc" },
    select: { name: true, country: true, timezone: true }
  });
  return sortRegions(rows.map(withDefaultCron));
}

export async function getSavedRegion(name: string, organizationId?: string | null) {
  await ensureDefaultRegions();
  const row = await prisma.region.findFirst({
    where: {
      name,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : [])
      ]
    },
    select: { name: true, country: true, timezone: true, enabled: true }
  });
  if (!row || !row.enabled) return null;
  return withDefaultCron(row);
}

export async function createRegion(input: { name: string; country: string; timezone: string; organizationId?: string | null }) {
  const displayName = input.name.trim();
  const country = input.country.trim();
  const timezone = input.timezone.trim();
  if (displayName.length < 2 || displayName.length > 40) throw new Error("Country tab name should be 2-40 characters.");
  if (country.length < 2 || country.length > 80) throw new Error("Country name should be 2-80 characters.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("Enter a valid timezone, for example Australia/Sydney.");
  }
  const name = input.organizationId ? encodeTenantRegionName(input.organizationId, displayName) : displayName;
  const row = await prisma.region.upsert({
    where: { name },
    update: { country, timezone, enabled: true, organizationId: input.organizationId || undefined },
    create: { name, country, timezone, enabled: true, organizationId: input.organizationId || undefined },
    select: { name: true, country: true, timezone: true }
  });
  return withDefaultCron(row);
}
