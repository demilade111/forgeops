import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { deploymentsApi } from "@/features/deployments/api/deployments.api";
import { DeploymentSteps } from "@/features/deployments/components/DeploymentSteps";
import { RollbackButton } from "@/features/deployments/components/RollbackButton";
import { StatusBadge } from "@/features/deployments/components/StatusBadge";
import type { Deployment } from "@/features/deployments/types/deployments.types";
import { duration, shortSha, timeAgo } from "@/lib/format";
import { useCrumbs } from "@/stores/crumbs.store";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1.5 truncate text-sm">{children}</dd>
    </div>
  );
}

export function DeploymentPage() {
  const { deploymentId = "" } = useParams();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const service = deployment?.service;
  useCrumbs(
    service
      ? [
          { label: service.project.name, to: `/app/projects/${service.project.id}` },
          { label: service.name, to: `/app/services/${service.id}` },
          { label: `Deploy ${deploymentId.slice(-6)}`, to: `/app/deployments/${deploymentId}` },
        ]
      : [],
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await deploymentsApi.getDeployment(deploymentId);
        if (stopped) return;
        setDeployment(next);
        const history = await deploymentsApi.listDeployments(next.serviceId);
        if (stopped) return;
        setLiveId(history.find((d) => d.status === "succeeded")?.id ?? null);
        if (next.status === "queued" || next.status === "running") timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Could not load this deploy.");
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [deploymentId]);

  if (error) return <p className="text-fail text-sm">{error}</p>;
  if (!deployment || !service) {
    return <Loader2 className="text-muted-foreground size-5 animate-spin" />;
  }
  const repo = service.repositoryFullName;
  const digest = deployment.image?.split("@")[1];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium tracking-[-0.03em]">
            Deploy of {shortSha(deployment.commitSha) ?? service.branch}
          </h1>
          <StatusBadge status={deployment.status} />
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {deployment.trigger !== "manual" && deployment.rollbackOf && (
            <>
              {deployment.trigger === "auto_rollback" ? "Automatic rollback" : "Rollback"} to{" "}
              <Link
                to={`/app/deployments/${deployment.rollbackOf.id}`}
                className="text-primary font-mono underline-offset-4 hover:underline"
              >
                {shortSha(deployment.rollbackOf.commitSha) ?? "an earlier deploy"}
              </Link>
              .{" "}
            </>
          )}
          {service.name} in {service.project.name}, started {timeAgo(deployment.createdAt)}
          {deployment.triggeredBy
            ? ` by ${deployment.triggeredBy.email}`
            : deployment.trigger === "auto_rollback" && " by ForgeOps"}
        </p>
        {deployment.status === "succeeded" && liveId && liveId !== deployment.id && (
          <div className="mt-4 flex">
            <RollbackButton
              deployment={deployment}
              onStarted={(rollback) => navigate(`/app/deployments/${rollback.id}`)}
            />
          </div>
        )}
      </div>

      <section className="bg-card rounded-lg border p-6">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Commit">
            {deployment.commitSha ? (
              <a
                href={`https://github.com/${repo}/commit/${deployment.commitSha}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono underline-offset-4 hover:underline"
              >
                {shortSha(deployment.commitSha)}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="text-muted-foreground">Not resolved</span>
            )}
          </Fact>
          <Fact label="Branch">
            <span className="font-mono">{service.branch}</span>
          </Fact>
          <Fact label="Repository">
            <span className="font-mono">{repo}</span>
          </Fact>
          <Fact label="Image">
            {digest ? (
              <span className="font-mono" title={deployment.image ?? undefined}>
                {digest.slice(0, 19)}
              </span>
            ) : (
              <span className="text-muted-foreground">Not built</span>
            )}
          </Fact>
          <Fact label="Total time">
            <span className="font-mono">
              {duration(deployment.startedAt, deployment.finishedAt) ?? "Running"}
            </span>
          </Fact>
          <Fact label="URL">
            {deployment.url ? (
              <a
                href={deployment.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline-offset-4 hover:underline"
              >
                {deployment.url.replace("http://", "")}
              </a>
            ) : (
              <span className="text-muted-foreground">Not live</span>
            )}
          </Fact>
        </dl>
      </section>

      <section className="bg-card overflow-hidden rounded-lg border">
        {(deployment.error ?? deployment.failedAfterLive) && (
          <p className="bg-fail/10 text-fail border-b px-5 py-3 text-sm">
            {deployment.error ?? deployment.failedAfterLive}
          </p>
        )}
        <DeploymentSteps deployment={deployment} />
      </section>
    </div>
  );
}
