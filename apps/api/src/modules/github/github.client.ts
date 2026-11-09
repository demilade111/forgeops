import { sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import type { Config } from "../../config/config.js";
import { HttpError } from "../../lib/http-error.js";

export type GitHubAppCredentials = {
  appId: number;
  slug: string;
  privateKey: string;
  clientId: string | null;
  clientSecret: string | null;
};

export type Installation = { id: number; account: string };

export type Repository = { id: number; fullName: string; private: boolean; defaultBranch: string };

export type Source = { repository: string; branch: string; sourceDirectory: string };

export type GitHubClient = {
  authorizeUrl: (state: string) => string;
  installUrl: (state?: string) => string;
  userInstallations: (code: string) => Promise<Installation[]>;
  listRepositories: (installationId: number) => Promise<Repository[]>;
  inspectSource: (installationId: number, source: Source) => Promise<{ repositoryId: number }>;
  branchCommit: (
    installationId: number,
    repository: string,
    branch: string,
  ) => Promise<string | null>;
  sourceArchive: (
    installationId: number,
    repository: string,
    commitSha: string,
  ) => Promise<Readable | null>;
};

export function appJwt(appId: number, privateKey: string, now = Date.now()) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(now / 1000) - 60;
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat, exp: iat + 600, iss: String(appId) })}`;
  return `${unsigned}.${sign("sha256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
}

async function send(path: string, token: string, method = "GET") {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "forgeops",
    },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok && res.status !== 404) {
    throw new HttpError(502, "GITHUB_ERROR", `GitHub request failed (${res.status})`);
  }
  return res;
}

async function github<T>(path: string, token: string, method = "GET"): Promise<T> {
  const res = await send(path, token, method);
  if (!res.ok) throw new HttpError(502, "GITHUB_ERROR", `GitHub request failed (${res.status})`);
  return res.json() as Promise<T>;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function createGitHubClient(app: GitHubAppCredentials): GitHubClient {
  async function installationToken(installationId: number) {
    const jwt = appJwt(app.appId, app.privateKey);
    const { token } = await github<{ token: string }>(
      `/app/installations/${installationId}/access_tokens`,
      jwt,
      "POST",
    );
    return token;
  }

  return {
    authorizeUrl(state) {
      if (!app.clientId) {
        throw new HttpError(503, "GITHUB_OAUTH_NOT_CONFIGURED", "GitHub sign-in is not set up yet");
      }
      const query = new URLSearchParams({ client_id: app.clientId, state });
      return `https://github.com/login/oauth/authorize?${query}`;
    },

    installUrl: (state) =>
      `https://github.com/apps/${app.slug}/installations/new${state ? `?state=${encodeURIComponent(state)}` : ""}`,

    async userInstallations(code) {
      if (!app.clientId || !app.clientSecret) {
        throw new HttpError(503, "GITHUB_OAUTH_NOT_CONFIGURED", "GitHub sign-in is not set up yet");
      }
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code }),
      });
      const { access_token } = (await res.json()) as { access_token?: string };
      if (!access_token) {
        throw new HttpError(400, "GITHUB_AUTH_FAILED", "GitHub authorization failed. Try again.");
      }
      const { installations } = await github<{
        installations: { id: number; app_id: number; account: { login: string } }[];
      }>("/user/installations", access_token);
      return installations
        .filter((i) => i.app_id === app.appId)
        .map((i) => ({ id: i.id, account: i.account.login }));
    },

    async listRepositories(installationId) {
      const token = await installationToken(installationId);
      const { repositories } = await github<{
        repositories: { id: number; full_name: string; private: boolean; default_branch: string }[];
      }>("/installation/repositories?per_page=100", token);
      return repositories.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
      }));
    },

    async inspectSource(installationId, { repository, branch, sourceDirectory }) {
      const owner = await send(
        `/repos/${repository}/installation`,
        appJwt(app.appId, app.privateKey),
      );
      if (!owner.ok || ((await owner.json()) as { id: number }).id !== installationId) {
        throw new HttpError(
          400,
          "REPOSITORY_NOT_FOUND",
          `ForgeOps cannot see ${repository}. Install the GitHub App on it first.`,
        );
      }
      const token = await installationToken(installationId);
      const repo = await github<{ id: number }>(`/repos/${repository}`, token);
      if (!(await send(`/repos/${repository}/branches/${encodePath(branch)}`, token)).ok) {
        throw new HttpError(400, "BRANCH_NOT_FOUND", `Branch ${branch} not found in ${repository}`);
      }
      const dockerfile = sourceDirectory ? `${sourceDirectory}/Dockerfile` : "Dockerfile";
      const ref = encodeURIComponent(branch);
      if (
        !(await send(`/repos/${repository}/contents/${encodePath(dockerfile)}?ref=${ref}`, token))
          .ok
      ) {
        throw new HttpError(
          400,
          "DOCKERFILE_NOT_FOUND",
          `No Dockerfile at ${dockerfile} on ${branch}`,
        );
      }
      return { repositoryId: repo.id };
    },

    async branchCommit(installationId, repository, branch) {
      const token = await installationToken(installationId);
      const res = await send(`/repos/${repository}/branches/${encodePath(branch)}`, token);
      return res.ok ? ((await res.json()) as { commit: { sha: string } }).commit.sha : null;
    },

    async sourceArchive(installationId, repository, commitSha) {
      const token = await installationToken(installationId);
      const res = await send(`/repos/${repository}/tarball/${commitSha}`, token);
      return res.ok && res.body ? Readable.fromWeb(res.body) : null;
    },
  };
}

export const loadGitHubClient = (github: NonNullable<Config["github"]>) =>
  createGitHubClient({
    ...github,
    privateKey: readFileSync(github.privateKeyPath, "utf8"),
    clientSecret: github.clientSecretPath
      ? readFileSync(github.clientSecretPath, "utf8").trim()
      : null,
  });
