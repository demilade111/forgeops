import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { deploymentsRepository } from "./modules/deployments/deployments.repository.js";
import { createDeploymentHandler } from "./modules/deployments/deployments.worker.js";
import type { GitHubClient } from "./modules/github/github.client.js";
import { connectQueue } from "./queue.js";
import { createService, createUser, resetDb, testDb } from "./test/db.js";
import { webApp, resetRuntime, sourceArchive, workerOptions } from "./test/source.js";

const url = process.env.RABBITMQ_URL;
if (!url) throw new Error("RABBITMQ_URL is not set (see apps/api/.env.example)");

let queue: Awaited<ReturnType<typeof connectQueue>>;
let name: string;

beforeEach(async () => {
  await resetRuntime();
  await resetDb();
  name = `test-${randomUUID()}`;
  queue = await connectQueue(url, name);
});

afterEach(async () => {
  const channel = await queue.connection.createChannel();
  await channel.deleteQueue(name);
  await channel.deleteQueue(`${name}.dead`);
  await queue.close();
});

afterAll(resetRuntime);

const until = async (check: () => Promise<boolean> | boolean) => {
  for (let i = 0; i < 400 && !(await check()); i++) await new Promise((r) => setTimeout(r, 50));
};

it("redelivers a message the consumer did not finish", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const seen: unknown[] = [];
  await queue.consume(async (message) => {
    seen.push(message);
    if (seen.length === 1) throw new Error("worker crashed mid-job");
  });

  await queue.publish({ type: "ping", n: 1 });
  await until(() => seen.length === 2);

  expect(seen).toEqual([
    { type: "ping", n: 1 },
    { type: "ping", n: 1 },
  ]);
});

it("moves a deployment from the outbox through RabbitMQ to a finished worker run", async () => {
  const github = {
    installUrl: () => "",
    userInstallations: async () => [],
    listRepositories: async () => [],
    inspectSource: async () => ({ repositoryId: 777 }),
    branchCommit: async () => "9f2c41e",
    sourceArchive: async () => sourceArchive(webApp)(),
  } satisfies GitHubClient;
  const repo = deploymentsRepository(testDb);
  const service = await createService();
  const deployment = (await repo.create(service.id, (await createUser()).id, "k1"))!;

  await queue.consume(createDeploymentHandler(testDb, github, workerOptions));
  expect(await repo.relayOutbox(queue.publish)).toBe(1);
  await until(
    async () =>
      (await testDb.deployment.findUniqueOrThrow({ where: { id: deployment.id } })).status ===
      "succeeded",
  );

  expect(await testDb.deployment.findUniqueOrThrow({ where: { id: deployment.id } })).toMatchObject(
    {
      status: "succeeded",
      commitSha: "9f2c41e",
      image: expect.stringMatching(/@sha256:[a-f0-9]{64}$/),
      activeServiceId: null,
    },
  );
});
