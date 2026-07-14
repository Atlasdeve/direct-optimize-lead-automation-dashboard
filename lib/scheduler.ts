import cron from "node-cron";
import { enqueueAutomation, startAutomationWorker } from "@/lib/queue";
import { syncInboxReplies } from "@/lib/replySync";
import { sendDailyEmployeeWorkReminders } from "@/lib/employeeReminders";
import { runOutreachAutomationCycle } from "@/lib/dbStore";
import { listEnabledRegions } from "@/lib/regionStore";
import { prisma } from "@/lib/prisma";
import { getDailyAutomationTarget } from "@/lib/discoveryTargets";

startAutomationWorker();

type SettingValue = { lastRunDate?: string };

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
  return { hour: Number(hour), minute: Number(minute) };
}

async function runDueDiscoveryAutomations() {
  const regions = await listEnabledRegions();
  for (const region of regions.filter((item) => item.name !== "Custom")) {
    const local = localParts(region.timezone);
    const scheduled = cronTime(region.morningCron);
    const isDue = local.hour > scheduled.hour || (local.hour === scheduled.hour && local.minute >= scheduled.minute);
    if (!isDue) continue;
    const key = `cron:${region.name}:daily-automation`;
    const setting = await prisma.setting.findUnique({ where: { key } });
    const lastRunDate = (setting?.value as SettingValue | null)?.lastRunDate;
    if (lastRunDate === local.date) continue;
    const target = getDailyAutomationTarget(region.name, region.country, local.date);
    await enqueueAutomation(region.name, {
      maxResults: Number(process.env.CRON_AUTOMATION_MAX_RESULTS || 3),
      city: target.city,
      categories: target.categories
    });
    console.log(`${region.name} discovery target: ${target.niche} in ${target.city}.`);
    await prisma.setting.upsert({
      where: { key },
      update: { value: { lastRunDate: local.date } },
      create: { key, value: { lastRunDate: local.date } }
    });
  }
}

cron.schedule("*/15 * * * *", () => {
  void runDueDiscoveryAutomations().catch((error) => console.error("Regional discovery automation failed:", error));
});

cron.schedule("*/15 * * * *", async () => {
  const result = await syncInboxReplies();
  if (!result.ok && result.reason !== "IMAP is not configured") {
    console.error(`Reply sync failed: ${result.reason}`);
  }
});

let outreachCycleRunning = false;
cron.schedule("*/10 * * * *", async () => {
  if (outreachCycleRunning) return;
  outreachCycleRunning = true;
  try {
    const regions = await listEnabledRegions();
    for (const region of regions.filter((item) => item.name !== "Custom")) {
      const result = await runOutreachAutomationCycle(region.name);
      if (result.sent > 0 || result.failed > 0) {
        console.log(`${region.name} outreach: ${result.sent} sent, ${result.failed} failed.`);
      }
    }
  } catch (error) {
    console.error("Outreach automation cycle failed:", error);
  } finally {
    outreachCycleRunning = false;
  }
});

cron.schedule("0 17 * * *", async () => {
  const result = await sendDailyEmployeeWorkReminders();
  if (result.sent > 0) console.log(`Sent ${result.sent} employee work reminder(s).`);
}, { timezone: "Asia/Karachi" });

console.log("Direct Optimize scheduler started for regional discovery, approved outreach, follow-ups, reply sync, and employee reminders.");
