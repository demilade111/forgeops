import type { Prisma } from "../../../database/prisma-client/client.js";

type Tx = Prisma.TransactionClient;

const stepNames: Record<string, string> = {
  "resolve-commit": "Find latest commit",
  "fetch-source": "Download code",
  build: "Build image",
  push: "Save image",
  run: "Start app",
  health: "Check health",
  route: "Go live",
};

export async function raise(tx: Tx, data: Prisma.AlertUncheckedCreateInput) {
  const alert = await tx.alert.create({ data });
  await tx.outbox.create({ data: { type: "alert.requested", payload: { alertId: alert.id } } });
  return alert;
}

async function describe(tx: Tx, deploymentId: string) {
  const d = await tx.deployment.findUniqueOrThrow({
    where: { id: deploymentId },
    include: { service: { include: { project: true } } },
  });
  return {
    d,
    sha: d.commitSha?.slice(0, 7) ?? "the latest commit",
    where: `${d.service.name} in ${d.service.project.name}`,
  };
}

export async function raiseDeployFailed(tx: Tx, deploymentId: string, step: string, error: string) {
  const { d, sha, where } = await describe(tx, deploymentId);
  const what = { manual: "Deploy", rollback: "Rollback", auto_rollback: "Automatic rollback" }[
    d.trigger
  ];
  const liveBefore = await tx.deployment.findFirst({
    where: { serviceId: d.serviceId, status: "succeeded", id: { not: d.id } },
  });
  return raise(tx, {
    organizationId: d.service.project.organizationId,
    deploymentId,
    kind: "deploy_failed",
    title: `${d.service.name}: ${what.toLowerCase()} failed`,
    message: `${what} of ${sha} for ${where} failed at ${stepNames[step] ?? step}: ${error}. ${
      liveBefore
        ? "The version that was live before is still serving visitors."
        : "Nothing was live before, so the service has no running version."
    }`,
  });
}

export async function raiseBrokeAfterLive(
  tx: Tx,
  deploymentId: string,
  reason: string,
  rollbackTo?: string | null,
) {
  const { d, sha, where } = await describe(tx, deploymentId);
  return raise(tx, {
    organizationId: d.service.project.organizationId,
    deploymentId,
    kind: "broke_after_live",
    title: `${d.service.name}: broke after going live`,
    message: `${sha} of ${where}: ${reason}.${
      rollbackTo ? ` ForgeOps is rolling back to ${rollbackTo.slice(0, 7)}.` : ""
    }`,
  });
}
