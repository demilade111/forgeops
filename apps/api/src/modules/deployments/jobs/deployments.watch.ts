import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { deploymentsRepository } from "../repositories/deployments.repository.js";
import { checkLive, removeRoute } from "./deployments.release.js";

export function createWatcher(
  db: PrismaClient,
  {
    caddyAdminUrl,
    caddyHttpUrl,
    failuresAllowed = 3,
  }: { caddyAdminUrl: string; caddyHttpUrl: string; failuresAllowed?: number },
) {
  const repo = deploymentsRepository(db);

  const stop = async (id: string, reason?: string, rollbackTo?: string | null) => {
    await repo.stopWatching(id, reason, rollbackTo);
    await removeRoute(caddyAdminUrl, `watch-${id}`).catch((error) => console.error(error));
  };

  return async function watch(now = new Date()) {
    for (const deployment of await repo.watched()) {
      const { id, serviceId, service } = deployment;
      if ((await repo.findLive(serviceId))?.id !== id) {
        await stop(id);
        continue;
      }
      const problem = await checkLive({
        adminUrl: caddyAdminUrl,
        httpUrl: caddyHttpUrl,
        id,
        container: `fo-${id}`,
        port: deployment.port ?? service.port,
        path: deployment.healthCheckPath ?? service.healthCheckPath,
      });
      if (!problem) {
        if (deployment.watchFailures > 0) await repo.countFailure(id, 0);
        if (deployment.watchUntil! <= now) await stop(id);
        continue;
      }
      const failures = deployment.watchFailures + 1;
      if (!problem.crashed && failures < failuresAllowed) {
        await repo.countFailure(id, failures);
        continue;
      }
      if (await repo.findActive(serviceId)) continue;
      const reason = problem.crashed
        ? "Your app stopped after going live"
        : `Your app failed its health check ${failures} times in a row after going live (${problem.detail})`;
      const target = await repo.previousGood(serviceId, deployment.createdAt);
      if (!target?.image) {
        await stop(id, `${reason}. There is no earlier version to roll back to.`);
        continue;
      }
      const rollback = await repo.create(
        serviceId,
        null,
        `auto-rollback-${id}`,
        { ...target, image: target.image },
        true,
      );
      if (rollback) await stop(id, reason, target.commitSha ?? target.id);
      else await stop(id);
    }
  };
}
