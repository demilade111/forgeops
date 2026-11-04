import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../http-error.js";
import { createService, createUser, resetDb, testDb } from "../../test/db.js";
import { helloApp, registryHost, sourceArchive } from "../../test/source.js";
import type { GitHubClient } from "../github/github.client.js";
import { run, workspace } from "./deployments.build.js";
import { deploymentsRepository } from "./deployments.repository.js";
import { createDeploymentHandler } from "./deployments.worker.js";

const hello = sourceArchive(helloApp);

const github = {
  installUrl: () => "https://github.test/install",
  userInstallations: vi.fn(async () => []),
  listRepositories: vi.fn(async () => []),
  inspectSource: vi.fn(async () => ({ repositoryId: 777 })),
  branchCommit: vi.fn(async (): Promise<string | null> => "9f2c41e"),
  sourceArchive: vi.fn(async (): Promise<Readable | null> => hello()),
} satisfies GitHubClient;

const repo = deploymentsRepository(testDb);
const options = { registryHost, retryDelays: [0, 0, 0] };
const handle = createDeploymentHandler(testDb, github, options);
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
  testDb.deployment.findUniqueOrThrow({
    where: { id },
    include: { steps: { orderBy: { startedAt: "asc" } } },
  });

const withSource = (files: Record<string, string>, links?: Record<string, string>) =>
  github.sourceArchive.mockImplementationOnce(async () => sourceArchive(files, links)());

const manifest = (image: string) => {
  const [name, digest] = image.slice(registryHost.length + 1).split("@");
  return fetch(`http://${registryHost}/v2/${name}/manifests/${digest}`, {
    method: "HEAD",
    headers: {
      Accept: [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
      ].join(", "),
    },
  });
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("builds the pinned commit, pushes the image and records every step", async () => {
  const { service, deployment, message } = await queued();

  await handle(message);

  expect(github.sourceArchive).toHaveBeenCalledWith(
    expect.any(Number),
    "demilade111/forgeops-sample-api",
    "9f2c41e",
  );
  const done = await reload(deployment.id);
  expect(done).toMatchObject({
    status: "succeeded",
    commitSha: "9f2c41e",
    error: null,
    activeServiceId: null,
    image: expect.stringMatching(
      new RegExp(`^${registryHost}/services/${service.id}@sha256:[a-f0-9]{64}$`),
    ),
  });
  expect(done.steps.map((s) => [s.name, s.status])).toEqual([
    ["resolve-commit", "succeeded"],
    ["fetch-source", "succeeded"],
    ["build", "succeeded"],
    ["push", "succeeded"],
  ]);
  expect(done.steps[2]!.log).toContain(
    `naming to ${registryHost}/services/${service.id}:${deployment.id}`,
  );
  expect(done.steps[3]!.log).toContain(done.image!.split("@")[1]);
  expect((await manifest(done.image!)).status).toBe(200);
  expect(existsSync(workspace(deployment.id))).toBe(false);
  const localTag = `${registryHost}/services/${service.id}:${deployment.id}`;
  expect((await run("docker", ["image", "inspect", localTag], 10_000)).code).not.toBe(0);
});

it("reports a failed build with its log and never pushes", async () => {
  const { deployment, message } = await queued();
  withSource({ Dockerfile: "FROM busybox:1.37\nRUN exit 3\n" });

  await handle(message);

  const done = await reload(deployment.id);
  expect(done).toMatchObject({
    status: "failed",
    error: "Build failed with exit code 1. See the build log.",
    commitSha: "9f2c41e",
    image: null,
    activeServiceId: null,
  });
  expect(done.steps.map((s) => s.name)).toEqual(["resolve-commit", "fetch-source", "build"]);
  expect(done.steps[2]).toMatchObject({
    status: "failed",
    log: expect.stringContaining("exit code: 3"),
  });
  expect(existsSync(workspace(deployment.id))).toBe(false);
});

it("stops a build that runs past its time limit", async () => {
  const { deployment, message } = await queued();
  withSource({ Dockerfile: `FROM busybox:1.37\nRUN echo ${randomUUID()} && sleep 30\n` });
  const slow = createDeploymentHandler(testDb, github, {
    ...options,
    timeouts: { build: 2000, push: 60_000 },
  });

  await slow(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Build took longer than the time limit. See the build log.",
    activeServiceId: null,
  });
});

it("fails clearly when the commit has no Dockerfile", async () => {
  const { deployment, message } = await queued();
  withSource({ "README.md": "no Dockerfile here" });

  await handle(message);

  const done = await reload(deployment.id);
  expect(done).toMatchObject({ status: "failed", error: "No Dockerfile at Dockerfile in 9f2c41e" });
  expect(done.steps.at(-1)).toMatchObject({ name: "fetch-source", status: "failed" });
});

it("refuses a source directory that links outside the code", async () => {
  const { service, deployment, message } = await queued();
  await testDb.service.update({ where: { id: service.id }, data: { sourceDirectory: "api" } });
  withSource({ "README.md": "x" }, { api: "/" });

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Source directory api not found in 9f2c41e",
  });
});

it("refuses a Dockerfile that links outside the code", async () => {
  const { deployment, message } = await queued();
  withSource({}, { Dockerfile: "/etc/hosts" });

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "No Dockerfile at Dockerfile in 9f2c41e",
  });
});

it("fails when the archive cannot be unpacked", async () => {
  const { deployment, message } = await queued();
  github.sourceArchive.mockResolvedValueOnce(Readable.from(["not a tarball"]));

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Could not unpack the source code",
  });
});

it("fails when GitHub no longer has the commit", async () => {
  const { deployment, message } = await queued();
  github.sourceArchive.mockResolvedValueOnce(null);

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Commit 9f2c41e not found in demilade111/forgeops-sample-api",
  });
});

it("retries a failed source download before succeeding", async () => {
  const { deployment, message } = await queued();
  github.sourceArchive.mockRejectedValueOnce(gitHubDown);

  await handle(message);

  expect(github.sourceArchive).toHaveBeenCalledTimes(2);
  expect((await reload(deployment.id)).status).toBe("succeeded");
});

it("skips a duplicate message for a finished deployment", async () => {
  const { message } = await queued();

  await handle(message);
  await handle(message);

  expect(github.branchCommit).toHaveBeenCalledTimes(1);
});

it("resumes a crashed deployment with the commit it already pinned", async () => {
  const { deployment, message } = await queued();
  await repo.claim(deployment.id);
  await repo.startStep(deployment.id, "resolve-commit");
  await repo.saveCommit(deployment.id, "abc1234");

  await handle(message);

  expect(github.branchCommit).not.toHaveBeenCalled();
  expect(github.sourceArchive).toHaveBeenCalledWith(
    expect.any(Number),
    expect.any(String),
    "abc1234",
  );
  const done = await reload(deployment.id);
  expect(done).toMatchObject({ status: "succeeded", commitSha: "abc1234" });
  expect(done.steps).toHaveLength(4);
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
  expect(github.sourceArchive).not.toHaveBeenCalled();
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

it("fails deployments stuck running past the cutoff and releases their locks", async () => {
  const { deployment } = await queued();
  await repo.claim(deployment.id);
  await repo.startStep(deployment.id, "build");

  expect(await repo.failStale(new Date(Date.now() - 60_000))).toBe(0);
  expect(await repo.failStale(new Date(Date.now() + 1000))).toBe(1);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Deployment timed out. Try deploying again.",
    activeServiceId: null,
    steps: [expect.objectContaining({ name: "build", status: "failed" })],
  });
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
