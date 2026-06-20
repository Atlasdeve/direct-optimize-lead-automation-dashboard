const { createServer } = require("http");
const { spawnSync } = require("child_process");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

if (!dev) {
  const migration = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: true
  });
  if (migration.status !== 0) {
    process.exit(migration.status || 1);
  }
}

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`Direct Optimize listening on ${hostname}:${port}`);
  });
});
