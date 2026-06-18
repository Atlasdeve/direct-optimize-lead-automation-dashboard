import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { runAutomation } from "@/lib/automation";

const redisUrl = process.env.REDIS_URL;
const connection: ConnectionOptions | null = redisUrl
  ? { url: redisUrl, maxRetriesPerRequest: null }
  : null;

export const automationQueue = connection
  ? new Queue("automation-runs", { connection })
  : null;

export async function enqueueAutomation(region: string, options?: { city?: string; categories?: string[]; maxResults?: number }) {
  if (!automationQueue) {
    return runAutomation(region, options);
  }
  await automationQueue.add("run-region", { region, options }, {
    attempts: 2,
    backoff: { type: "exponential", delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return {
    region,
    status: "queued" as const,
    leadsFetched: 0,
    emailsSent: 0,
    whatsappSent: 0,
    failedCount: 0,
    logs: ["Automation queued in BullMQ."]
  };
}

export function startAutomationWorker() {
  if (!connection) return null;
  return new Worker(
    "automation-runs",
    async (job) => runAutomation(job.data.region, job.data.options),
    { connection, concurrency: 2 }
  );
}
