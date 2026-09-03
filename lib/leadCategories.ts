import { prisma } from "@/lib/prisma";
import { businessDiscoveryCategories } from "@/lib/discoveryTargets";

const leadCategoriesKey = "lead_discovery_categories";

function categoryStorageKey(organizationId?: string | null) {
  return organizationId ? `${leadCategoriesKey}:${organizationId}` : leadCategoriesKey;
}

export function normalizeLeadCategories(input: unknown) {
  const source = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const seen = new Set<string>();
  return source
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length > 1 && item.length <= 80)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}

export async function getLeadDiscoveryCategories(organizationId?: string | null) {
  const setting = await prisma.setting.findUnique({ where: { key: categoryStorageKey(organizationId) } });
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? setting.value as Record<string, unknown>
    : {};
  const categories = normalizeLeadCategories(value.categories);
  return categories.length ? categories : businessDiscoveryCategories;
}

export async function saveLeadDiscoveryCategories(input: unknown, organizationId?: string | null) {
  const categories = normalizeLeadCategories(input);
  if (!categories.length) throw new Error("Add at least one lead-search category.");
  await prisma.setting.upsert({
    where: { key: categoryStorageKey(organizationId) },
    update: { value: { categories } },
    create: { key: categoryStorageKey(organizationId), value: { categories } }
  });
  return categories;
}
