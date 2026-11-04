import { rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { GitHubClient } from "../github/github.client.js";
import { githubRepository } from "../github/github.repository.js";
import {
  StepFailure,
  buildImage,
  pushImage,
  saveArchive,
  unpackSource,
  workspace,
} from "./deployments.build.js";
import { deploymentsRepository } from "./deployments.repository.js";

const message = z.object({ type: z.literal("deployment.requested"), deploymentId: z.guid() });

type Options = {
  registryHost: string;
  retryDelays?: number[];
  timeouts?: { build: number; push: number };
};

export function createDeploymentHandler(
  db: PrismaClient,
  github: GitHubClient,
  {
    registryHost,
    retryDelays = [1000, 2000, 4000],
    timeouts = { build: 15 * 60_000, push: 5 * 60_000 },
  }: Options,
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

  async function fromGitHub<T>(work: () => Promise<T>) {
    try {
      return await withRetries(work);
    } catch (error) {
      console.error(error);
      throw new StepFailure("GitHub did not respond. Try deploying again.");
    }
  }

  return async function handle(body: unknown) {
    const { deploymentId } = message.parse(body);
    if (!(await repo.claim(deploymentId))) return;

    const deployment = await repo.findWithService(deploymentId);
    const { service } = deployment;
    const repository = service.repositoryFullName;
    const imageName = `${registryHost}/services/${service.id}`;
    const tag = `${imageName}:${deploymentId}`;
    const dir = workspace(deploymentId);
    let commitSha = deployment.commitSha;
    let installationId = 0;
    let context = "";
    let image = "";

    const steps: [string, () => Promise<string | void>][] = [
      [
        "resolve-commit",
        async () => {
          const installation = await installations.findForOrganization(
            service.project.organizationId,
          );
          if (!installation) throw new StepFailure("GitHub is not connected");
          installationId = Number(installation.installationId);
          if (commitSha) return;
          const sha = await fromGitHub(() =>
            github.branchCommit(installationId, repository, service.branch),
          );
          if (!sha) throw new StepFailure(`Branch ${service.branch} not found in ${repository}`);
          commitSha = sha;
          await repo.saveCommit(deploymentId, sha);
        },
      ],
      [
        "fetch-source",
        async () => {
          const short = commitSha!.slice(0, 7);
          const found = await fromGitHub(async () => {
            const archive = await github.sourceArchive(installationId, repository, commitSha!);
            if (archive) await saveArchive(archive, dir);
            return archive !== null;
          });
          if (!found) throw new StepFailure(`Commit ${short} not found in ${repository}`);
          context = await unpackSource(dir, service.sourceDirectory, short);
        },
      ],
      ["build", () => buildImage(context, tag, timeouts.build)],
      [
        "push",
        async () => {
          const { digest, log } = await pushImage(tag, timeouts.push);
          image = `${imageName}@${digest}`;
          return log;
        },
      ],
    ];

    try {
      for (const [index, [name, work]] of steps.entries()) {
        await repo.startStep(deploymentId, name);
        let log: string | undefined;
        try {
          log = (await work()) || undefined;
        } catch (error) {
          if (!(error instanceof StepFailure)) throw error;
          await repo.finish(deploymentId, name, {
            status: "failed",
            commitSha,
            error: error.message,
            log: error.log,
          });
          return;
        }
        if (index < steps.length - 1) await repo.completeStep(deploymentId, name, log);
        else await repo.finish(deploymentId, name, { status: "succeeded", commitSha, image, log });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
