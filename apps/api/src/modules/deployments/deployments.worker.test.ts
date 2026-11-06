import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../http-error.js";
import { createService, createUser, resetDb, testDb, testKey } from "../../test/db.js";
import { encrypt } from "../../secrets.js";
import {
  helloApp,
  registryHost,
  resetRuntime,
  sourceArchive,
  until,
  viaRouter,
  webApp,
  workerOptions,
} from "../../test/source.js";
import type { GitHubClient } from "../github/github.client.js";
import { projectsRepository } from "../projects/projects.repository.js";
import { createTeardownHandler } from "../projects/projects.teardown.js";
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
const create = async (serviceId: string, userId: string, key: string) =>
  (await repo.create(serviceId, userId, key))!;
const options = { ...workerOptions, retryDelays: [0, 0, 0] };
const handle = createDeploymentHandler(testDb, github, options);
const gitHubDown = new HttpError(502, "GITHUB_ERROR", "GitHub request failed (502)");

async function queued() {
  const service = await createService();
  const user = await createUser();
  const deployment = await create(service.id, user.id, "k1");
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
  await resetRuntime();
  await resetDb();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(resetRuntime);

const containersOf = async (serviceId: string) =>
  (
    await run(
      "docker",
      ["ps", "-a", "--filter", `label=forgeops.service=${serviceId}`, "--format", "{{.Names}}"],
      10_000,
    )
  ).log
    .split("\n")
    .filter(Boolean);

const setEnv = (serviceId: string, env: Record<string, string>) =>
  testDb.service.update({
    where: { id: serviceId },
    data: { envVars: encrypt(testKey, JSON.stringify(env)) },
  });

const host = "api.sample-shop.localhost";

it("builds the pinned commit, runs it and serves it at its URL", async () => {
  const { service, deployment, message } = await queued();
  await setEnv(service.id, { GREETING: "from forgeops" });
  withSource(webApp);

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
    url: `http://${host}`,
    image: expect.stringMatching(
      new RegExp(`^${registryHost}/services/${service.id}@sha256:[a-f0-9]{64}$`),
    ),
  });
  expect(done.steps.map((s) => [s.name, s.status])).toEqual([
    ["resolve-commit", "succeeded"],
    ["fetch-source", "succeeded"],
    ["build", "succeeded"],
    ["push", "succeeded"],
    ["run", "succeeded"],
    ["route", "succeeded"],
  ]);
  await until(async () => (await viaRouter(host)).endsWith(" 200"));
  expect(await viaRouter(host)).toBe("hello from forgeops\n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${deployment.id}`]);
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
  expect(done.steps).toHaveLength(6);
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

it("replaces the running release on redeploy and removes the old container", async () => {
  const { service, deployment, message } = await queued();
  await setEnv(service.id, { GREETING: "v1" });
  withSource(webApp);
  await handle(message);
  await until(async () => (await viaRouter(host)) === "hello v1\n 200");

  await setEnv(service.id, { GREETING: "v2" });
  withSource(webApp);
  const next = await create(service.id, deployment.triggeredById!, "k2");
  await handle({ type: "deployment.requested", deploymentId: next.id });

  await until(async () => (await viaRouter(host)) === "hello v2\n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${next.id}`]);
});

it("keeps the live release when the new container cannot start", async () => {
  const { service, deployment, message } = await queued();
  withSource(webApp);
  await handle(message);
  await until(async () => (await viaRouter(host)).endsWith(" 200"));

  withSource({ Dockerfile: 'FROM busybox:1.37\nCMD ["/does-not-exist"]\n' });
  const next = await create(service.id, deployment.triggeredById!, "k2");
  await handle({ type: "deployment.requested", deploymentId: next.id });

  const done = await reload(next.id);
  expect(done).toMatchObject({
    status: "failed",
    error: "Could not start the container",
    url: null,
  });
  expect(done.steps.at(-1)).toMatchObject({
    name: "run",
    status: "failed",
    log: expect.stringContaining("does-not-exist"),
  });
  expect(await viaRouter(host)).toBe("hello \n 200");
  expect(await containersOf(service.id)).toContain(`fo-${deployment.id}`);
});

it("refuses a URL that another service already serves", async () => {
  const first = await queued();
  withSource(webApp);
  await handle(first.message);

  const other = await createService();
  const user = await testDb.user.findFirstOrThrow();
  const deployment = await create(other.id, user.id, "k1");
  await handle({ type: "deployment.requested", deploymentId: deployment.id });

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: `${host} is already used by another service`,
  });
  expect(await containersOf(other.id)).toEqual([]);
  expect(await containersOf(first.service.id)).toEqual([`fo-${first.deployment.id}`]);
});

it("fails and removes the new container when the router is unreachable", async () => {
  const { service, deployment, message } = await queued();
  const offline = createDeploymentHandler(testDb, github, {
    ...options,
    caddyAdminUrl: "http://127.0.0.1:1",
  });

  await offline(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Could not update the router",
    activeServiceId: null,
  });
  expect(await containersOf(service.id)).toEqual([]);
});

it("fails clearly when the env vars cannot be decrypted", async () => {
  const { service, deployment, message } = await queued();
  await testDb.service.update({ where: { id: service.id }, data: { envVars: "a.b.c" } });

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Could not read the service's env vars",
  });
  expect(await containersOf(service.id)).toEqual([]);
});

const projects = projectsRepository(testDb);
const teardown = createTeardownHandler(testDb, workerOptions);

async function live() {
  const setup = await queued();
  withSource(webApp);
  await handle(setup.message);
  await until(async () => (await viaRouter(host)).endsWith(" 200"));
  return setup;
}

it("deletes a service: its URL stops answering and its containers and rows are removed", async () => {
  const { service, deployment } = await live();
  expect(await projects.requestDeletion({ serviceId: service.id })).toBe(true);
  const message = { type: "deletion.requested", serviceId: service.id };

  await teardown(message);

  expect(await viaRouter(host)).toMatch(/ 404$/);
  expect(await containersOf(service.id)).toEqual([]);
  expect(await testDb.service.findUnique({ where: { id: service.id } })).toBeNull();
  expect(await testDb.deployment.findUnique({ where: { id: deployment.id } })).toBeNull();
  expect(await testDb.project.count()).toBe(1);
  await teardown(message);
});

it("deletes a project with every service in it", async () => {
  const { service } = await live();
  await projects.requestDeletion({ projectId: service.projectId });

  await teardown({ type: "deletion.requested", projectId: service.projectId });

  expect(await viaRouter(host)).toMatch(/ 404$/);
  expect(await containersOf(service.id)).toEqual([]);
  expect(await testDb.project.count()).toBe(0);
  expect(await testDb.service.count()).toBe(0);
});

it("leaves a service alone when its deletion was never requested", async () => {
  const { service } = await live();

  await teardown({ type: "deletion.requested", serviceId: service.id });
  await teardown({ type: "deletion.requested", projectId: service.projectId });

  expect(await viaRouter(host)).toMatch(/ 200$/);
  expect(await testDb.service.count()).toBe(1);
});

it("keeps a deletion pending when the router is down, and requests it again later", async () => {
  const { service } = await live();
  await projects.requestDeletion({ serviceId: service.id });
  const offline = createTeardownHandler(testDb, { caddyAdminUrl: "http://127.0.0.1:1" });

  await expect(offline({ type: "deletion.requested", serviceId: service.id })).rejects.toThrow(
    "Could not update the router",
  );

  expect(await testDb.service.count()).toBe(1);
  expect(await projects.retryDeletions(new Date(Date.now() - 60_000))).toBe(0);
  expect(await projects.retryDeletions(new Date(Date.now() + 1000))).toBe(1);
  const outbox = await testDb.outbox.findMany({ orderBy: { id: "asc" } });
  expect(outbox.at(-1)).toMatchObject({
    type: "deletion.requested",
    payload: { serviceId: service.id },
  });
});
