import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { encrypt } from "../../secrets.js";
import { createApp } from "../../server.js";
import { createService, resetDb, testDb, testKey } from "../../test/db.js";
import { deploymentsRepository } from "../deployments/deployments.repository.js";
import { createAlertSender, type PostJson } from "./alerts.send.js";

const mailpit = process.env.TEST_MAILPIT_URL!;
const smtpUrl = process.env.TEST_SMTP_URL!;
if (!mailpit || !smtpUrl) throw new Error("TEST_MAILPIT_URL and TEST_SMTP_URL must be set");

const app = createApp({ db: testDb, encryptionKey: testKey, emailAlerts: true });
const slackUrl = "https://hooks.slack.com/services/T000/B000/abc123";
const deployments = deploymentsRepository(testDb);

async function signedIn(email = "dev@example.com") {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ email, password: "a-long-password" });
  const orgId = (await agent.get("/api/me")).body.organizations[0].id as string;
  return { agent, orgId };
}

async function failedDeploy(orgId: string) {
  const service = await createService(orgId);
  const user = await testDb.user.findFirstOrThrow();
  const deployment = (await deployments.create(service.id, user.id, "k1"))!;
  await deployments.saveCommit(deployment.id, "f2edcd7aa");
  await deployments.startStep(deployment.id, "health");
  await deployments.finish(deployment.id, "health", {
    status: "failed",
    error: "Your app did not pass its health check within 60 seconds",
  });
  return deployment;
}

const inbox = async () =>
  (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
    messages: { Subject: string; To: { Address: string }[] }[];
  };

const alertMessage = async () =>
  (await testDb.outbox.findMany({ where: { type: "alert.requested" } })).map((o) => ({
    type: o.type,
    ...(o.payload as object),
  }))[0]!;

beforeEach(async () => {
  await resetDb();
  await fetch(`${mailpit}/api/v1/messages`, { method: "DELETE" });
});

it("records an alert and its outbox message when a deploy fails", async () => {
  const { orgId } = await signedIn();

  const deployment = await failedDeploy(orgId);

  const [alert] = await testDb.alert.findMany();
  expect(alert).toMatchObject({
    organizationId: orgId,
    deploymentId: deployment.id,
    kind: "deploy_failed",
    title: "api: deploy failed",
    message:
      "Deploy of f2edcd7 for api in sample-shop failed at Check health: Your app did not pass its health check within 60 seconds. Nothing was live before, so the service has no running version.",
  });
  expect(await alertMessage()).toEqual({ type: "alert.requested", alertId: alert!.id });
});

it("emails every member and posts to Slack once, even when the message is delivered twice", async () => {
  const { orgId } = await signedIn("owner@example.com");
  await testDb.organization.update({
    where: { id: orgId },
    data: { slackWebhook: encrypt(testKey, slackUrl) },
  });
  await failedDeploy(orgId);
  const post = vi.fn<PostJson>(async () => ({ ok: true, status: 200 }));
  const send = createAlertSender(testDb, {
    smtpUrl,
    appUrl: "http://forgeops.test",
    encryptionKey: testKey,
    post,
  });

  await send(await alertMessage());
  await send(await alertMessage());

  const { messages } = await inbox();
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({
    Subject: "api: deploy failed",
    To: [{ Address: "owner@example.com" }],
  });
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0]![0]).toBe(slackUrl);
  expect(JSON.stringify(post.mock.calls[0]![1])).toContain("http://forgeops.test/app/deployments/");
  const alert = await testDb.alert.findFirstOrThrow();
  expect(alert.emailedAt).not.toBeNull();
  expect(alert.slackedAt).not.toBeNull();
});

it("retries only Slack when Slack fails after the email went out", async () => {
  const { orgId } = await signedIn();
  await testDb.organization.update({
    where: { id: orgId },
    data: { slackWebhook: encrypt(testKey, slackUrl) },
  });
  await failedDeploy(orgId);
  const post = vi
    .fn<PostJson>()
    .mockResolvedValueOnce({ ok: false, status: 500 })
    .mockResolvedValue({ ok: true, status: 200 });
  const send = createAlertSender(testDb, { smtpUrl, appUrl: "", encryptionKey: testKey, post });

  await expect(send(await alertMessage())).rejects.toThrow("Slack answered 500");
  await send(await alertMessage());

  expect((await inbox()).messages).toHaveLength(1);
  expect(post).toHaveBeenCalledTimes(2);
  expect((await testDb.alert.findFirstOrThrow()).slackedAt).not.toBeNull();
});

it("saves a Slack webhook encrypted, never returns it, and accepts only Slack addresses", async () => {
  const { agent, orgId } = await signedIn();
  const url = `/api/organizations/${orgId}/alerts`;

  for (const bad of [
    "http://hooks.slack.com/services/x",
    "https://127.0.0.1:2019/config",
    "nope",
  ]) {
    expect((await agent.put(`${url}/slack`).send({ url: bad })).status).toBe(400);
  }
  expect((await agent.put(`${url}/slack`).send({ url: slackUrl })).status).toBe(204);

  const stored = await testDb.organization.findUniqueOrThrow({ where: { id: orgId } });
  expect(stored.slackWebhook).not.toContain("hooks.slack.com");
  const settings = await agent.get(url);
  expect(settings.body).toEqual({ email: ["dev@example.com"], slackConnected: true, alerts: [] });
  expect(JSON.stringify(settings.body)).not.toContain("hooks.slack.com");

  expect((await agent.put(`${url}/slack`).send({ url: null })).status).toBe(204);
  expect((await agent.get(url)).body.slackConnected).toBe(false);
});

it("queues a test alert and keeps each organization's alerts to its members", async () => {
  const owner = await signedIn("owner@example.com");
  const stranger = await signedIn("stranger@example.com");
  const url = `/api/organizations/${owner.orgId}/alerts`;

  const test = await owner.agent.post(`${url}/test`);
  expect(test.status).toBe(202);
  expect(await alertMessage()).toEqual({ type: "alert.requested", alertId: test.body.id });
  expect((await owner.agent.get(url)).body.alerts).toMatchObject([{ kind: "test" }]);

  expect((await stranger.agent.get(url)).status).toBe(404);
  expect((await stranger.agent.post(`${url}/test`)).status).toBe(404);
  expect((await stranger.agent.put(`${url}/slack`).send({ url: slackUrl })).status).toBe(404);
  expect((await request(app).get(url)).status).toBe(401);
});
