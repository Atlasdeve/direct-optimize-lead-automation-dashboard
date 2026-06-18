import "dotenv/config";
import { discoverEmailsForLeads } from "../lib/dbStore";

async function main() {
  const region = process.argv[2];
  const limit = Number(process.argv[3] ?? 10);
  const result = await discoverEmailsForLeads({ region, limit });
  console.log(
    `Email discovery complete. scanned=${result.scanned} updated=${result.updated} found=${result.found} forms=${result.formsFound} failed=${result.failed}`
  );
}

void main();
