import type { PrismaClient } from "../../database/prisma-client/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { GitHubClient, Source } from "./github.client.js";
import { githubRepository } from "./github.repository.js";

export function githubService(db: PrismaClient, github: GitHubClient | null) {
  const repo = githubRepository(db);

  async function installationId(organizationId: string) {
    const installation = await repo.findForOrganization(organizationId);
    return installation ? Number(installation.installationId) : null;
  }

  async function inspectSource(organizationId: string, source: Source) {
    if (!github) throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub is not set up");
    const id = await installationId(organizationId);
    if (id === null) {
      throw new HttpError(400, "GITHUB_NOT_CONNECTED", "Connect GitHub to this organization first");
    }
    return github.inspectSource(id, source);
  }

  return { installationId, inspectSource };
}
