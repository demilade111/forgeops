import { rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { decrypt } from "../../../lib/encryption.js";
import type { GitHubClient } from "../../github/clients/github.client.js";
import { githubService } from "../../github/services/github.service.js";
import {
  StepFailure,
  buildImage,
  pushImage,
  run,
  saveArchive,
  unpackSource,
  workspace,
} from "./deployments.build.js";
import { deploymentsRepository } from "../repositories/deployments.repository.js";
import {
  removeContainers,
  routeTo,
  startContainer,
  waitUntilStarted,
  waitUntilHealthy,
} from "./deployments.release.js";

const message = z.object({ type: z.literal("deployment.requested"), deploymentId: z.guid() });

type Options = {
  registryHost: string;
  caddyAdminUrl: string;
  caddyHttpUrl: string;
  encryptionKey: Buffer;
  retryDelays?: number[];
  timeouts?: { build: number; push: number };
  health?: { timeoutMs: number; intervalMs: number };
  startupMs?: number;
  watchMs?: number;
};

export function createDeploymentHandler(
  db: PrismaClient,
  github: GitHubClient,
  {
    registryHost,
    caddyAdminUrl,
    caddyHttpUrl,
    encryptionKey,
    retryDelays = [1000, 2000, 4000],
    timeouts = { build: 15 * 60_000, push: 5 * 60_000 },
    health = { timeoutMs: 60_000, intervalMs: 1000 },
    startupMs = 3000,
    watchMs = 5 * 60_000,
  }: Options,
) {
  const repo = deploymentsRepository(db);
  const installations = githubService(db, github);

  const streamLog = (deploymentId: string, step: string) => {
    let latest = "";
    let pending: NodeJS.Timeout | undefined;
    return (log: string) => {
      latest = log;
      pending ??= setTimeout(() => {
        pending = undefined;
        repo.saveStepLog(deploymentId, step, latest).catch((error) => console.error(error));
      }, 1000);
    };
  };

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
    const container = `fo-${deploymentId}`;
    const host = `${service.name}.${service.project.name}.localhost`;
    const url = `http://${host}`;
    let commitSha = deployment.commitSha;
    let installationId = 0;
    let context = "";
    let image = deployment.image ?? "";
    const port = deployment.port ?? service.port;

    const steps: [string, () => Promise<string | void>][] = [
      [
        "resolve-commit",
        async () => {
          const id = await installations.installationId(service.project.organizationId);
          if (id === null) throw new StepFailure("GitHub is not connected");
          installationId = id;
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
      ["build", () => buildImage(context, tag, timeouts.build, streamLog(deploymentId, "build"))],
      [
        "push",
        async () => {
          const { digest, log } = await pushImage(
            tag,
            timeouts.push,
            streamLog(deploymentId, "push"),
          );
          image = `${imageName}@${digest}`;
          return log;
        },
      ],
      [
        "run",
        async () => {
          let env: Record<string, string>;
          try {
            env = JSON.parse(decrypt(encryptionKey, service.envVars));
          } catch {
            throw new StepFailure("Could not read the service's env vars");
          }
          await startContainer(container, image, service.id, env, dir);
          try {
            return await waitUntilStarted(container, startupMs);
          } catch (error) {
            await run("docker", ["rm", "-f", container], 60_000);
            throw error;
          }
        },
      ],
      [
        "health",
        async () => {
          try {
            return await waitUntilHealthy({
              ...health,
              adminUrl: caddyAdminUrl,
              httpUrl: caddyHttpUrl,
              id: deploymentId,
              container,
              port,
              path: deployment.healthCheckPath ?? service.healthCheckPath,
            });
          } catch (error) {
            await run("docker", ["rm", "-f", container], 60_000);
            throw error;
          }
        },
      ],
      [
        "route",
        async () => {
          try {
            await routeTo(caddyAdminUrl, `svc-${service.id}`, host, `${container}:${port}`);
          } catch (error) {
            await run("docker", ["rm", "-f", container], 60_000);
            throw error;
          }
          await removeContainers(service.id, container).catch((error) => console.error(error));
        },
      ],
    ];

    try {
      const plan =
        deployment.trigger !== "manual"
          ? steps.filter(([name]) => ["run", "health", "route"].includes(name))
          : steps;
      for (const [index, [name, work]] of plan.entries()) {
        await repo.startStep(deploymentId, name);
        let log: string | undefined;
        try {
          log = (await work()) || undefined;
        } catch (error) {
          if (!(error instanceof StepFailure)) throw error;
          await repo.finish(deploymentId, name, {
            status: "failed",
            commitSha,
            image: image || undefined,
            error: error.message,
            log: error.log,
          });
          return;
        }
        if (index < plan.length - 1) await repo.completeStep(deploymentId, name, log);
        else
          await repo.finish(deploymentId, name, {
            status: "succeeded",
            commitSha,
            image,
            url,
            log,
            watchUntil:
              deployment.trigger === "manual" ? new Date(Date.now() + watchMs) : undefined,
          });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
