import { randomUUID } from "node:crypto";
import request from "supertest";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../http-error.js";
import { createService, createUser, resetDb, testDb, testKey } from "../../test/db.js";
import { encrypt } from "../../secrets.js";
import { createApp } from "../../server.js";
import {
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
import { createLogCollector } from "./deployments.logs.js";
import { createMetricsCollector } from "./deployments.metrics.js";
import { createWatcher } from "./deployments.watch.js";
import { createDeploymentHandler } from "./deployments.worker.js";

const hello = sourceArchive(webApp);

const github = {
  authorizeUrl: () => "https://github.test/authorize",
  installUrl: () => "https://github.test/install",
  userInstallations: vi.fn(async () => []),
  listRepositories: vi.fn(async () => []),
  inspectSource: vi.fn(async () => ({ repositoryId: 777 })),
  branchCommit: vi.fn(async (): Promise<string | null> => "9f2c41e"),
  sourceArchive: vi.fn(async (): Promise<Readable | null> => hello()),
} satisfies GitHubClient;

const repo = deploymentsRepository(testDb);
const create = async (
  serviceId: string,
  userId: string,
  key: string,
  rollbackTo?: Parameters<typeof repo.create>[3],
) => (await repo.create(serviceId, userId, key, rollbackTo))!;
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

const checkRoutes = async (prefix = "check-") => {
  const res = await fetch(
    `${workerOptions.caddyAdminUrl}/config/apps/http/servers/forgeops/routes`,
  );
  const routes = (await res.json()) as { "@id"?: string }[];
  return routes.map((r) => r["@id"]).filter((id) => id?.startsWith(prefix));
};

const setHealthPath = (serviceId: string, healthCheckPath: string) =>
  testDb.$transaction([
    testDb.service.update({ where: { id: serviceId }, data: { healthCheckPath } }),
    testDb.deployment.updateMany({
      where: { serviceId, status: "queued" },
      data: { healthCheckPath },
    }),
  ]);

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
    ["health", "succeeded"],
    ["route", "succeeded"],
  ]);
  expect(done.steps[5]!.log).toBe("GET /health/ready returned 200");
  expect(await checkRoutes()).toEqual([]);
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
  expect(done.steps).toHaveLength(7);
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

it("fails the deploy when the app never passes its health check, and keeps the old version", async () => {
  const { service, deployment } = await live();
  await setHealthPath(service.id, "/missing");
  const next = await create(service.id, deployment.triggeredById!, "k2");

  await handle({ type: "deployment.requested", deploymentId: next.id });

  const done = await reload(next.id);
  expect(done).toMatchObject({
    status: "failed",
    error: "Your app did not pass its health check within 5 seconds",
    url: null,
    image: expect.stringContaining("@sha256:"),
  });
  expect(done.steps.at(-1)).toMatchObject({
    name: "health",
    status: "failed",
    log: expect.stringContaining("GET /missing returned 404"),
  });
  expect(await viaRouter(host)).toBe("hello \n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${deployment.id}`]);
  expect(await checkRoutes()).toEqual([]);
});

it("fails the start step with the app's own output when it crashes on start", async () => {
  const { service, deployment, message } = await queued();
  withSource({ Dockerfile: 'FROM busybox:1.37\nCMD echo "missing DATABASE_URL" && exit 1\n' });
  const started = Date.now();

  await handle(message);

  const done = await reload(deployment.id);
  expect(Date.now() - started).toBeLessThan(15_000);
  expect(done.steps.map((s) => s.name)).not.toContain("health");
  expect(done.steps.at(-1)).toMatchObject({
    name: "run",
    status: "failed",
    error: "Your app stopped while starting",
    log: expect.stringContaining("missing DATABASE_URL"),
  });
  expect(await containersOf(service.id)).toEqual([]);
});

it("explains a crash that printed nothing, such as a Dockerfile without a start command", async () => {
  const { deployment, message } = await queued();
  withSource({ Dockerfile: "FROM busybox:1.37\nCMD exit 1\n" });

  await handle(message);

  expect((await reload(deployment.id)).steps.at(-1)).toMatchObject({
    name: "run",
    error: "Your app stopped while starting",
    log: expect.stringContaining("Check that the Dockerfile has a CMD or ENTRYPOINT"),
  });
});

it("still catches an app that stops later, during its health check", async () => {
  const { service, deployment, message } = await queued();
  withSource({
    Dockerfile: 'FROM busybox:1.37\nCMD sleep 2 && echo "lost the database" && exit 1\n',
  });

  await handle(message);

  const steps = (await reload(deployment.id)).steps;
  expect(steps.find((s) => s.name === "run")).toMatchObject({
    status: "succeeded",
    log: "Still running after 1s",
  });
  expect(steps.at(-1)).toMatchObject({
    name: "health",
    status: "failed",
    error: "Your app stopped during its health check",
    log: expect.stringContaining("lost the database"),
  });
  expect(await containersOf(service.id)).toEqual([]);
});

it("accepts any answer from the app when no health check path is set", async () => {
  const { service, deployment, message } = await queued();
  await setHealthPath(service.id, "");
  withSource({
    Dockerfile: "FROM busybox:1.37\nCMD mkdir -p /www && exec httpd -f -p 8080 -h /www\n",
  });

  await handle(message);

  const done = await reload(deployment.id);
  expect(done.status).toBe("succeeded");
  expect(done.steps[5]!.log).toBe("GET / returned 404");
  await until(async () => (await viaRouter(host)).endsWith(" 404"));
});

it("does not count the router's own error as an answer from the app", async () => {
  const { service, deployment, message } = await queued();
  await setHealthPath(service.id, "");
  withSource({ Dockerfile: "FROM busybox:1.37\nCMD exec sleep 300\n" });

  await handle(message);

  expect(await reload(deployment.id)).toMatchObject({
    status: "failed",
    error: "Your app did not pass its health check within 5 seconds",
  });
  expect((await reload(deployment.id)).steps.at(-1)!.log).toContain("GET / got no answer");
  expect(await containersOf(service.id)).toEqual([]);
});

it("saves the build log while the build is still running", async () => {
  const { deployment, message } = await queued();
  withSource({
    Dockerfile: `FROM busybox:1.37\nRUN echo "step one done ${randomUUID()}" && sleep 4\n${webApp.Dockerfile.split("\n")[1]}\n`,
  });

  const running = handle(message);
  await until(async () => {
    const step = await testDb.deploymentStep.findFirst({
      where: { deploymentId: deployment.id, name: "build" },
    });
    return step?.status === "running" && !!step.log?.includes("step one done");
  });
  await running;

  expect((await reload(deployment.id)).status).toBe("succeeded");
});

it("shows the live app's own output to members of its organization", async () => {
  const app = createApp({ db: testDb, encryptionKey: testKey });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/signup")
    .send({ email: "logs@example.com", password: "a-long-password" });
  const orgId = (await agent.get("/api/me")).body.organizations[0].id as string;
  const service = await createService(orgId);
  const user = await testDb.user.findUniqueOrThrow({ where: { email: "logs@example.com" } });
  const deployment = await create(service.id, user.id, "k1");
  withSource(webApp);
  await handle({ type: "deployment.requested", deploymentId: deployment.id });
  expect((await agent.get(`/api/services/${service.id}/logs`)).body.log).toBe("");
  await createLogCollector(testDb)();

  const logs = await agent.get(`/api/services/${service.id}/logs?lines=50`);

  expect(logs.body).toMatchObject({ deploymentId: deployment.id, running: true });
  expect(logs.body.log).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z web app starting$/m);

  await run("docker", ["rm", "-f", `fo-${deployment.id}`], 30_000);
  await createLogCollector(testDb)();
  expect((await agent.get(`/api/services/${service.id}/logs`)).body).toEqual({
    deploymentId: deployment.id,
    running: false,
    log: "",
  });
});

const version = (text: string) => ({
  Dockerfile: `FROM busybox:1.37\nCMD mkdir -p /www/health && echo ok > /www/health/ready && echo "${text}" > /www/index.html && exec httpd -f -p 8080 -h /www\n`,
});

it("rolls back to an earlier image without rebuilding, using that deploy's port", async () => {
  const { service, deployment, message } = await queued();
  withSource(version("version one"));
  await handle(message);
  const second = await create(service.id, deployment.triggeredById!, "k2");
  withSource(version("version two"));
  await handle({ type: "deployment.requested", deploymentId: second.id });
  await until(async () => (await viaRouter(host)) === "version two\n 200");
  await testDb.service.update({ where: { id: service.id }, data: { port: 9090 } });
  const first = await reload(deployment.id);
  vi.clearAllMocks();

  const rollback = await create(service.id, deployment.triggeredById!, "r1", {
    ...first,
    image: first.image!,
  });
  await handle({ type: "deployment.requested", deploymentId: rollback.id });

  const done = await reload(rollback.id);
  expect(done).toMatchObject({
    status: "succeeded",
    trigger: "rollback",
    image: first.image,
    commitSha: first.commitSha,
    port: 8080,
  });
  expect(done.steps.map((s) => s.name)).toEqual(["run", "health", "route"]);
  expect(github.branchCommit).not.toHaveBeenCalled();
  expect(github.sourceArchive).not.toHaveBeenCalled();
  await until(async () => (await viaRouter(host)) === "version one\n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${rollback.id}`]);
});

it("keeps the live version when the old image is gone from the registry", async () => {
  const { service, deployment } = await live();
  const missing = `${registryHost}/services/${service.id}@sha256:${"0".repeat(64)}`;

  const rollback = await create(service.id, deployment.triggeredById!, "r1", {
    id: deployment.id,
    commitSha: "9f2c41e",
    image: missing,
    port: 8080,
    healthCheckPath: "/health/ready",
  });
  await handle({ type: "deployment.requested", deploymentId: rollback.id });

  expect(await reload(rollback.id)).toMatchObject({
    status: "failed",
    error: "Could not start the container",
  });
  expect(await viaRouter(host)).toBe("hello \n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${deployment.id}`]);
});

const watch = createWatcher(testDb, workerOptions);

const healthyThen = (text: string, seconds: number, breaks: string) => ({
  Dockerfile: `FROM busybox:1.37\nCMD mkdir -p /www/health; echo ok > /www/health/ready; echo "${text}" > /www/index.html; httpd -p 8080 -h /www; sleep ${seconds}; ${breaks}\n`,
});
const failsHealthAfter = (text: string, seconds: number) =>
  healthyThen(text, seconds, "rm /www/health/ready; exec sleep 300");
const crashesAfter = (text: string, seconds: number) =>
  healthyThen(text, seconds, 'echo "out of memory"; exit 1');

async function deployVersion(serviceId: string, userId: string, key: string, files: object) {
  const next = await create(serviceId, userId, key);
  withSource(files as Record<string, string>);
  await handle({ type: "deployment.requested", deploymentId: next.id });
  return next;
}

const watchUntilDone = (id: string) =>
  until(async () => {
    await watch();
    return (await reload(id)).watchUntil === null;
  }, 30_000);

const autoRollbacks = () => testDb.deployment.findMany({ where: { trigger: "auto_rollback" } });

it("rolls back automatically when a live version keeps failing its health check", async () => {
  const { service, deployment: first, message } = await queued();
  withSource(version("version one"));
  await handle(message);
  const second = await deployVersion(service.id, first.triggeredById!, "k2", {
    ...failsHealthAfter("version two", 4),
  });
  expect((await reload(second.id)).watchUntil).not.toBeNull();
  await until(async () => (await viaRouter(host)) === "version two\n 200");

  await watchUntilDone(second.id);

  expect((await reload(second.id)).failedAfterLive).toBe(
    "Your app failed its health check 3 times in a row after going live (GET /health/ready returned 404)",
  );
  expect(await testDb.alert.findMany()).toMatchObject([
    {
      kind: "broke_after_live",
      deploymentId: second.id,
      message: expect.stringContaining("ForgeOps is rolling back to 9f2c41e."),
    },
  ]);
  const [rollback] = await autoRollbacks();
  expect(rollback).toMatchObject({
    rollbackOfId: first.id,
    triggeredById: null,
    image: (await reload(first.id)).image,
  });
  await handle({ type: "deployment.requested", deploymentId: rollback!.id });
  expect(await reload(rollback!.id)).toMatchObject({ status: "succeeded", watchUntil: null });
  await until(async () => (await viaRouter(host)) === "version one\n 200");
  expect(await containersOf(service.id)).toEqual([`fo-${rollback!.id}`]);
  expect(await checkRoutes("watch-")).toEqual([]);
});

it("rolls back at once when the live app crashes", async () => {
  const { service, deployment: first, message } = await queued();
  withSource(version("version one"));
  await handle(message);
  const second = await deployVersion(service.id, first.triggeredById!, "k2", {
    ...crashesAfter("version two", 3),
  });

  await watchUntilDone(second.id);

  expect((await reload(second.id)).failedAfterLive).toBe("Your app stopped after going live");
  expect(await autoRollbacks()).toMatchObject([{ rollbackOfId: first.id }]);
});

it("records the failure when there is no earlier version to go back to", async () => {
  const { deployment, message } = await queued();
  withSource(failsHealthAfter("only version", 2));
  await handle(message);

  await watchUntilDone(deployment.id);

  expect((await reload(deployment.id)).failedAfterLive).toMatch(
    /3 times in a row after going live .*There is no earlier version to roll back to\.$/,
  );
  expect(await autoRollbacks()).toEqual([]);
});

it("stops watching a healthy version when the watch window ends", async () => {
  const { deployment } = await live();

  await watch();
  expect((await reload(deployment.id)).watchUntil).not.toBeNull();
  await watch(new Date(Date.now() + 6 * 60_000));

  expect(await reload(deployment.id)).toMatchObject({ watchUntil: null, failedAfterLive: null });
  expect(await autoRollbacks()).toEqual([]);
  expect(await checkRoutes("watch-")).toEqual([]);
});

it("stops watching a version once a newer one is live", async () => {
  const { service, deployment: first } = await live();
  const second = await deployVersion(service.id, first.triggeredById!, "k2", webApp);

  await watch();

  expect(await reload(first.id)).toMatchObject({ watchUntil: null, failedAfterLive: null });
  expect((await reload(second.id)).watchUntil).not.toBeNull();
});

it("records CPU and memory for each service's live container and drops old samples", async () => {
  const { service, deployment } = await live();
  await testDb.metricSample.create({
    data: {
      serviceId: service.id,
      deploymentId: deployment.id,
      cpuPercent: 1,
      memoryBytes: 1n,
      memoryLimit: 1n,
      takenAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    },
  });

  await createMetricsCollector(testDb)();

  const samples = await testDb.metricSample.findMany();
  expect(samples).toHaveLength(1);
  expect(samples[0]).toMatchObject({ serviceId: service.id, deploymentId: deployment.id });
  expect(samples[0]!.cpuPercent).toBeGreaterThanOrEqual(0);
  expect(samples[0]!.memoryBytes).toBeGreaterThan(0n);
  expect(samples[0]!.memoryLimit).toBeGreaterThan(samples[0]!.memoryBytes);
});

it("does not record a container that is not the live version", async () => {
  const { service, deployment, message } = await queued();
  withSource(webApp);
  await handle(message);
  await testDb.deployment.update({ where: { id: deployment.id }, data: { status: "failed" } });

  await createMetricsCollector(testDb)();

  expect(await testDb.metricSample.count({ where: { serviceId: service.id } })).toBe(0);
});
