import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../http-error.js";
import { createApp } from "../../server.js";
import { resetDb, testDb } from "../../test/db.js";
import type { GitHubClient } from "../github/github.client.js";

const github = {
  authorizeUrl: () => "https://github.test/authorize",
  installUrl: () => "https://github.test/install",
  userInstallations: vi.fn(async () => []),
  listRepositories: vi.fn(async () => []),
  inspectSource: vi.fn(async () => ({ repositoryId: 777 })),
  branchCommit: vi.fn(async () => "9f2c41e"),
  sourceArchive: vi.fn(async () => null),
} satisfies GitHubClient;

const app = createApp({ db: testDb, github, encryptionKey: randomBytes(32) });

const service = {
  name: "api",
  repository: "demilade111/forgeops-sample-api",
  branch: "main",
  sourceDirectory: "./api/",
  port: 8080,
  envVars: { APP_VERSION: "1.0.0", DATABASE_PASSWORD: "supersecret" },
};

async function signedIn(email = "dev@example.com", { connected = true } = {}) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ email, password: "a-long-password" });
  const orgId = (await agent.get("/api/me")).body.organizations[0].id as string;
  if (connected) {
    await testDb.gitHubInstallation.create({
      data: {
        installationId: BigInt(Math.floor(Math.random() * 1e9)),
        accountLogin: email,
        organizationId: orgId,
      },
    });
  }
  const project = await agent
    .post("/api/projects")
    .send({ organizationId: orgId, name: "sample-shop" });
  return { agent, orgId, projectId: project.body.id as string };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

it("creates, lists and reads projects in the user's organization", async () => {
  const { agent, orgId, projectId } = await signedIn();

  const list = await agent.get(`/api/projects?organizationId=${orgId}`);
  expect(list.body).toEqual([expect.objectContaining({ id: projectId, name: "sample-shop" })]);

  const one = await agent.get(`/api/projects/${projectId}`);
  expect(one.body).toMatchObject({ id: projectId, organizationId: orgId, services: [] });

  const duplicate = await agent
    .post("/api/projects")
    .send({ organizationId: orgId, name: "sample-shop" });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe("NAME_TAKEN");
});

it("adds a web service after GitHub confirms the source, returning env var names only", async () => {
  const { agent, projectId } = await signedIn();

  const res = await agent.post(`/api/projects/${projectId}/services`).send(service);

  expect(res.status).toBe(201);
  expect(github.inspectSource).toHaveBeenCalledWith(expect.any(Number), {
    repository: "demilade111/forgeops-sample-api",
    branch: "main",
    sourceDirectory: "api",
  });
  expect(res.body).toMatchObject({
    name: "api",
    type: "web",
    buildMethod: "dockerfile",
    sourceDirectory: "api",
    port: 8080,
    envVarNames: ["APP_VERSION", "DATABASE_PASSWORD"],
  });
  expect(JSON.stringify(res.body)).not.toContain("supersecret");

  const stored = await testDb.service.findFirstOrThrow();
  expect(stored.repositoryId).toBe(777n);
  expect(stored.envVars).not.toContain("supersecret");
  expect(stored.envVars).not.toContain("DATABASE_PASSWORD");
});

it.each([
  [{ port: 70000 }, "Port must be between 1 and 65535"],
  [{ port: "8080" }, "Port must be a number"],
  [{ type: "worker" }, "Only web services are supported for now"],
  [{ buildMethod: "automatic" }, "Only Dockerfile builds are supported for now"],
  [{ sourceDirectory: "../secrets" }, "Source directory must be a folder inside the repository"],
  [{ repository: "not-a-repo" }, "Repository must look like owner/name"],
  [{ name: "My API" }, "Service name must use lowercase letters, numbers and dashes"],
  [{ envVars: { "BAD-NAME": "x" } }, "Env var names use letters, numbers and underscores"],
  [{ envVars: { KEY: "line1\nline2" } }, "Env var values cannot contain line breaks"],
])("rejects %j", async (change, message) => {
  const { agent, projectId } = await signedIn();
  const res = await agent
    .post(`/api/projects/${projectId}/services`)
    .send({ ...service, ...change });
  expect(res.status).toBe(400);
  expect(res.body.error.message).toContain(message);
  expect(github.inspectSource).not.toHaveBeenCalled();
});

it("refuses a service when GitHub is not connected or the source does not check out", async () => {
  const notConnected = await signedIn("solo@example.com", { connected: false });
  const res = await notConnected.agent
    .post(`/api/projects/${notConnected.projectId}/services`)
    .send(service);
  expect(res.body.error.code).toBe("GITHUB_NOT_CONNECTED");

  const { agent, projectId } = await signedIn();
  github.inspectSource.mockRejectedValueOnce(
    new HttpError(400, "BRANCH_NOT_FOUND", "Branch mian not found"),
  );
  const bad = await agent
    .post(`/api/projects/${projectId}/services`)
    .send({ ...service, branch: "mian" });
  expect(bad.status).toBe(400);
  expect(bad.body.error.code).toBe("BRANCH_NOT_FOUND");
  expect(await testDb.service.count()).toBe(0);
});

it("updates a service, merging env vars and re-checking GitHub only when the source changes", async () => {
  const { agent, projectId } = await signedIn();
  const { id } = (await agent.post(`/api/projects/${projectId}/services`).send(service)).body;
  github.inspectSource.mockClear();

  const portOnly = await agent
    .patch(`/api/services/${id}`)
    .send({ port: 3000, envVars: { DATABASE_PASSWORD: null, LOG_LEVEL: "debug" } });
  expect(portOnly.body).toMatchObject({ port: 3000, envVarNames: ["APP_VERSION", "LOG_LEVEL"] });
  expect(github.inspectSource).not.toHaveBeenCalled();

  const branch = await agent.patch(`/api/services/${id}`).send({ branch: "release" });
  expect(branch.body.branch).toBe("release");
  expect(github.inspectSource).toHaveBeenCalledWith(expect.any(Number), {
    repository: "demilade111/forgeops-sample-api",
    branch: "release",
    sourceDirectory: "api",
  });
});

it("saves a health check path, defaulting to /health/ready, and rejects bad ones", async () => {
  const { agent, projectId } = await signedIn();
  const created = await agent.post(`/api/projects/${projectId}/services`).send(service);
  expect(created.body.healthCheckPath).toBe("/health/ready");

  const cleared = await agent
    .patch(`/api/services/${created.body.id}`)
    .send({ healthCheckPath: "" });
  expect(cleared.body.healthCheckPath).toBe("");
  const custom = await agent
    .patch(`/api/services/${created.body.id}`)
    .send({ healthCheckPath: " /healthz " });
  expect(custom.body.healthCheckPath).toBe("/healthz");

  for (const bad of ["healthz", "/a b", "http://evil.test/"]) {
    const res = await agent
      .patch(`/api/services/${created.body.id}`)
      .send({ healthCheckPath: bad });
    expect(res.status).toBe(400);
  }
});

it("hides other organizations' projects and services", async () => {
  const owner = await signedIn("owner@example.com");
  const { id } = (await owner.agent.post(`/api/projects/${owner.projectId}/services`).send(service))
    .body;
  const other = await signedIn("other@example.com");

  expect((await other.agent.get(`/api/projects/${owner.projectId}`)).status).toBe(404);
  expect((await other.agent.get(`/api/projects?organizationId=${owner.orgId}`)).status).toBe(404);
  expect(
    (await other.agent.post("/api/projects").send({ organizationId: owner.orgId, name: "x" }))
      .status,
  ).toBe(404);
  expect(
    (await other.agent.post(`/api/projects/${owner.projectId}/services`).send(service)).status,
  ).toBe(404);
  expect((await other.agent.get(`/api/services/${id}`)).status).toBe(404);
  expect((await other.agent.patch(`/api/services/${id}`).send({ port: 1 })).status).toBe(404);
  expect((await owner.agent.get("/api/services/not-a-uuid")).status).toBe(404);
});

it("deletes a service in the background, hiding it at once and refusing new deploys", async () => {
  const { agent, projectId } = await signedIn();
  const { id } = (await agent.post(`/api/projects/${projectId}/services`).send(service)).body;

  expect((await agent.delete(`/api/services/${id}`)).status).toBe(202);

  expect((await agent.get(`/api/services/${id}`)).status).toBe(404);
  expect((await agent.get(`/api/projects/${projectId}`)).body.services).toEqual([]);
  const deploy = await agent.post(`/api/services/${id}/deployments`).set("Idempotency-Key", "k1");
  expect(deploy.status).toBe(404);
  expect((await agent.delete(`/api/services/${id}`)).status).toBe(404);
  const outbox = await testDb.outbox.findMany();
  expect(outbox.map((o) => [o.type, o.payload])).toEqual([
    ["deletion.requested", { serviceId: id }],
  ]);
});

it("deletes a project with its services, and hides it from the list", async () => {
  const { agent, orgId, projectId } = await signedIn();
  const { id } = (await agent.post(`/api/projects/${projectId}/services`).send(service)).body;

  expect((await agent.delete(`/api/projects/${projectId}`)).status).toBe(202);

  expect((await agent.get(`/api/projects?organizationId=${orgId}`)).body).toEqual([]);
  expect((await agent.get(`/api/projects/${projectId}`)).status).toBe(404);
  expect((await agent.get(`/api/services/${id}`)).status).toBe(404);
  expect((await testDb.service.findUniqueOrThrow({ where: { id } })).deletingAt).not.toBeNull();
  const outbox = await testDb.outbox.findMany();
  expect(outbox.map((o) => o.payload)).toEqual([{ projectId }]);
});

it("refuses to delete while a deploy is running", async () => {
  const { agent, projectId } = await signedIn();
  const { id } = (await agent.post(`/api/projects/${projectId}/services`).send(service)).body;
  await agent.post(`/api/services/${id}/deployments`).set("Idempotency-Key", "k1");

  for (const path of [`/api/services/${id}`, `/api/projects/${projectId}`]) {
    const res = await agent.delete(path);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPLOYMENT_IN_PROGRESS");
  }
  expect((await agent.get(`/api/services/${id}`)).status).toBe(200);
});

it("does not let other organizations delete", async () => {
  const owner = await signedIn("owner@example.com");
  const { id } = (await owner.agent.post(`/api/projects/${owner.projectId}/services`).send(service))
    .body;
  const other = await signedIn("other@example.com");

  expect((await other.agent.delete(`/api/services/${id}`)).status).toBe(404);
  expect((await other.agent.delete(`/api/projects/${owner.projectId}`)).status).toBe(404);
  expect((await owner.agent.get(`/api/services/${id}`)).status).toBe(200);
});

it("requires login", async () => {
  expect((await request(app).get("/api/projects")).status).toBe(401);
  expect((await request(app).get("/api/services/x")).status).toBe(401);
  expect((await request(app).delete("/api/projects/x")).status).toBe(401);
});
