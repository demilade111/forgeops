import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { HttpError } from "../../../lib/http-error.js";
import type { GitHubClient, Source } from "../clients/github.client.js";
import { githubRepository } from "../repositories/github.repository.js";

export type Connection =
  | { result: "linked" }
  | { result: "install"; organizationId: string }
  | { result: "choose"; choices: string };

export function githubService(db: PrismaClient, github: GitHubClient | null) {
  const repo = githubRepository(db);

  function client() {
    if (!github) throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub is not set up");
    return github;
  }

  async function installationId(organizationId: string) {
    const installation = await repo.findForOrganization(organizationId);
    return installation ? Number(installation.installationId) : null;
  }

  async function inspectSource(organizationId: string, source: Source) {
    const gh = client();
    const id = await installationId(organizationId);
    if (id === null) {
      throw new HttpError(400, "GITHUB_NOT_CONNECTED", "Connect GitHub to this organization first");
    }
    return gh.inspectSource(id, source);
  }

  async function connect(organizationId: string, code: string, pick: number): Promise<Connection> {
    const mine = await client().userInstallations(code);
    const chosen = pick ? mine.find((i) => i.id === pick) : mine.length === 1 ? mine[0] : null;
    if (pick && !chosen) {
      throw new HttpError(403, "INSTALLATION_NOT_YOURS", "That installation is not yours");
    }
    if (chosen) {
      await repo.link(chosen.id, chosen.account, organizationId);
      return { result: "linked" };
    }
    if (mine.length === 0) return { result: "install", organizationId };
    return { result: "choose", choices: mine.map((i) => `${i.id}:${i.account}`).join(",") };
  }

  async function repositories(organizationId: string) {
    const gh = client();
    const installation = await repo.findForOrganization(organizationId);
    if (!installation) return { connected: false, repositories: [] };
    return {
      connected: true,
      account: installation.accountLogin,
      manageUrl: gh.installUrl(),
      repositories: await gh.listRepositories(Number(installation.installationId)),
    };
  }

  return { installationId, inspectSource, connect, repositories };
}
