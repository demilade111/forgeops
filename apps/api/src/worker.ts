import { loadConfig } from "./config.js";
import { run } from "./modules/deployments/deployments.build.js";
import { createAlertSender } from "./modules/alerts/alerts.send.js";
import { createLogCollector } from "./modules/deployments/deployments.logs.js";
import { createMetricsCollector } from "./modules/deployments/deployments.metrics.js";
import { createWatcher } from "./modules/deployments/deployments.watch.js";
import { createDeploymentHandler } from "./modules/deployments/deployments.worker.js";
import { deploymentsRepository } from "./modules/deployments/deployments.repository.js";
import { loadGitHubClient } from "./modules/github/github.client.js";
import { appsNetwork } from "./modules/deployments/deployments.release.js";
import { projectsRepository } from "./modules/projects/projects.repository.js";
import { createTeardownHandler } from "./modules/projects/projects.teardown.js";
import { connectQueue } from "./queue.js";
import { readEncryptionKey } from "./secrets.js";
import { createDb } from "./server.js";

const {
  databaseUrl,
  encryptionKeyPath,
  rabbitmqUrl,
  registryHost,
  caddyAdminUrl,
  caddyHttpUrl,
  github,
  smtpUrl,
  appUrl,
} = loadConfig(process.env);
if (!rabbitmqUrl) throw new Error("Invalid configuration\nRABBITMQ_URL is required for the worker");
if (!registryHost) {
  throw new Error("Invalid configuration\nREGISTRY_HOST is required for the worker");
}
if (!caddyAdminUrl) {
  throw new Error("Invalid configuration\nCADDY_ADMIN_URL is required for the worker");
}
if (!caddyHttpUrl) {
  throw new Error("Invalid configuration\nCADDY_HTTP_URL is required for the worker");
}
if (!github)
  throw new Error("Invalid configuration\nGitHub App settings are required for the worker");

const docker = await run("docker", ["version"], 10_000).catch(() => null);
if (docker?.code !== 0) throw new Error("Docker is not available. Start Docker, then the worker.");
const startHint = "Run docker compose up -d, then start the worker.";
if ((await run("docker", ["network", "inspect", appsNetwork], 10_000)).code !== 0) {
  throw new Error(`Docker network ${appsNetwork} is missing. ${startHint}`);
}
if (!(await fetch(`${caddyAdminUrl}/config/`).catch(() => null))?.ok) {
  throw new Error(`Caddy is not reachable at ${caddyAdminUrl}. ${startHint}`);
}
const encryptionKey = readEncryptionKey(encryptionKeyPath);

const db = createDb(databaseUrl);
const queue = await connectQueue(rabbitmqUrl);
const deployments = deploymentsRepository(db);
const projects = projectsRepository(db);
const staleAfterMs = 60 * 60_000;
const deletionRetryMs = 10 * 60_000;

queue.connection.on("close", () => {
  console.error("Lost the RabbitMQ connection, exiting");
  process.exit(1);
});

const relay = setInterval(() => {
  deployments
    .relayOutbox(queue.publish)
    .catch((error) => console.error("Outbox relay failed", error));
}, 1000);

const sweeper = setInterval(() => {
  deployments
    .failStale(new Date(Date.now() - staleAfterMs))
    .then((count) => count > 0 && console.error(`Marked ${count} stale deployment(s) as failed`))
    .catch((error) => console.error("Stale deployment sweep failed", error));
  projects
    .retryDeletions(new Date(Date.now() - deletionRetryMs))
    .then((count) => count > 0 && console.error(`Retrying ${count} unfinished deletion(s)`))
    .catch((error) => console.error("Deletion retry sweep failed", error));
}, 60_000);

const deploy = createDeploymentHandler(db, loadGitHubClient(github), {
  registryHost,
  caddyAdminUrl,
  caddyHttpUrl,
  encryptionKey,
});
const teardown = createTeardownHandler(db, { caddyAdminUrl });
const alert = createAlertSender(db, { smtpUrl, appUrl, encryptionKey });
const watch = createWatcher(db, { caddyAdminUrl, caddyHttpUrl });
const collect = createMetricsCollector(db);
let collecting = false;
const collector = setInterval(() => {
  if (collecting) return;
  collecting = true;
  collect()
    .catch((error) => console.error("Collecting metrics failed", error))
    .finally(() => (collecting = false));
}, 15_000);
const collectLogs = createLogCollector(db);
let collectingLogs = false;
const logCollector = setInterval(() => {
  if (collectingLogs) return;
  collectingLogs = true;
  collectLogs()
    .catch((error) => console.error("Collecting app logs failed", error))
    .finally(() => (collectingLogs = false));
}, 3_000);
let watching = false;
const watcher = setInterval(() => {
  if (watching) return;
  watching = true;
  watch()
    .catch((error) => console.error("Watching live deployments failed", error))
    .finally(() => (watching = false));
}, 10_000);
await queue.consume((body) => {
  const { type } = body as { type?: unknown };
  if (type === "deletion.requested") return teardown(body);
  if (type === "alert.requested") return alert(body);
  return deploy(body);
});
console.log("Worker listening for deployments and deletions");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    clearInterval(relay);
    clearInterval(sweeper);
    clearInterval(watcher);
    clearInterval(collector);
    clearInterval(logCollector);
    queue.connection.removeAllListeners("close");
    await queue.close();
    await db.$disconnect();
    process.exit(0);
  });
}
