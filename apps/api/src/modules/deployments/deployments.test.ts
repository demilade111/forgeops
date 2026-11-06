import request from "supertest";
import { beforeEach, expect, it } from "vitest";
import { createApp } from "../../server.js";
import { createService, resetDb, testDb } from "../../test/db.js";

const app = createApp({ db: testDb });

async function signedIn(email = "dev@example.com") {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ email, password: "a-long-password" });
  const orgId = (await agent.get("/api/me")).body.organizations[0].id as string;
  const service = await createService(orgId);
  return { agent, serviceId: service.id };
}

beforeEach(resetDb);

it("queues a deployment and its outbox message together, returning 202", async () => {
  const { agent, serviceId } = await signedIn();

  const res = await agent
    .post(`/api/services/${serviceId}/deployments`)
    .set("Idempotency-Key", "k1");

  expect(res.status).toBe(202);
  expect(res.body).toMatchObject({
    serviceId,
    status: "queued",
    trigger: "manual",
    activeServiceId: serviceId,
    commitSha: null,
    steps: [],
  });
  const outbox = await testDb.outbox.findMany();
  expect(outbox).toEqual([
    expect.objectContaining({
      type: "deployment.requested",
      payload: { deploymentId: res.body.id },
      sentAt: null,
    }),
  ]);
});

it("requires a valid Idempotency-Key header", async () => {
  const { agent, serviceId } = await signedIn();

  const missing = await agent.post(`/api/services/${serviceId}/deployments`);
  expect(missing.status).toBe(400);
  expect(missing.body.error.message).toBe("Idempotency-Key header is required");

  const bad = await agent
    .post(`/api/services/${serviceId}/deployments`)
    .set("Idempotency-Key", "has spaces");
  expect(bad.status).toBe(400);
  expect(await testDb.deployment.count()).toBe(0);
});

it("returns the same deployment when the same key is sent again", async () => {
  const { agent, serviceId } = await signedIn();
  const url = `/api/services/${serviceId}/deployments`;

  const first = await agent.post(url).set("Idempotency-Key", "k1");
  const retry = await agent.post(url).set("Idempotency-Key", "k1");

  expect(retry.status).toBe(202);
  expect(retry.body.id).toBe(first.body.id);
  expect(await testDb.deployment.count()).toBe(1);
  expect(await testDb.outbox.count()).toBe(1);
});

it("refuses a second deployment while one is active, and allows it once finished", async () => {
  const { agent, serviceId } = await signedIn();
  const url = `/api/services/${serviceId}/deployments`;
  const first = await agent.post(url).set("Idempotency-Key", "k1");

  const second = await agent.post(url).set("Idempotency-Key", "k2");
  expect(second.status).toBe(409);
  expect(second.body.error).toEqual({
    code: "DEPLOYMENT_IN_PROGRESS",
    message: `Deployment ${first.body.id} is still in progress`,
  });

  await testDb.deployment.update({
    where: { id: first.body.id },
    data: { status: "failed", activeServiceId: null },
  });
  const third = await agent.post(url).set("Idempotency-Key", "k2");
  expect(third.status).toBe(202);
  expect(third.body.id).not.toBe(first.body.id);
});

it("creates one deployment when requests race", async () => {
  const { agent, serviceId } = await signedIn();
  const url = `/api/services/${serviceId}/deployments`;

  const sameKey = await Promise.all([
    agent.post(url).set("Idempotency-Key", "k1"),
    agent.post(url).set("Idempotency-Key", "k1"),
  ]);
  expect(sameKey.map((r) => r.status)).toEqual([202, 202]);
  expect(sameKey[0].body.id).toBe(sameKey[1].body.id);

  await testDb.deployment.updateMany({ data: { status: "failed", activeServiceId: null } });
  const differentKeys = await Promise.all([
    agent.post(url).set("Idempotency-Key", "k2"),
    agent.post(url).set("Idempotency-Key", "k3"),
  ]);
  expect(differentKeys.map((r) => r.status).sort()).toEqual([202, 409]);
  expect(await testDb.deployment.count()).toBe(2);
  expect(await testDb.outbox.count()).toBe(2);
});

it("lists and reads deployments with their steps", async () => {
  const { agent, serviceId } = await signedIn();
  const created = await agent
    .post(`/api/services/${serviceId}/deployments`)
    .set("Idempotency-Key", "k1");
  await testDb.deploymentStep.create({
    data: { deploymentId: created.body.id, name: "resolve-commit" },
  });

  const list = await agent.get(`/api/services/${serviceId}/deployments`);
  expect(list.body).toEqual([expect.objectContaining({ id: created.body.id })]);

  const one = await agent.get(`/api/deployments/${created.body.id}`);
  expect(one.body.steps).toEqual([
    expect.objectContaining({ name: "resolve-commit", status: "running" }),
  ]);
  expect(one.body).toMatchObject({
    triggeredBy: { email: "dev@example.com" },
    service: {
      id: serviceId,
      name: "api",
      branch: "main",
      repositoryFullName: "demilade111/forgeops-sample-api",
      project: { name: "sample-shop" },
    },
  });
  expect(one.body.service.envVars).toBeUndefined();
});

it("returns empty app logs before the first successful deploy, and validates lines", async () => {
  const { agent, serviceId } = await signedIn();

  const logs = await agent.get(`/api/services/${serviceId}/logs`);
  expect(logs.body).toEqual({ deploymentId: null, running: false, log: "" });
  expect((await agent.get(`/api/services/${serviceId}/logs?lines=0`)).status).toBe(400);
  expect((await agent.get(`/api/services/${serviceId}/logs?lines=5000`)).status).toBe(400);
});

it("hides other organizations' services and deployments", async () => {
  const owner = await signedIn("owner@example.com");
  const created = await owner.agent
    .post(`/api/services/${owner.serviceId}/deployments`)
    .set("Idempotency-Key", "k1");
  const stranger = await signedIn("stranger@example.com");

  const deploy = await stranger.agent
    .post(`/api/services/${owner.serviceId}/deployments`)
    .set("Idempotency-Key", "k9");
  expect(deploy.status).toBe(404);
  expect(deploy.body.error.code).toBe("SERVICE_NOT_FOUND");
  expect((await stranger.agent.get(`/api/services/${owner.serviceId}/deployments`)).status).toBe(
    404,
  );
  const read = await stranger.agent.get(`/api/deployments/${created.body.id}`);
  expect(read.status).toBe(404);
  expect(read.body.error.code).toBe("DEPLOYMENT_NOT_FOUND");
  expect((await stranger.agent.get("/api/deployments/not-a-uuid")).status).toBe(404);

  expect((await stranger.agent.get(`/api/services/${owner.serviceId}/logs`)).status).toBe(404);

  const anonymous = await request(app).get(`/api/deployments/${created.body.id}`);
  expect(anonymous.status).toBe(401);
  expect((await request(app).get(`/api/services/${owner.serviceId}/logs`)).status).toBe(401);
});
