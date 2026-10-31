import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appJwt, createGitHubClient } from "./github.client.js";

it("signs a short-lived app JWT that GitHub can verify with the app's public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);

  const jwt = appJwt(5550990, privateKey.export({ type: "pkcs1", format: "pem" }).toString(), now);
  const [header, payload, signature] = jwt.split(".");

  const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
  expect(decode(header!)).toEqual({ alg: "RS256", typ: "JWT" });
  expect(decode(payload!)).toEqual({ iat: now / 1000 - 60, exp: now / 1000 + 540, iss: "5550990" });
  expect(
    verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature!, "base64url"),
    ),
  ).toBe(true);
});

describe("inspectSource", () => {
  const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs1", format: "pem" })
    .toString();
  const client = createGitHubClient({
    appId: 1,
    slug: "app",
    privateKey,
    clientId: null,
    clientSecret: null,
  });
  const source = { repository: "me/app", branch: "feature/x", sourceDirectory: "api" };

  function stubGitHub(missing: string | null, coveredBy = 5) {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const path = new URL(url).pathname + new URL(url).search;
      calls.push(path);
      if (path.endsWith("/access_tokens")) return Response.json({ token: "t" });
      if (missing && path.includes(missing)) return new Response(null, { status: 404 });
      if (path.endsWith("/installation")) return Response.json({ id: coveredBy });
      return Response.json({ id: 99 });
    });
    return calls;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("checks the repository, branch and Dockerfile through the installation", async () => {
    const calls = stubGitHub(null);
    await expect(client.inspectSource(5, source)).resolves.toEqual({ repositoryId: 99 });
    expect(calls).toEqual([
      "/repos/me/app/installation",
      "/app/installations/5/access_tokens",
      "/repos/me/app",
      "/repos/me/app/branches/feature/x",
      "/repos/me/app/contents/api/Dockerfile?ref=feature%2Fx",
    ]);
  });

  it.each([
    ["/repos/me/app", "REPOSITORY_NOT_FOUND"],
    ["/branches/", "BRANCH_NOT_FOUND"],
    ["/contents/", "DOCKERFILE_NOT_FOUND"],
  ])("maps a 404 on %s to %s", async (missing, code) => {
    stubGitHub(missing);
    await expect(client.inspectSource(5, source)).rejects.toMatchObject({ status: 400, code });
  });

  it("refuses a repository that GitHub can read but another installation covers", async () => {
    stubGitHub(null, 6);
    await expect(client.inspectSource(5, source)).rejects.toMatchObject({
      code: "REPOSITORY_NOT_FOUND",
    });
  });

  it("refuses OAuth verification when the client secret is not configured", async () => {
    await expect(client.userInstallations("code")).rejects.toMatchObject({
      code: "GITHUB_OAUTH_NOT_CONFIGURED",
    });
  });
});
