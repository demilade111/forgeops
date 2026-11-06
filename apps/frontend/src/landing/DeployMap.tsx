import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleDashed,
  Clock,
  Globe,
  ListEnd,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const lines = [
  { text: "https://github.com/demilade111/forgeops-sample-api", ms: 600 },
  { text: "==> Finding latest commit on main: f2edcd7", ms: 900 },
  { text: "==> Downloading code from api/", ms: 900 },
  { text: "==> Building your app", ms: 1800 },
  { text: "==> Build successful in 14.2s", ms: 700 },
  { text: "==> Saving the build", ms: 900 },
  { text: "==> Starting your app", ms: 900 },
  { text: "==> Health check passed: GET /health/ready returned 200", ms: 900 },
  { text: "==> Live at http://api.sample-shop.localhost", ms: 600 },
];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Tile({
  name,
  kind,
  icon: Icon,
  state,
  selected,
}: {
  name: string;
  kind: string;
  icon: typeof Globe;
  state: "live" | "deploying" | "coming" | "add";
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-md border bg-white/90 px-3.5 py-3 backdrop-blur",
        selected && "border-[#6d4aff] shadow-[0_0_0_1px_#6d4aff]",
        (state === "coming" || state === "add") && "border-dashed bg-transparent",
      )}
    >
      <Icon className="text-muted-foreground size-5 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", state === "coming" && "text-muted-foreground")}>
          {name}
        </p>
        <p className="text-muted-foreground truncate text-xs">{kind}</p>
      </div>
      {state === "live" && (
        <span className="flex size-6 items-center justify-center rounded-sm bg-[#e3f5ec]">
          <Check className="text-ok size-3.5" strokeWidth={2.5} />
        </span>
      )}
      {state === "deploying" && (
        <span className="flex size-6 items-center justify-center rounded-sm bg-[#ece7ff]">
          <span className="size-3 animate-spin rounded-full border-2 border-[#6d4aff] border-t-transparent" />
        </span>
      )}
      {state === "coming" && (
        <span className="text-muted-foreground absolute -top-2.5 left-3 rounded-sm border border-[#d9d0ff] bg-[#f4f0ff] px-1.5 text-[0.65rem] text-[#6d4aff]">
          Coming
        </span>
      )}
    </div>
  );
}

export function DeployMap() {
  const [shown, setShown] = useState(() => (reduced() ? lines.length : 1));
  const done = shown >= lines.length;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setShown((n) => n + 1), lines[shown]!.ms);
    return () => clearTimeout(timer);
  }, [shown, done]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#e4def9] p-4 shadow-[0_30px_80px_-40px_rgba(76,47,200,0.4)] sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_90%_100%,rgba(109,74,255,0.38),transparent_70%),radial-gradient(ellipse_60%_55%_at_15%_100%,rgba(236,120,170,0.18),transparent_70%),linear-gradient(#fbfaff,#fbfaff)]"
      />
      <div aria-hidden="true" className="noise absolute inset-0" />
      <div className="relative">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Users className="size-4" strokeWidth={1.5} />
          <span className="text-foreground">Personal</span>
          <ChevronRight className="size-4" />
          <CircleDashed className="size-4" strokeWidth={1.5} />
          <span className="text-foreground">sample-shop</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile name="storefront" kind="Web service" icon={Globe} state="live" />
          <Tile
            name="api"
            kind="Web service"
            icon={Globe}
            state={done ? "live" : "deploying"}
            selected
          />
          <Tile name="docs" kind="Web service" icon={Globe} state="live" />
          <Tile name="emails" kind="Background worker" icon={ListEnd} state="coming" />
          <Tile name="cleanup" kind="Scheduled job" icon={Clock} state="coming" />
          <Tile name="Add service" kind="From any repo" icon={Plus} state="add" />
        </div>
        <div className="mt-4 overflow-hidden rounded-md border bg-white/95">
          <div className="flex items-center justify-between border-b px-4 py-3 font-mono text-xs sm:text-sm">
            <span className="text-muted-foreground truncate">api &nbsp;deploy f2edcd7</span>
            <span className="flex shrink-0 items-center gap-2">
              {done ? (
                <Check className="text-ok size-4" strokeWidth={2.5} />
              ) : (
                <span className="size-3.5 animate-spin rounded-full border-2 border-[#a3a3a3] border-t-transparent" />
              )}
              {done ? "Live" : "Deploying"}
            </span>
          </div>
          <ol className="min-h-[15.5rem] py-2 font-mono text-[0.72rem] leading-6 sm:text-[0.8rem]">
            {lines.slice(0, shown).map((line, index) => (
              <li
                key={line.text}
                className={cn(
                  "border-l-2 border-transparent px-4 break-all",
                  index === 0 && "text-muted-foreground pl-[3.25rem]",
                  index === shown - 1 && !done && "border-[#6d4aff] bg-[#f4f1ff]",
                  index === lines.length - 1 && "text-ok",
                )}
              >
                {line.text}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3 border-t px-4 py-3">
            <div className="flex flex-1 gap-1.5">
              {lines.slice(1).map((line, index) => (
                <span
                  key={line.text}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-[#e8e5f3]"
                >
                  <span
                    className={cn(
                      "block h-full bg-[#6d4aff] transition-[width] duration-500",
                      index + 1 < shown ? "w-full" : "w-0",
                    )}
                  />
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShown(1)}
              aria-label="Replay deploy"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
