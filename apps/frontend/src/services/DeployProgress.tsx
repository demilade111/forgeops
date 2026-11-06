import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { Link } from "react-router";
import { api } from "@/api";
import { duration, shortSha } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Deployment } from "@/types";
import { stepLabels } from "./DeploymentSteps";

const finished = (d: Deployment) => d.status === "succeeded" || d.status === "failed";

export function DeployProgress({
  deploymentId,
  onClose,
  onFinished,
}: {
  deploymentId: string;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [, tick] = useState(0);
  const log = useRef<HTMLPreElement>(null);
  const done = deployment ? finished(deployment) : false;

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.getDeployment(deploymentId);
        if (stopped) return;
        setDeployment(next);
        if (finished(next)) return onFinished();
      } catch {
        if (stopped) return;
      }
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [deploymentId, onFinished]);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [done]);

  const steps = deployment?.steps ?? [];
  const current = steps.find((s) => s.status === "failed") ?? steps.at(-1);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [current?.log]);

  if (!deployment) return null;
  const plan = stepLabels.filter(
    ([name]) => deployment.trigger === "manual" || ["run", "health", "route"].includes(name),
  );
  const index = plan.findIndex(([name]) => name === current?.name);
  const label = plan[index]?.[1] ?? "Waiting for the worker";
  const sha = shortSha(deployment.commitSha);
  const elapsed = duration(
    deployment.startedAt ?? deployment.createdAt,
    deployment.finishedAt ?? new Date().toISOString(),
  );
  const failed = deployment.status === "failed";

  return (
    <section
      className={cn(
        "bg-card overflow-hidden rounded-lg border",
        failed && "border-fail/40",
        deployment.status === "succeeded" && "border-ok/40",
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 text-lg font-medium">
            {!done && (
              <span className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
            )}
            {deployment.status === "succeeded" && (
              <Check className="text-ok size-5" strokeWidth={2.5} />
            )}
            {failed && <X className="text-fail size-5" strokeWidth={2.5} />}
            {!done && `Deploying ${sha ?? "the latest commit"}`}
            {deployment.status === "succeeded" && `Live in ${elapsed}`}
            {failed && `Deploy failed at ${label}`}
          </h2>
          <p className={cn("mt-1 text-sm", failed ? "text-fail" : "text-muted-foreground")}>
            {!done &&
              (index >= 0
                ? `Step ${index + 1} of ${plan.length}: ${label}, ${elapsed} so far`
                : "Waiting for the worker to pick it up")}
            {deployment.status === "succeeded" && `${sha} is now what visitors see.`}
            {failed && deployment.error}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {deployment.status === "succeeded" && deployment.url && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary flex items-center gap-1.5 text-sm hover:underline"
            >
              Visit
              <ExternalLink className="size-3.5" />
            </a>
          )}
          {done && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <ol className="flex gap-1.5 px-6 pt-5">
        {plan.map(([name, text], i) => {
          const step = steps.find((s) => s.name === name);
          const state = step?.status ?? "waiting";
          return (
            <li key={name} className="min-w-0 flex-1">
              <span
                className={cn(
                  "block h-1.5 rounded-full bg-muted",
                  state === "succeeded" && "bg-ok",
                  state === "failed" && "bg-fail",
                  state === "running" && "bg-primary animate-pulse",
                )}
              />
              <span
                className={cn(
                  "mt-2 truncate text-xs",
                  i !== index && "hidden sm:block",
                  state === "waiting" && "text-muted-foreground",
                  state === "failed" && "text-fail",
                  state === "running" && "text-primary font-medium",
                )}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="p-6 pt-5">
        {deployment.status !== "succeeded" && (
          <pre
            ref={log}
            className="mb-3 h-44 overflow-auto rounded-md border border-white/10 bg-[#0f0d1a] p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-[#e7e4f2]"
          >
            {current?.log?.trim() ||
              (done ? "No output for this step." : `Waiting for output from ${label}...`)}
          </pre>
        )}
        <p className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
          <span>
            {done
              ? failed
                ? "The version that was live before is still serving visitors."
                : "ForgeOps watches it for 5 minutes and rolls back if it breaks."
              : "Visitors keep seeing the current version until the new one passes its health check."}
          </span>
          <Link to={`/app/deployments/${deployment.id}`} className="text-primary hover:underline">
            Open deploy page
          </Link>
        </p>
      </div>
    </section>
  );
}
