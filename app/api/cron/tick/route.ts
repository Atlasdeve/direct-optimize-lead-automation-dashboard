import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueAutomation } from "@/lib/queue";
import { listEnabledRegions } from "@/lib/regionStore";
import { syncInboxReplies } from "@/lib/replySync";
import { getDailyAutomationTarget } from "@/lib/discoveryTargets";

type SettingValue = {
  lastRunDate?: string;
};

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return bearer === secret || querySecret === secret;
}

function localParts(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}

function cronTime(expression: string) {
  const [minute, hour] = expression.split(" ");
  return {
    hour: Number(hour),
    minute: Number(minute)
  };
}

async function getLastRunDate(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return (setting?.value as SettingValue | null)?.lastRunDate;
}

async function setLastRunDate(key: string, lastRunDate: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value: { lastRunDate } },
    create: { key, value: { lastRunDate } }
  });
}

async function runDueRegion() {
  const regions = await listEnabledRegions();
  for (const region of regions.filter((item) => item.name !== "Custom")) {
    const local = localParts(region.timezone);
    const scheduled = cronTime(region.morningCron);
    const isDue = local.hour > scheduled.hour || (local.hour === scheduled.hour && local.minute >= scheduled.minute);
    if (!isDue) continue;

    const key = `cron:${region.name}:daily-automation`;
    const lastRunDate = await getLastRunDate(key);
    if (lastRunDate === local.date) continue;

    const maxResults = Number(process.env.CRON_AUTOMATION_MAX_RESULTS || 3);
    const target = getDailyAutomationTarget(region.name, region.country, local.date);
    const result = await enqueueAutomation(region.name, { maxResults, city: target.city, categories: target.categories });
    await setLastRunDate(key, local.date);
    return { region: region.name, target, result };
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const replySync = await syncInboxReplies();
  const automation = await runDueRegion();

  return NextResponse.json({
    ok: true,
    replySync,
    automation
  });
}
