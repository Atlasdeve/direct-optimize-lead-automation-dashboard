import "dotenv/config";
import { syncInboxReplies } from "../lib/replySync";

async function main() {
  const result = await syncInboxReplies();
  if (!result.ok) {
    console.error(`Reply sync failed: ${result.reason}`);
    process.exit(1);
  }
  console.log(
    `Reply sync complete. scanned=${result.scanned} matched=${result.matched} stored=${result.stored} drafted=${result.drafted}`
  );
}

void main();
