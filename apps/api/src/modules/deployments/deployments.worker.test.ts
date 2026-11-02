import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../http-error.js";
import { createService, createUser, resetDb, testDb } from "../../test/db.js";
import type { GitHubClient } from "../github/github.client.js";
import { deploymentsRepository } from "./deployments.repository.js";
import { createDeploymentHandler } from "./deployments.worker.js";

const github = {
  installUrl: () => "https://github.test/install",
  userInstallations: vi.fn(async () => []),
  listRepositories: vi.fn(async () => []),
  inspectSource: vi.fn(async () => ({ repositoryId: 777 })),
  branchCommit: vi.fn(async (): Promise<string | null> => "9f2c41e"),
} satisfies GitHubClient;

const repo = deploymentsRepository(testDb);
const handle = createDeploymentHandler(testDb, github, { retryDelays: [0, 0, 0] });
const gitHubDown = new HttpError(502, "GITHUB_ERROR", "GitHub request failed (502)");

async function queued() {
  const service = await createService();
  const user = await createUser();
  const deployment = await repo.create(service.id, user.id, "k1");
  return {
    service,
    deployment,
    message: { type: "deployment.requested", deploymentId: deployment.id },
  };
}

const reload = (id: string) =>
  testDb.deployment.findUniqueOrThrow({ where: { id }, include: { steps: true } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("resolves the commit, records the step and releases the lock", async () => {
  const { deployment, message } = await queued();

  await handle(message);

  expect(github.branchCommit).toHaveBeenCalledWith(
    expect.any(Number),
    "demilade111/forgeops-sample-api",
    "main",
  );
  const done = await reload(deployment.id);
  expect(done).toMatchObject({
    status: "succeeded",
    commitSha: "9f2c41e",
    error: null,
    activeServiceId: null,
    startedAt: expect.any(Date),
    finishedAt: expect.any(Date),
  });
  expect(done.steps).toEqual([
    expect.objectContaining({
      name: "resolve-commit",
      status: "succeeded",
      finishedAt: expect.any(Date),
    }),
  ]);
});

it("skips a duplicate message for a finished deployment", async () => {
  const { message } = await queued();

  await handle(message);
  await handle(message);

  expect(github.branchCommit).toHaveBeenCalledTimes(1);
});

it("resumes a deployment left running by a crashed worker", async () => {
  const { deployment, message } = await queued();
  await repo.claim(deployment.id);
  await repo.startStep(deployment.id, "resolve-commit");

  await handle(message);

  const done = await reload(deployment.id);
  expect(done.status).toBe("succeeded");
  expect(done.steps).toHaveLength(1);
});

it("fails with a clear reason when the branch is gone", async () => {
  const { deployment, message } = await queued();
  github.branchCommit.mockResolvedValueOnce(null);

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Branch main not found in demilade111/forgeops-sample-api",
    activeServiceId: null,
    steps: [expect.objectContaining({ status: "failed", error: expect.stringContaining("main") })],
  });
});

it("retries GitHub errors with backoff before succeeding", async () => {
  const { deployment, message } = await queued();
  github.branchCommit.mockRejectedValueOnce(gitHubDown).mockRejectedValueOnce(gitHubDown);

  await handle(message);

  expect(github.branchCommit).toHaveBeenCalledTimes(3);
  expect((await reload(deployment.id)).status).toBe("succeeded");
});

it("fails after the retries run out", async () => {
  const { deployment, message } = await queued();
  for (let i = 0; i < 4; i++) github.branchCommit.mockRejectedValueOnce(gitHubDown);

  await handle(message);

  expect(github.branchCommit).toHaveBeenCalledTimes(4);
  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "GitHub did not respond. Try deploying again.",
    activeServiceId: null,
  });
});

it("fails when the organization has no GitHub connection", async () => {
  const { deployment, message } = await queued();
  await testDb.gitHubInstallation.deleteMany();

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "GitHub is not connected",
  });
  expect(github.branchCommit).not.toHaveBeenCalled();
});

it("rejects a malformed message so the queue can retry or dead-letter it", async () => {
  await expect(handle({ deploymentId: "nope" })).rejects.toThrow();
});

it("relays unsent outbox rows once, and keeps them if publishing fails", async () => {
  const { deployment } = await queued();
  const failing = vi.fn(async () => {
    throw new Error("RabbitMQ is down");
  });

  await expect(repo.relayOutbox(failing)).rejects.toThrow("RabbitMQ is down");
  expect((await testDb.outbox.findFirstOrThrow()).sentAt).toBeNull();

  const publish = vi.fn(async () => {});
  expect(await repo.relayOutbox(publish)).toBe(1);
  expect(publish).toHaveBeenCalledWith({
    type: "deployment.requested",
    deploymentId: deployment.id,
  });
  expect((await testDb.outbox.findFirstOrThrow()).sentAt).toBeInstanceOf(Date);

  expect(await repo.relayOutbox(publish)).toBe(0);
  expect(publish).toHaveBeenCalledTimes(1);
});
