import { sign } from "node:crypto";
import { HttpError } from "../../http-error.js";

export type GitHubAppCredentials = {
  appId: number;
  slug: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
};

export type Installation = { id: number; account: string };

export type Repository = { id: number; fullName: string; private: boolean; defaultBranch: string };

export type GitHubClient = {
  installUrl: (state: string) => string;
  userInstallations: (code: string) => Promise<Installation[]>;
  listRepositories: (installationId: number) => Promise<Repository[]>;
};

export function appJwt(appId: number, privateKey: string, now = Date.now()) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(now / 1000) - 60;
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat, exp: iat + 600, iss: String(appId) })}`;
  return `${unsigned}.${sign("sha256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
}

async function github<T>(path: string, token: string, method = "GET"): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "forgeops",
    },
  });
  if (!res.ok) throw new HttpError(502, "GITHUB_ERROR", `GitHub request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function createGitHubClient(app: GitHubAppCredentials): GitHubClient {
  return {
    installUrl: (state) =>
      `https://github.com/apps/${app.slug}/installations/new?state=${encodeURIComponent(state)}`,

    async userInstallations(code) {
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
      const jwt = appJwt(app.appId, app.privateKey);
      const { token } = await github<{ token: string }>(
        `/app/installations/${installationId}/access_tokens`,
        jwt,
        "POST",
      );
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
  };
}
