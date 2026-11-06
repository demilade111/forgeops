import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Deployment } from "@/types";

const order = [
  ["resolve-commit", "Find latest commit"],
  ["fetch-source", "Download code"],
  ["build", "Build image"],
  ["push", "Save image"],
  ["run", "Start app"],
  ["route", "Go live"],
] as const;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : Date.now());

export function DeploymentSteps({ deployment }: { deployment: Deployment }) {
  const [open, setOpen] = useState<string | null>(null);
  const steps = deployment.steps ?? [];
  const finished = deployment.status === "failed" || deployment.status === "succeeded";
  const start = Math.min(...steps.map((s) => ms(s.startedAt)), ms(deployment.startedAt));
  const end = finished ? ms(deployment.finishedAt) : Date.now();
  const total = Math.max(end - start, 1);

  return (
    <div>
      <ol className="divide-y">
        {order.map(([name, label]) => {
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
