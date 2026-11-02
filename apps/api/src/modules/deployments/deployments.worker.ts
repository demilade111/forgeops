import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { GitHubClient } from "../github/github.client.js";
import { githubRepository } from "../github/github.repository.js";
import { deploymentsRepository, type Outcome } from "./deployments.repository.js";

const message = z.object({ type: z.literal("deployment.requested"), deploymentId: z.guid() });

export function createDeploymentHandler(
  db: PrismaClient,
  github: GitHubClient,
  { retryDelays = [1000, 2000, 4000] } = {},
) {
  const repo = deploymentsRepository(db);
  const installations = githubRepository(db);

  async function withRetries<T>(work: () => Promise<T>) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        if (attempt >= retryDelays.length) throw error;
        await sleep(retryDelays[attempt]);
      }
    }
  }

  async function resolveCommit(deploymentId: string): Promise<Outcome> {
    const { service } = await repo.findWithService(deploymentId);
    const installation = await installations.findForOrganization(service.project.organizationId);
    if (!installation) return { status: "failed", error: "GitHub is not connected" };
    try {
      const sha = await withRetries(() =>
        github.branchCommit(
          Number(installation.installationId),
          service.repositoryFullName,
          service.branch,
        ),
      );
      return sha
        ? { status: "succeeded", commitSha: sha }
        : {
            status: "failed",
            error: `Branch ${service.branch} not found in ${service.repositoryFullName}`,
          };
    } catch (error) {
      console.error(error);
      return { status: "failed", error: "GitHub did not respond. Try deploying again." };
    }
  }

  return async function handle(body: unknown) {
    const { deploymentId } = message.parse(body);
    if (!(await repo.claim(deploymentId))) return;
    await repo.startStep(deploymentId, "resolve-commit");
    await repo.finish(deploymentId, "resolve-commit", await resolveCommit(deploymentId));
  };
}
