import cron from "node-cron";
import { regions } from "@/lib/regions";
import { enqueueAutomation, startAutomationWorker } from "@/lib/queue";
import { syncInboxReplies } from "@/lib/replySync";
import { sendDailyEmployeeWorkReminders } from "@/lib/employeeReminders";

startAutomationWorker();

for (const region of regions.filter((item) => item.name !== "Custom")) {
  cron.schedule(
    region.morningCron,
    () => {
      void enqueueAutomation(region.name);
    },
    { timezone: region.timezone }
  );
}

cron.schedule("*/15 * * * *", async () => {
  const result = await syncInboxReplies();
  if (!result.ok && result.reason !== "IMAP is not configured") {
    console.error(`Reply sync failed: ${result.reason}`);
  }
});

cron.schedule("0 17 * * *", async () => {
  const result = await sendDailyEmployeeWorkReminders();
  if (result.sent > 0) console.log(`Sent ${result.sent} employee work reminder(s).`);
}, { timezone: "Asia/Karachi" });

console.log("Direct Optimize scheduler started for regional runs, reply sync, and daily employee reminders.");
