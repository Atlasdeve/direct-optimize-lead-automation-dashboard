import { adultLeadCategories, type AdultLeadCategoryId } from "@/lib/adultLeadCategories";
import { createAppNotification } from "@/lib/appNotifications";
import { discoverAdultLeads, listAdultLeadCountries } from "@/lib/adultLeadStore";
import { getOutreachAutomationSettings, remainingDailyEmailAllowance } from "@/lib/dbStore";
import { getCityOptionsForRegion } from "@/lib/discoveryTargets";
import { prisma } from "@/lib/prisma";
import { buildPersonalizedEmail, sendEmailOutreach } from "@/lib/providers";
import type { Lead } from "@/lib/types";

const automationKey = "adult-leads:automation";
const defaultSettings: AdultLeadAutomationSettings = {
  enabled: true,
  localHour: 9,
  maxResults: 5
};

const countryTimezones: Record<string, string> = {
  Nigeria: "Africa/Lagos",
  Thailand: "Asia/Bangkok",
  Vietnam: "Asia/Ho_Chi_Minh",
  Indonesia: "Asia/Jakarta",
  Philippines: "Asia/Manila",
  Malaysia: "Asia/Kuala_Lumpur",
  Kenya: "Africa/Nairobi",
  "South Africa": "Africa/Johannesburg"
};

export type AdultLeadAutomationSettings = {
  enabled: boolean;
  localHour: number;
  maxResults: number;
};

type AdultLeadRunState = {
  lastRunDate?: string;
  status?: "completed" | "failed";
  city?: string;
  categoryId?: AdultLeadCategoryId;
  created?: number;
  updated?: number;
  error?: string;
};

export type AdultLeadAutomationTarget = {
  country: string;
  city: string;
  categoryId: AdultLeadCategoryId;
  categoryLabel: string;
  timezone: string;
  localDate: string;
  lastRunDate: string | null;
  lastStatus: "completed" | "failed" | null;
  lastCreated: number;
  lastUpdated: number;
  lastError: string | null;
};

export type AdultLeadAutomationOverview = {
  settings: AdultLeadAutomationSettings;
  targets: AdultLeadAutomationTarget[];
};

function hashValue(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function dayNumber(dateKey: string) {
  return Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / 86400000);
}

function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")) % 24,
    weekday: value("weekday")
  };
}

export function timezoneForAdultLeadCountry(country: string) {
  return countryTimezones[country] ?? "UTC";
}

export function getDailyAdultLeadTarget(country: string, dateKey: string) {
  const cities = getCityOptionsForRegion(country, country);
  const index = dayNumber(dateKey) + hashValue(country);
  const category = adultLeadCategories[index % adultLeadCategories.length];
  return {
    city: cities[index % cities.length] || country,
    categoryId: category.id,
    categoryLabel: category.label
  };
}

export async function getAdultLeadAutomationSettings() {
  const setting = await prisma.setting.findUnique({ where: { key: automationKey } });
  const saved = (setting?.value ?? {}) as Partial<AdultLeadAutomationSettings>;
  return {
    enabled: saved.enabled ?? defaultSettings.enabled,
    localHour: Math.min(23, Math.max(0, Number(saved.localHour ?? defaultSettings.localHour))),
    maxResults: Math.min(10, Math.max(1, Number(saved.maxResults ?? defaultSettings.maxResults)))
  };
}

export async function updateAdultLeadAutomationSettings(input: Partial<AdultLeadAutomationSettings>) {
  const current = await getAdultLeadAutomationSettings();
  const value: AdultLeadAutomationSettings = {
    enabled: input.enabled ?? current.enabled,
    localHour: Math.min(23, Math.max(0, Math.round(input.localHour ?? current.localHour))),
    maxResults: Math.min(10, Math.max(1, Math.round(input.maxResults ?? current.maxResults)))
  };
  await prisma.setting.upsert({
    where: { key: automationKey },
    update: { value },
    create: { key: automationKey, value }
  });
  return value;
}

function runKey(country: string) {
  return `cron:adult-leads:${country.toLowerCase()}:daily-discovery`;
}

async function readRunState(country: string) {
  const setting = await prisma.setting.findUnique({ where: { key: runKey(country) } });
  return (setting?.value ?? {}) as AdultLeadRunState;
}

async function writeRunState(country: string, value: AdultLeadRunState) {
  await prisma.setting.upsert({
    where: { key: runKey(country) },
    update: { value },
    create: { key: runKey(country), value }
  });
}

export async function getAdultLeadAutomationOverview(): Promise<AdultLeadAutomationOverview> {
  const [settings, countries] = await Promise.all([
    getAdultLeadAutomationSettings(),
    listAdultLeadCountries()
  ]);
  const targets = await Promise.all(countries.map(async (country): Promise<AdultLeadAutomationTarget> => {
    const timezone = timezoneForAdultLeadCountry(country);
    const local = localClock(timezone);
    const target = getDailyAdultLeadTarget(country, local.date);
    const state = await readRunState(country);
    return {
      country,
      ...target,
      timezone,
      localDate: local.date,
      lastRunDate: state.lastRunDate ?? null,
      lastStatus: state.status ?? null,
      lastCreated: state.created ?? 0,
      lastUpdated: state.updated ?? 0,
      lastError: state.error ?? null
    };
  }));
  return { settings, targets };
}

export async function runDueAdultLeadAutomations() {
  const settings = await getAdultLeadAutomationSettings();
  if (!settings.enabled) return { attempted: 0, created: 0, updated: 0, failed: 0 };

  const countries = await listAdultLeadCountries();
  const results: Array<{ country: string; created: number; updated: number; error?: string }> = [];

  for (const country of countries) {
    const timezone = timezoneForAdultLeadCountry(country);
    const local = localClock(timezone);
    if (local.hour < settings.localHour) continue;
    const previous = await readRunState(country);
    if (previous.lastRunDate === local.date) continue;

    const target = getDailyAdultLeadTarget(country, local.date);
    await writeRunState(country, {
      lastRunDate: local.date,
      status: "failed",
      city: target.city,
      categoryId: target.categoryId,
      created: 0,
      updated: 0,
      error: "Discovery started but did not finish."
    });

    try {
      const result = await discoverAdultLeads({
        country,
        city: target.city,
        categoryId: target.categoryId,
        limit: settings.maxResults
      });
      await writeRunState(country, {
        lastRunDate: local.date,
        status: "completed",
        city: target.city,
        categoryId: target.categoryId,
        created: result.created,
        updated: result.updated
      });
      results.push({ country, created: result.created, updated: result.updated });
      console.log(`Adult Lead discovery: ${country}, ${target.categoryLabel} in ${target.city}, ${result.created} created.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discovery failed.";
      await writeRunState(country, {
        lastRunDate: local.date,
        status: "failed",
        city: target.city,
        categoryId: target.categoryId,
        created: 0,
        updated: 0,
        error: message
      });
      results.push({ country, created: 0, updated: 0, error: message });
      console.error(`Adult Lead discovery failed for ${country}:`, error);
    }
  }

  if (results.length > 0) {
    const failed = results.filter((result) => result.error).length;
    const created = results.reduce((sum, result) => sum + result.created, 0);
    const updated = results.reduce((sum, result) => sum + result.updated, 0);
    await createAppNotification({
      type: failed > 0 ? "failure" : "automation",
      title: failed > 0 ? "Adult Lead automation needs attention" : "Adult Lead automation completed",
      message: `${results.length} countr${results.length === 1 ? "y" : "ies"} processed: ${created} new, ${updated} refreshed, ${failed} failed.`,
      actionUrl: "/adult-leads"
    });
  }

  return {
    attempted: results.length,
    created: results.reduce((sum, result) => sum + result.created, 0),
    updated: results.reduce((sum, result) => sum + result.updated, 0),
    failed: results.filter((result) => result.error).length
  };
}

function adultLeadAsOutreachLead(lead: {
  id: string;
  businessName: string;
  country: string;
  city: string | null;
  category: string;
  website: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  outreachApprovedAt: Date | null;
  emailSent: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Lead {
  return {
    id: lead.id,
    company_name: lead.businessName,
    region: lead.country,
    country: lead.country,
    city: lead.city ?? "",
    category: lead.category,
    business_type: lead.category,
    website: lead.website,
    google_maps_url: null,
    phone: lead.phone,
    email: lead.email,
    whatsapp_available: false,
    whatsapp_status: "unknown",
    source_platform: "adult_lead_research",
    lead_score: 0,
    outreach_status: "Approved",
    outreach_approved: true,
    outreach_approved_at: lead.outreachApprovedAt?.toISOString() ?? null,
    email_sent: lead.emailSent,
    email_opened: lead.emailOpened,
    email_clicked: lead.emailClicked,
    whatsapp_sent: false,
    replied: false,
    last_contacted_at: lead.lastContactedAt?.toISOString() ?? null,
    notes: lead.notes,
    do_not_contact: false,
    consent_status: "legitimate_interest",
    unsubscribed: false,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString()
  };
}

function adultLeadSendingWindow(country: string) {
  const timezone = timezoneForAdultLeadCountry(country);
  const local = localClock(timezone);
  const businessHoursOnly = process.env.OUTREACH_EMAIL_BUSINESS_HOURS_ONLY !== "false";
  const inBusinessWindow = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(local.weekday)
    && local.hour >= 9
    && local.hour < 17;
  return {
    allowed: !businessHoursOnly || inBusinessWindow,
    timezone
  };
}

export async function sendApprovedAdultLeadEmails(country: string, limit: number) {
  const window = adultLeadSendingWindow(country);
  if (!window.allowed) {
    return {
      country,
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      logs: [`Sending is paused outside Monday-Friday 09:00-17:00 in ${window.timezone}.`]
    };
  }

  const remaining = await remainingDailyEmailAllowance();
  const take = Math.max(0, Math.min(limit, remaining));
  if (take === 0) {
    return {
      country,
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      logs: ["The daily email cap has been reached."]
    };
  }

  const rows = await prisma.adultLead.findMany({
    where: {
      country,
      reviewStatus: "Reviewed",
      outreachApproved: true,
      outreachStatus: "Approved",
      emailSent: false,
      email: { not: null }
    },
    orderBy: [{ outreachApprovedAt: "asc" }, { createdAt: "asc" }],
    take
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const row of rows) {
    const claimed = await prisma.adultLead.updateMany({
      where: {
        id: row.id,
        outreachApproved: true,
        emailSent: false,
        outreachStatus: "Approved"
      },
      data: { outreachStatus: "Sending" }
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    const lead = adultLeadAsOutreachLead(row);
    const preview = buildPersonalizedEmail(lead, "website, SEO, and online visibility");
    const pendingLog = await prisma.composeEmailLog.create({
      data: {
        toEmail: lead.email!,
        subject: preview.subject,
        heading: "Quick online visibility wins",
        status: "pending",
        message: "Approved Adult Lead outreach queued for delivery.",
        metadata: {
          adultLeadId: row.id,
          country: row.country,
          category: row.category,
          trackingEnabled: true
        }
      }
    });
    const result = await sendEmailOutreach(lead, { trackingLogId: pendingLog.id });

    await prisma.composeEmailLog.update({
      where: { id: pendingLog.id },
      data: {
        status: result.status,
        providerId: result.providerId,
        message: result.sent
          ? "Adult Lead outreach sent with open and click tracking enabled."
          : result.reason ?? "Adult Lead outreach was not sent.",
        metadata: {
          adultLeadId: row.id,
          country: row.country,
          category: row.category,
          subject: result.message?.subject ?? preview.subject,
          auditAttachments: result.auditAttachments ?? [],
          trackingEnabled: Boolean(result.sent),
          providerStatus: result.status,
          reason: result.reason ?? null
        }
      }
    });

    if (result.sent) {
      await prisma.adultLead.update({
        where: { id: row.id },
        data: {
          outreachStatus: "Contacted",
          emailSent: true,
          lastContactedAt: new Date()
        }
      });
      sent += 1;
      logs.push(`Sent email to ${row.businessName}.`);
    } else {
      await prisma.adultLead.update({
        where: { id: row.id },
        data: result.status === "failed"
          ? {
              outreachStatus: "Failed",
              outreachApproved: false,
              outreachApprovedAt: null
            }
          : { outreachStatus: "Approved" }
      });
      if (result.status === "failed") failed += 1;
      else skipped += 1;
      logs.push(`${row.businessName}: ${result.reason ?? result.status}.`);
    }
  }

  return { country, attempted: rows.length, sent, skipped, failed, logs };
}

export async function runAdultLeadOutreachAutomationCycle() {
  const [countries, settings] = await Promise.all([
    listAdultLeadCountries(),
    getOutreachAutomationSettings()
  ]);
  const results = [];
  let available = settings.batchSize;

  for (const country of countries) {
    if (available <= 0) break;
    const result = await sendApprovedAdultLeadEmails(country, available);
    available -= result.sent;
    results.push(result);
  }

  const attempted = results.reduce((sum, result) => sum + result.attempted, 0);
  const sent = results.reduce((sum, result) => sum + result.sent, 0);
  const failed = results.reduce((sum, result) => sum + result.failed, 0);
  const skipped = results.reduce((sum, result) => sum + result.skipped, 0);

  if (sent > 0 || failed > 0) {
    await createAppNotification({
      type: failed > 0 ? "failure" : "automation",
      title: failed > 0 ? "Adult Lead outreach needs attention" : "Adult Lead outreach completed",
      message: `${sent} email(s) sent, ${failed} failed, ${skipped} skipped.`,
      actionUrl: "/adult-leads"
    });
  }

  return { attempted, sent, skipped, failed, results };
}
