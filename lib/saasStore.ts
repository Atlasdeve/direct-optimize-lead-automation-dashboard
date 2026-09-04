import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const defaultOrganizationId = "org_direct_optimize";

export const saasPlans = {
  starter: {
    label: "Starter",
    monthlyPriceCents: 9900,
    setupFeeCents: 10000,
    description: "Lead dashboard, audits, manual outreach, and basic tracking."
  },
  growth: {
    label: "Growth",
    monthlyPriceCents: 29900,
    setupFeeCents: 25000,
    description: "Automated discovery, email tracking, reminders, and client portal."
  },
  agency_pro: {
    label: "Agency/Pro",
    monthlyPriceCents: 79900,
    setupFeeCents: 50000,
    description: "Multiple users, employee portal, calling, AI pitch, countries, and reports."
  }
} as const;

export type SaasPlan = keyof typeof saasPlans;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function normalizeMoneyCents(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number * 100);
}

function maskSecret(value?: string | null) {
  if (!value) return false;
  return true;
}

export async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { slug: "direct-optimize" },
    update: {},
    create: {
      id: defaultOrganizationId,
      name: "Direct Optimize",
      slug: "direct-optimize",
      companyName: "Direct Optimize",
      plan: "agency_pro",
      billingStatus: "active",
      setupFeeStatus: "paid",
      monthlyPriceCents: saasPlans.agency_pro.monthlyPriceCents,
      setupFeeCents: saasPlans.agency_pro.setupFeeCents,
      systemStatus: "active"
    }
  });
}

export async function listOrganizations() {
  await ensureDefaultOrganization();
  const organizations = await prisma.organization.findMany({
    include: {
      apiSettings: true,
      users: {
        where: { role: { in: ["admin", "manager"] } },
        select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      },
      _count: {
        select: {
          users: true,
          leads: true,
          clientProjects: true,
          notifications: true
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    companyName: organization.companyName,
    logoUrl: organization.logoUrl,
    brandColor: organization.brandColor,
    plan: organization.plan,
    planLabel: saasPlans[organization.plan as SaasPlan]?.label ?? organization.plan,
    billingStatus: organization.billingStatus,
    setupFeeStatus: organization.setupFeeStatus,
    monthlyPriceCents: organization.monthlyPriceCents,
    setupFeeCents: organization.setupFeeCents,
    systemStatus: organization.systemStatus,
    customDomain: organization.customDomain,
    subdomain: organization.subdomain,
    trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
    createdAt: organization.createdAt.toISOString(),
    counts: organization._count,
    admins: organization.users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString()
    })),
    apiReadiness: {
      googlePlaces: maskSecret(organization.apiSettings?.googlePlacesApiKey),
      googleSearch: maskSecret(organization.apiSettings?.googleSearchApiKey) && maskSecret(organization.apiSettings?.googleSearchCx),
      email: maskSecret(organization.apiSettings?.brevoApiKey) || (maskSecret(organization.apiSettings?.smtpHost) && maskSecret(organization.apiSettings?.smtpUser)),
      calling: maskSecret(organization.apiSettings?.telnyxApiKey) && maskSecret(organization.apiSettings?.telnyxConnectionId),
      ai: maskSecret(organization.apiSettings?.openaiApiKey)
    }
  }));
}

export async function createOrganization(input: {
  name: unknown;
  companyName?: unknown;
  slug?: unknown;
  plan?: unknown;
  billingStatus?: unknown;
  setupFeeStatus?: unknown;
  monthlyPrice?: unknown;
  setupFee?: unknown;
  customDomain?: unknown;
  subdomain?: unknown;
  logoUrl?: unknown;
  brandColor?: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 160) : "";
  if (!name) throw new Error("Client/company name is required.");
  const plan = Object.keys(saasPlans).includes(String(input.plan)) ? String(input.plan) as SaasPlan : "starter";
  const planDefaults = saasPlans[plan];
  const slug = slugify(typeof input.slug === "string" && input.slug ? input.slug : name);
  if (!slug) throw new Error("A valid client URL slug is required.");
  const companyName = typeof input.companyName === "string" && input.companyName.trim() ? input.companyName.trim().slice(0, 160) : name;
  const brandColor = typeof input.brandColor === "string" && /^#[0-9a-f]{6}$/i.test(input.brandColor) ? input.brandColor : "#38bdf8";
  const customDomain = typeof input.customDomain === "string" && input.customDomain.trim() ? input.customDomain.trim().toLowerCase() : null;
  const subdomain = typeof input.subdomain === "string" && input.subdomain.trim() ? slugify(input.subdomain) : slug;

  return prisma.organization.create({
    data: {
      name,
      companyName,
      slug,
      logoUrl: typeof input.logoUrl === "string" && input.logoUrl.trim() ? input.logoUrl.trim() : null,
      brandColor,
      plan,
      billingStatus: typeof input.billingStatus === "string" ? input.billingStatus : "trial",
      setupFeeStatus: typeof input.setupFeeStatus === "string" ? input.setupFeeStatus : "pending",
      monthlyPriceCents: normalizeMoneyCents(input.monthlyPrice, planDefaults.monthlyPriceCents),
      setupFeeCents: normalizeMoneyCents(input.setupFee, planDefaults.setupFeeCents),
      systemStatus: "active",
      customDomain,
      subdomain,
      apiSettings: { create: {} }
    }
  });
}

export async function updateOrganization(id: string, input: Record<string, unknown>) {
  const data: Prisma.OrganizationUpdateInput = {};
  if (typeof input.name === "string" && input.name.trim()) data.name = input.name.trim().slice(0, 160);
  if (typeof input.companyName === "string" && input.companyName.trim()) data.companyName = input.companyName.trim().slice(0, 160);
  if (typeof input.logoUrl === "string") data.logoUrl = input.logoUrl.trim() || null;
  if (typeof input.brandColor === "string" && /^#[0-9a-f]{6}$/i.test(input.brandColor)) data.brandColor = input.brandColor;
  if (typeof input.plan === "string" && Object.keys(saasPlans).includes(input.plan)) data.plan = input.plan;
  if (typeof input.billingStatus === "string") data.billingStatus = input.billingStatus;
  if (typeof input.setupFeeStatus === "string") data.setupFeeStatus = input.setupFeeStatus;
  if (typeof input.systemStatus === "string") data.systemStatus = input.systemStatus;
  if (typeof input.monthlyPrice === "number" || typeof input.monthlyPrice === "string") data.monthlyPriceCents = normalizeMoneyCents(input.monthlyPrice, 0);
  if (typeof input.setupFee === "number" || typeof input.setupFee === "string") data.setupFeeCents = normalizeMoneyCents(input.setupFee, 0);
  if (typeof input.customDomain === "string") data.customDomain = input.customDomain.trim().toLowerCase() || null;
  if (typeof input.subdomain === "string" && input.subdomain.trim()) data.subdomain = slugify(input.subdomain);

  return prisma.organization.update({ where: { id }, data });
}

export async function updateOrganizationApiSettings(organizationId: string, input: Record<string, unknown>) {
  const keys = [
    "googlePlacesApiKey",
    "googleSearchApiKey",
    "googleSearchCx",
    "brevoApiKey",
    "brevoSmtpKey",
    "smtpHost",
    "smtpUser",
    "smtpPass",
    "telnyxApiKey",
    "telnyxConnectionId",
    "telnyxPhoneNumber",
    "openaiApiKey",
    "leadCaptureApiKey", "primaryCtaLabel", "primaryCtaUrl", "secondaryCtaLabel", "secondaryCtaUrl"
  ] as const;
  const data: Prisma.OrganizationApiSettingUpdateInput = {};
  for (const key of keys) {
    if (typeof input[key] === "string") data[key] = input[key].trim() || null;
  }
  if (typeof input.smtpPort === "number" || typeof input.smtpPort === "string") {
    const port = Number(input.smtpPort);
    data.smtpPort = Number.isFinite(port) && port > 0 ? Math.round(port) : null;
  }
  if (typeof input.smtpSecure === "boolean") data.smtpSecure = input.smtpSecure;
  const createData: Prisma.OrganizationApiSettingUncheckedCreateInput = { organizationId };
  Object.assign(createData, data);

  return prisma.organizationApiSetting.upsert({
    where: { organizationId },
    update: data,
    create: createData
  });
}

export async function createOrganizationAdmin(organizationId: string, input: {
  name: unknown;
  email: unknown;
  username?: unknown;
  password: unknown;
}) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) throw new Error("Client workspace was not found.");

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const usernameSource = typeof input.username === "string" && input.username.trim() ? input.username : email.split("@")[0];
  const username = usernameSource.trim().toLowerCase();
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 160) : username;
  const password = typeof input.password === "string" ? input.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid admin email address.");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username must be 3-32 lowercase letters, numbers, dots, underscores, or hyphens.");
  if (password.length < 12) throw new Error("Temporary password must be at least 12 characters.");

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { id: true } });
  if (existing) throw new Error("A user with that email or username already exists.");

  return prisma.user.create({
    data: {
      organizationId,
      email,
      username,
      name,
      role: "admin",
      passwordHash: await bcrypt.hash(password, 12)
    },
    select: { id: true, email: true, username: true, name: true, role: true, organizationId: true }
  });
}

export async function deleteOrganizationAdmin(organizationId: string, userId: unknown) {
  const id = typeof userId === "string" ? userId : "";
  if (!id) throw new Error("Admin account id is required.");
  const user = await prisma.user.findFirst({
    where: {
      id,
      organizationId,
      role: { in: ["admin", "manager"] }
    },
    select: { id: true }
  });
  if (!user) throw new Error("Client admin account was not found.");
  return prisma.user.delete({ where: { id } });
}
