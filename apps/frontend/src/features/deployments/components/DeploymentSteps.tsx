import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import type { Deployment } from "@/features/deployments/deployments.types";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";

export const stepLabels = [
  ["resolve-commit", "Find latest commit"],
  ["fetch-source", "Download code"],
  ["build", "Build image"],
  ["push", "Save image"],
  ["run", "Start app"],
  ["health", "Check health"],
  ["route", "Go live"],
] as const;

const outcomes = [
  ["Build", ["resolve-commit", "fetch-source", "build", "push"]],
  ["Rollout", ["run", "route"]],
  ["Health", ["health"]],
] as const;

const outcomeLabel = {
  failed: "Failed",
  running: "Running",
  succeeded: "Passed",
  waiting: "Waiting",
  stopped: "Stopped",
  skipped: "Not reached",
};

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : Date.now());

export function DeploymentSteps({ deployment }: { deployment: Deployment }) {
  const [open, setOpen] = useState<string | null>(null);
  const steps = deployment.steps ?? [];
  const finished = deployment.status === "failed" || deployment.status === "succeeded";
  const start = Math.min(...steps.map((s) => ms(s.startedAt)), ms(deployment.startedAt));
  const end = finished ? ms(deployment.finishedAt) : Date.now();
  const total = Math.max(end - start, 1);

  const outcomeOf = (names: readonly string[]) => {
    const group = steps.filter((s) => names.includes(s.name));
    if (group.some((s) => s.status === "failed")) return "failed";
    if (group.some((s) => s.status === "running")) return "running";
    if (group.length === names.length) return "succeeded";
    if (!finished) return group.length > 0 ? "running" : "waiting";
    return group.length > 0 ? "stopped" : "skipped";
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b px-5 py-3">
        {outcomes.map(([label, names]) => {
          const state = outcomeOf(names);
          return (
            <span
              key={label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                state === "succeeded" && "border-ok/30 bg-ok/5 text-ok",
                state === "failed" && "border-fail/30 bg-fail/5 text-fail",
                state === "running" && "border-heat/30 bg-heat/5 text-heat",
                (state === "waiting" || state === "skipped" || state === "stopped") &&
                  "text-muted-foreground",
              )}
            >
              <span className="font-medium">{label}</span>
              {outcomeLabel[state]}
            </span>
          );
        })}
      </div>
      <ol className="divide-y">
        {stepLabels.map(([name, label]) => {
          const step = steps.find((s) => s.name === name);
          const state = step?.status ?? "waiting";
          const expanded = open === name && !!step?.log;
          const left = step ? ((ms(step.startedAt) - start) / total) * 100 : 0;
          const width = step ? ((ms(step.finishedAt) - ms(step.startedAt)) / total) * 100 : 0;
          return (
            <li key={name}>
              <button
                type="button"
                disabled={!step?.log}
                onClick={() => setOpen(expanded ? null : name)}
                className="hover:bg-secondary/50 grid w-full grid-cols-[1rem_1fr_auto_1rem] items-center gap-3 px-5 py-3 text-left text-sm disabled:cursor-default disabled:hover:bg-transparent sm:grid-cols-[1rem_10rem_1fr_4.5rem_1rem]"
              >
                <span className="flex size-4 items-center justify-center">
                  {state === "succeeded" && <Check className="text-ok size-4" strokeWidth={2.5} />}
                  {state === "failed" && <X className="text-fail size-4" strokeWidth={2.5} />}
                  {state === "running" && (
                    <span className="border-heat size-3 animate-spin rounded-full border-2 border-t-transparent" />
                  )}
                  {state === "waiting" && <span className="bg-steel size-1.5 rounded-full" />}
                </span>
                <span
                  className={cn(
                    "truncate",
                    !step && "text-muted-foreground",
                    state === "failed" && "text-fail",
                  )}
                >
                  {label}
                </span>
                <span className="relative hidden h-1.5 rounded-full bg-muted sm:block">
                  {step && (
                    <span
                      className={cn(
                        "absolute inset-y-0 rounded-full",
                        state === "succeeded" && "bg-ok/70",
                        state === "failed" && "bg-fail/80",
                        state === "running" && "bg-heat animate-pulse",
                      )}
                      style={{ left: `${left}%`, width: `max(${width}%, 3px)` }}
                    />
                  )}
                </span>
                <span className="text-muted-foreground text-right font-mono text-xs">
                  {step && (duration(step.startedAt, step.finishedAt) ?? "running")}
                </span>
                <span className="flex justify-end">
                  {step?.log && (
                    <ChevronRight
                      className={cn(
                        "text-muted-foreground size-4 transition-transform",
                        expanded && "rotate-90",
                      )}
                    />
                  )}
                </span>
              </button>
              {step?.error && <p className="text-fail px-12 pb-3 text-sm">{step.error}</p>}
              {expanded && (
                <pre className="text-muted-foreground mx-5 mb-4 max-h-80 overflow-auto rounded-md border bg-muted/60 p-4 font-mono text-xs leading-5 whitespace-pre-wrap">
                  {step.log}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
      <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-xs">
        <span>{finished ? "Total time" : "Elapsed"}</span>
        <span className="font-mono">
          {duration(new Date(start).toISOString(), new Date(end).toISOString())}
        </span>
      </div>
    </div>
  );
}
