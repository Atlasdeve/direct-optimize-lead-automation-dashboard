import { prisma } from "@/lib/prisma";
import { regions as defaultRegions } from "@/lib/regions";
import type { RegionConfig } from "@/lib/types";

function withDefaultCron(region: { name: string; country: string; timezone: string }): RegionConfig {
  const defaultRegion = defaultRegions.find((item) => item.name === region.name);
  return {
    name: region.name,
    country: region.country,
    timezone: region.timezone,
    morningCron: defaultRegion?.morningCron ?? "0 9 * * *"
  };
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

export async function listEnabledRegions() {
  await ensureDefaultRegions();
  const rows = await prisma.region.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
    select: { name: true, country: true, timezone: true }
  });
  return rows.map(withDefaultCron);
}

export async function getSavedRegion(name: string) {
  await ensureDefaultRegions();
  const row = await prisma.region.findUnique({
    where: { name },
    select: { name: true, country: true, timezone: true, enabled: true }
  });
  if (!row || !row.enabled) return null;
  return withDefaultCron(row);
}

export async function createRegion(input: { name: string; country: string; timezone: string }) {
  const name = input.name.trim();
  const country = input.country.trim();
  const timezone = input.timezone.trim();
  if (name.length < 2 || name.length > 40) throw new Error("Country tab name should be 2-40 characters.");
  if (country.length < 2 || country.length > 80) throw new Error("Country name should be 2-80 characters.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("Enter a valid timezone, for example Australia/Sydney.");
  }
  const row = await prisma.region.upsert({
    where: { name },
    update: { country, timezone, enabled: true },
    create: { name, country, timezone, enabled: true },
    select: { name: true, country: true, timezone: true }
  });
  return withDefaultCron(row);
}
