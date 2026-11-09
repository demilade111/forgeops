import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../../../lib/http-error.js";
import { createApp } from "../../../app.js";
import { resetDb, testDb } from "../../../../tests/helpers/db.js";
import type { GitHubClient, Installation } from "../clients/github.client.js";

const repos = [
  { id: 1, fullName: "demilade111/forgeops-sample-api", private: true, defaultBranch: "main" },
];

function fakeGitHub(installations: Installation[] = [{ id: 42, account: "demilade111" }]) {
  return {
    authorizeUrl: (state: string) => `https://github.test/authorize?state=${state}`,
    installUrl: (state?: string) => `https://github.test/install${state ? `?state=${state}` : ""}`,
    userInstallations: vi.fn(async () => installations),
    listRepositories: vi.fn(async () => repos),
    inspectSource: vi.fn(async () => ({ repositoryId: 1 })),
    branchCommit: vi.fn(async () => "9f2c41e"),
    sourceArchive: vi.fn(async () => null),
  } satisfies GitHubClient;
}

async function signedIn(github: GitHubClient | null, email = "dev@example.com") {
  const agent = request.agent(createApp({ db: testDb, github }));
  await agent.post("/api/auth/signup").send({ email, password: "a-long-password" });
  const me = await agent.get("/api/me");
  return { agent, orgId: me.body.organizations[0].id as string };
}

const stateOf = (location: string) => new URL(location).searchParams.get("state")!;

async function startConnect(agent: request.Agent, orgId: string, installationId?: number) {
  const pick = installationId ? `&installationId=${installationId}` : "";
  const res = await agent.get(`/api/github/install?organizationId=${orgId}${pick}`);
  return stateOf(res.headers.location!);
}

async function connect(agent: request.Agent, orgId: string) {
  const state = await startConnect(agent, orgId);
  return agent.get(`/api/github/callback?code=abc&state=${state}`);
}

beforeEach(() => resetDb());

it("starts with GitHub sign-in and a state value tied to a short-lived cookie", async () => {
  const { agent, orgId } = await signedIn(fakeGitHub());
  const res = await agent.get(`/api/github/install?organizationId=${orgId}`);

  expect(res.status).toBe(302);
  expect(res.headers.location).toMatch(/^https:\/\/github\.test\/authorize\?state=.+/);
  const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
  expect(cookie).toMatch(/^forgeops_github_state=/);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Path=\/api\/github/);
});

it("links an app the user already installed without sending them to the install page", async () => {
  const github = fakeGitHub();
  const { agent, orgId } = await signedIn(github);

  const res = await connect(agent, orgId);

  expect(res.headers.location).toBe("/app?github=connected");
  expect(github.userInstallations).toHaveBeenCalledWith("abc");
  const status = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(status.body).toMatchObject({
    connected: true,
    account: "demilade111",
    manageUrl: "https://github.test/install",
  });
  expect(status.body.repositories[0].fullName).toBe("demilade111/forgeops-sample-api");
});

it("sends a user without the app to the install page, then links what they installed", async () => {
  const installations: Installation[] = [];
  const github = fakeGitHub(installations);
  const { agent, orgId } = await signedIn(github);

  const first = await connect(agent, orgId);
  expect(first.headers.location).toMatch(/^https:\/\/github\.test\/install\?state=.+/);
  expect(await testDb.gitHubInstallation.count()).toBe(0);

  installations.push({ id: 42, account: "new-person" });
  const back = await agent.get(
    `/api/github/callback?code=def&installation_id=42&state=${stateOf(first.headers.location!)}`,
  );

  expect(back.headers.location).toBe("/app?github=connected");
  const status = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(status.body.account).toBe("new-person");
});

it("asks which account to use when the user can reach several installs", async () => {
  const github = fakeGitHub([
    { id: 42, account: "demilade111" },
    { id: 77, account: "acme-co" },
  ]);
  const { agent, orgId } = await signedIn(github);

  const res = await connect(agent, orgId);
  expect(res.headers.location).toBe(
    `/app?github_choose=${encodeURIComponent("42:demilade111,77:acme-co")}`,
  );
  expect(await testDb.gitHubInstallation.count()).toBe(0);

  const state = await startConnect(agent, orgId, 77);
  const picked = await agent.get(`/api/github/callback?code=ghi&state=${state}`);

  expect(picked.headers.location).toBe("/app?github=connected");
  const status = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(status.body.account).toBe("acme-co");
});

it("refuses an install the user's own GitHub account cannot reach", async () => {
  const { agent, orgId } = await signedIn(fakeGitHub([{ id: 42, account: "demilade111" }]));

  const forged = await agent.get(
    `/api/github/callback?code=abc&installation_id=999&state=${await startConnect(agent, orgId)}`,
  );
  const chosen = await agent.get(
    `/api/github/callback?code=abc&state=${await startConnect(agent, orgId, 999)}`,
  );

  expect(forged.headers.location).toBe("/app?github_error=INSTALLATION_NOT_YOURS");
  expect(chosen.headers.location).toBe("/app?github_error=INSTALLATION_NOT_YOURS");
  expect(await testDb.gitHubInstallation.count()).toBe(0);
});

it("refuses a callback whose state does not match the cookie", async () => {
  const github = fakeGitHub();
  const { agent, orgId } = await signedIn(github);
  await startConnect(agent, orgId);

  const res = await agent.get("/api/github/callback?code=abc&installation_id=42&state=forged");

  expect(res.headers.location).toBe("/app?github_error=INVALID_GITHUB_CALLBACK");
  expect(github.userInstallations).not.toHaveBeenCalled();
  expect(await testDb.gitHubInstallation.count()).toBe(0);
});

it("lets two workspaces use the same install when GitHub confirms access", async () => {
  const github = fakeGitHub();
  const first = await signedIn(github, "first@example.com");
  const second = await signedIn(github, "second@example.com");

  expect((await connect(first.agent, first.orgId)).headers.location).toBe("/app?github=connected");
  expect((await connect(second.agent, second.orgId)).headers.location).toBe(
    "/app?github=connected",
  );
  expect((await connect(second.agent, second.orgId)).headers.location).toBe(
    "/app?github=connected",
  );

  expect(await testDb.gitHubInstallation.count()).toBe(2);
  const status = await second.agent.get(`/api/github/repositories?organizationId=${second.orgId}`);
  expect(status.body.connected).toBe(true);
});

it("returns to the dashboard with an error when GitHub sign-in is not set up", async () => {
  const github = {
    ...fakeGitHub(),
    authorizeUrl: () => {
      throw new HttpError(503, "GITHUB_OAUTH_NOT_CONFIGURED", "GitHub sign-in is not set up yet");
    },
  };
  const { agent, orgId } = await signedIn(github);
  const res = await agent.get(`/api/github/install?organizationId=${orgId}`);
  expect(res.headers.location).toBe("/app?github_error=GITHUB_OAUTH_NOT_CONFIGURED");
});

it("does not reveal another organization's repositories", async () => {
  const github = fakeGitHub();
  const owner = await signedIn(github, "owner@example.com");
  await connect(owner.agent, owner.orgId);

  const other = await signedIn(github, "other@example.com");
  const res = await other.agent.get(`/api/github/repositories?organizationId=${owner.orgId}`);

  expect(res.status).toBe(404);
  expect(github.listRepositories).not.toHaveBeenCalled();
});

it("reports not connected before any installation is linked", async () => {
  const { agent, orgId } = await signedIn(fakeGitHub());
  const res = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(res.body).toEqual({ connected: false, repositories: [] });
});

it("requires login and a configured GitHub App", async () => {
  expect(
    (await request(createApp({ db: testDb, github: fakeGitHub() })).get("/api/github/install"))
      .status,
  ).toBe(401);

  const { agent, orgId } = await signedIn(null);
  const res = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(res.status).toBe(503);
  expect(res.body.error.code).toBe("GITHUB_NOT_CONFIGURED");
});
