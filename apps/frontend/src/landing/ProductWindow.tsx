import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Pin commit", time: "0.4s", ms: 700, log: ["Resolved main to f2edcd7"] },
  {
    label: "Download source",
    time: "1.1s",
    ms: 900,
    log: ["Downloaded demilade111/forgeops-sample-api@f2edcd7, using api/"],
  },
  {
    label: "Build image",
    time: "14.2s",
    ms: 2400,
    log: [
      "#1 [internal] load build definition from Dockerfile",
      "#6 [deps 2/3] RUN npm ci --omit=dev",
      "#8 [build 4/4] RUN npm run build",
      "#10 naming to localhost:5001/services/api done",
    ],
  },
  {
    label: "Push to registry",
    time: "2.3s",
    ms: 900,
    log: ["digest: sha256:03d92676887e size: 1785"],
  },
  {
    label: "Start container",
    time: "0.6s",
    ms: 800,
    log: ["Started fo-01a1aeda on forgeops-apps"],
  },
  {
    label: "Route traffic",
    time: "0.1s",
    ms: 700,
    log: ["api.sample-shop.localhost -> fo-01a1aeda:8080"],
  },
];

const services = [
  { name: "storefront", note: "Deployed 2h ago" },
  { name: "api", note: "main at f2edcd7" },
  { name: "docs", note: "Deployed yesterday" },
];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Badge({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
        live ? "bg-ok/10 text-ok" : "bg-heat/10 text-heat",
      )}
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : "bg-heat animate-pulse")} />
      {live ? "Live" : "Deploying"}
    </span>
  );
}

export function ProductWindow() {
  const [current, setCurrent] = useState(() => (reduced() ? steps.length : 0));
  const done = current >= steps.length;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setCurrent((c) => c + 1), steps[current]!.ms);
    return () => clearTimeout(timer);
  }, [current, done]);

  const log = steps.slice(0, Math.min(current + 1, steps.length)).flatMap((s) => s.log);

  return (
    <div className="bg-card overflow-hidden rounded-lg border text-left">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#333]" />
          <span className="size-2.5 rounded-full bg-[#333]" />
          <span className="size-2.5 rounded-full bg-[#333]" />
        </span>
        <span className="text-muted-foreground text-xs">sample-shop</span>
      </div>
      <div className="grid md:grid-cols-[13rem_1fr]">
        <aside className="hidden border-r p-3 md:block">
          <p className="text-muted-foreground px-2 pb-2 text-xs">Services</p>
          {services.map((s) => (
            <div
              key={s.name}
              className={cn("mb-1 rounded-md px-2 py-2", s.name === "api" && "bg-secondary")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <Badge live={s.name !== "api" || done} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">{s.note}</p>
            </div>
          ))}
        </aside>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">api</h3>
                <Badge live={done} />
              </div>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                demilade111/forgeops-sample-api on main
              </p>
            </div>
            <span
              className={cn(
                "font-mono text-xs transition-opacity",
                done ? "opacity-100" : "opacity-30",
              )}
            >
              api.sample-shop.localhost
            </span>
          </div>
          <div className="grid lg:grid-cols-[14rem_1fr]">
            <ol className="border-b px-5 py-4 lg:border-r lg:border-b-0">
              {steps.map((step, index) => {
                const state = index < current ? "done" : index === current ? "running" : "waiting";
                return (
                  <li key={step.label} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="flex size-4 items-center justify-center">
                      {state === "done" && <Check className="text-ok size-4" strokeWidth={2.5} />}
                      {state === "running" && (
                        <span className="border-heat size-3 animate-spin rounded-full border-2 border-t-transparent" />
                      )}
                      {state === "waiting" && <span className="bg-steel size-1.5 rounded-full" />}
                    </span>
                    <span className={cn("flex-1", state === "waiting" && "text-muted-foreground")}>
                      {step.label}
                    </span>
                    {state === "done" && (
                      <span className="text-muted-foreground font-mono text-xs">{step.time}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex min-h-[15rem] flex-col bg-black px-5 py-4 font-mono text-[0.72rem] leading-6">
              <div className="flex-1">
                {log.map((line) => (
                  <p key={line} className="text-muted-foreground truncate">
                    {line}
                  </p>
                ))}
                {done && (
                  <>
                    <p className="mt-2">$ curl http://api.sample-shop.localhost</p>
                    <p className="text-ok break-all">
                      {'{"message":"Hello from the ForgeOps sample API","version":"1.0.0"}'}
                    </p>
                  </>
                )}
              </div>
              {done && (
                <button
                  type="button"
                  onClick={() => setCurrent(0)}
                  className="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1.5 self-start font-sans text-xs"
                >
                  <RotateCcw className="size-3" />
                  Replay deploy
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
