import { loadConfig } from "./config.js";
import { createDeploymentHandler } from "./modules/deployments/deployments.worker.js";
import { deploymentsRepository } from "./modules/deployments/deployments.repository.js";
import { loadGitHubClient } from "./modules/github/github.client.js";
import { connectQueue } from "./queue.js";
import { createDb } from "./server.js";

const { databaseUrl, rabbitmqUrl, github } = loadConfig(process.env);
if (!rabbitmqUrl) throw new Error("Invalid configuration\nRABBITMQ_URL is required for the worker");
if (!github)
  throw new Error("Invalid configuration\nGitHub App settings are required for the worker");

const db = createDb(databaseUrl);
const queue = await connectQueue(rabbitmqUrl);
const outbox = deploymentsRepository(db);

queue.connection.on("close", () => {
  console.error("Lost the RabbitMQ connection, exiting");
  process.exit(1);
});

const relay = setInterval(() => {
  outbox.relayOutbox(queue.publish).catch((error) => console.error("Outbox relay failed", error));
}, 1000);

await queue.consume(createDeploymentHandler(db, loadGitHubClient(github)));
console.log("Worker listening for deployments");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    clearInterval(relay);
    queue.connection.removeAllListeners("close");
    await queue.close();
    await db.$disconnect();
    process.exit(0);
  });
}
