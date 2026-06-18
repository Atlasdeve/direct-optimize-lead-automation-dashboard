import cron from "node-cron";
import { regions } from "@/lib/regions";
import { enqueueAutomation, startAutomationWorker } from "@/lib/queue";
import { syncInboxReplies } from "@/lib/replySync";

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

console.log("Direct Optimize scheduler started for Canada, USA, UK, UAE, Qatar morning runs, and 15-minute reply sync.");
