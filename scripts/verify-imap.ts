import "dotenv/config";
import { verifyImapConnection } from "../lib/replySync";

async function main() {
  const result = await verifyImapConnection();
  if (!result.ok) {
    console.error(`IMAP verification failed: ${result.reason}`);
    process.exit(1);
  }
  console.log(result.reason);
}

void main();
