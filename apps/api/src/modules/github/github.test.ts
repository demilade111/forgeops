import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../../server.js";
import { resetDb, testDb } from "../../test/db.js";
import type { GitHubClient, Installation } from "./github.client.js";

const repos = [
  { id: 1, fullName: "demilade111/forgeops-sample-api", private: true, defaultBranch: "main" },
];

function fakeGitHub(installations: Installation[] = [{ id: 42, account: "demilade111" }]) {
  return {
    installUrl: (state: string) => `https://github.test/install?state=${state}`,
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

async function startInstall(agent: request.Agent, orgId: string) {
  const res = await agent.get(`/api/github/install?organizationId=${orgId}`);
  return new URL(res.headers.location!).searchParams.get("state")!;
}

beforeEach(() => resetDb());

it("redirects to GitHub with a state value tied to a short-lived cookie", async () => {
  const { agent, orgId } = await signedIn(fakeGitHub());
  const res = await agent.get(`/api/github/install?organizationId=${orgId}`);

  expect(res.status).toBe(302);
  expect(res.headers.location).toMatch(/^https:\/\/github\.test\/install\?state=.+/);
  const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
  expect(cookie).toMatch(/^forgeops_github_state=/);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Path=\/api\/github/);
});

it("links the installation after GitHub confirms it belongs to the user", async () => {
  const github = fakeGitHub();
  const { agent, orgId } = await signedIn(github);
  const state = await startInstall(agent, orgId);

  const res = await agent.get(`/api/github/callback?code=abc&installation_id=42&state=${state}`);

  expect(res.headers.location).toBe("/?github=connected");
  expect(github.userInstallations).toHaveBeenCalledWith("abc");
  const repos = await agent.get(`/api/github/repositories?organizationId=${orgId}`);
  expect(repos.body).toEqual({
    connected: true,
    account: "demilade111",
    repositories: repos.body.repositories,
  });
  expect(repos.body.repositories[0].fullName).toBe("demilade111/forgeops-sample-api");
});

it("refuses an installation id that is not in the user's own GitHub installations", async () => {
  const { agent, orgId } = await signedIn(fakeGitHub([{ id: 42, account: "demilade111" }]));
  const state = await startInstall(agent, orgId);

  const res = await agent.get(`/api/github/callback?code=abc&installation_id=999&state=${state}`);

  expect(res.headers.location).toBe("/?github_error=INSTALLATION_NOT_YOURS");
  expect(await testDb.gitHubInstallation.count()).toBe(0);
});

it("refuses a callback whose state does not match the cookie", async () => {
  const github = fakeGitHub();
  const { agent, orgId } = await signedIn(github);
  await startInstall(agent, orgId);

  const res = await agent.get("/api/github/callback?code=abc&installation_id=42&state=forged");

  expect(res.headers.location).toBe("/?github_error=INVALID_GITHUB_CALLBACK");
  expect(github.userInstallations).not.toHaveBeenCalled();
  expect(await testDb.gitHubInstallation.count()).toBe(0);
});

it("refuses to move an installation that another organization already uses", async () => {
  const github = fakeGitHub();
  const first = await signedIn(github, "first@example.com");
  await first.agent.get(
    `/api/github/callback?code=a&installation_id=42&state=${await startInstall(first.agent, first.orgId)}`,
  );

  const second = await signedIn(github, "second@example.com");
  const state = await startInstall(second.agent, second.orgId);
  const res = await second.agent.get(
    `/api/github/callback?code=b&installation_id=42&state=${state}`,
  );

  expect(res.headers.location).toBe("/?github_error=INSTALLATION_IN_USE");
});

it("does not reveal another organization's repositories", async () => {
  const github = fakeGitHub();
  const owner = await signedIn(github, "owner@example.com");
  await owner.agent.get(
    `/api/github/callback?code=a&installation_id=42&state=${await startInstall(owner.agent, owner.orgId)}`,
  );

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
