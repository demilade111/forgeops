import { z } from "zod";
import type { PrismaClient } from "../../database/prisma-client/client.js";
import { removeContainers, removeRoute } from "../deployments/jobs/deployments.release.js";
import { projectsRepository } from "./projects.repository.js";

const message = z.union([
  z.object({ type: z.literal("deletion.requested"), projectId: z.guid() }),
  z.object({ type: z.literal("deletion.requested"), serviceId: z.guid() }),
]);

export function createTeardownHandler(
  db: PrismaClient,
  { caddyAdminUrl }: { caddyAdminUrl: string },
) {
  const repo = projectsRepository(db);

  return async function handle(body: unknown) {
    const parsed = message.parse(body);
    const target =
      "projectId" in parsed ? { projectId: parsed.projectId } : { serviceId: parsed.serviceId };
    for (const { id } of await repo.servicesToRemove(target)) {
      await removeRoute(caddyAdminUrl, `svc-${id}`);
      await removeContainers(id);
    }
    await repo.finishDeletion(target);
  };
}
