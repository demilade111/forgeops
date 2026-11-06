import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Deployment } from "@/types";

const order = [
  ["resolve-commit", "Pin commit"],
  ["fetch-source", "Download source"],
  ["build", "Build image"],
  ["push", "Push to registry"],
  ["run", "Start container"],
  ["route", "Route traffic"],
] as const;

export function DeploymentSteps({ deployment }: { deployment: Deployment }) {
  const [open, setOpen] = useState<string | null>(null);
  const steps = deployment.steps ?? [];
  const finished = deployment.status === "failed" || deployment.status === "succeeded";

  return (
    <ol className="divide-y">
      {order.map(([name, label]) => {
        const step = steps.find((s) => s.name === name);
        const state = step?.status ?? (finished ? "skipped" : "waiting");
        const expanded = open === name && !!step?.log;
        return (
          <li key={name}>
            <button
              type="button"
              disabled={!step?.log}
              onClick={() => setOpen(expanded ? null : name)}
              className="hover:bg-secondary/50 flex w-full items-center gap-3 px-5 py-3 text-left text-sm disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="flex size-4 items-center justify-center">
                {state === "succeeded" && <Check className="text-ok size-4" strokeWidth={2.5} />}
                {state === "failed" && <X className="text-fail size-4" strokeWidth={2.5} />}
                {state === "running" && (
                  <span className="border-heat size-3 animate-spin rounded-full border-2 border-t-transparent" />
                )}
                {(state === "waiting" || state === "skipped") && (
                  <span className="bg-steel size-1.5 rounded-full" />
                )}
              </span>
              <span
                className={cn(
                  "flex-1",
                  !step && "text-muted-foreground",
                  state === "failed" && "text-fail",
                )}
              >
                {label}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {step && duration(step.startedAt, step.finishedAt)}
              </span>
              {step?.log && (
                <ChevronRight
                  className={cn(
                    "text-muted-foreground size-4 transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              )}
            </button>
            {step?.error && <p className="text-fail px-12 pb-3 text-sm">{step.error}</p>}
            {expanded && (
              <pre className="text-muted-foreground mx-5 mb-4 max-h-80 overflow-auto rounded-md border bg-black p-4 font-mono text-xs leading-5 whitespace-pre-wrap">
                {step.log}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
