import "dotenv/config";
import { verifySmtpConnection } from "../lib/providers";

async function main() {
  const result = await verifySmtpConnection();
  if (!result.ok) {
    console.error(`SMTP verification failed: ${result.reason}`);
    process.exit(1);
  }
  console.log(result.reason);
}

void main();
