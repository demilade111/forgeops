import { useEffect, useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { servicesApi } from "@/features/services/api/services.api";
import type { MetricSample } from "@/features/services/types/services.types";
import { cn } from "@/lib/utils";

const ranges = [
  [60, "1h"],
  [360, "6h"],
  [1440, "24h"],
] as const;

const mb = (bytes: number) => bytes / 1024 ** 2;
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function niceMax(value: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)));
  return [1, 2, 5, 10].map((n) => n * power).find((n) => n >= value) ?? value;
}

function Chart({
  title,
  points,
  from,
  to,
  floor,
  unit,
  note,
}: {
  title: string;
  points: { t: number; v: number }[];
  from: number;
  to: number;
  floor: number;
  unit: string;
  note?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(floor, ...points.map((p) => p.v)) * 1.15);
  const x = (t: number) => ((t - from) / (to - from)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join("");
  const shown = hover === null ? points.at(-1) : points[hover];
  const format = (v: number) => `${v.toFixed(v < 10 ? 2 : 1)} ${unit}`;

  function track(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const t = from + ((event.clientX - box.left) / box.width) * (to - from);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.t - t) < Math.abs(points[best]!.t - t)) best = i;
    });
    setHover(points.length ? best : null);
  }

  return (
    <section className="bg-card rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-muted-foreground text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs">{note}</p>
      </div>
      <p className="mt-1 text-2xl font-medium tabular-nums">{shown ? format(shown.v) : "-"}</p>
      <p className="text-muted-foreground h-4 text-xs">
        {shown && (hover === null ? "now" : time(shown.t))}
      </p>
      <div className="mt-4 flex gap-3">
        <div className="text-muted-foreground flex h-40 flex-col justify-between text-right text-xs tabular-nums">
          <span>{max}</span>
          <span>{max / 2}</span>
          <span>0</span>
        </div>
        <div
          className="relative h-40 flex-1"
          onMouseMove={track}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${title}, ${points.length} samples, latest ${shown ? format(shown.v) : "none"}`}
        >
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2].map((i) => (
              <span key={i} className="border-border/70 border-t" />
            ))}
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <path
              d={`${line}L${x(points.at(-1)?.t ?? from)},100L${x(points[0]?.t ?? from)},100Z`}
              className="fill-primary/10"
            />
            <path
              d={line}
              className="stroke-primary fill-none"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          {hover !== null && shown && (
            <>
              <span
                className="bg-foreground/30 absolute inset-y-0 w-px"
                style={{ left: `${x(shown.t)}%` }}
              />
              <span
                className="border-card bg-primary absolute size-2.5 -translate-1/2 rounded-full border-2"
                style={{ left: `${x(shown.t)}%`, top: `${y(shown.v)}%` }}
              />
            </>
          )}
        </div>
      </div>
      <div className="text-muted-foreground mt-2 ml-8 flex justify-between text-xs">
        <span>{time(from)}</span>
        <span>{time(to)}</span>
      </div>
    </section>
  );
}

export function ServiceMetrics({ serviceId }: { serviceId: string }) {
  const [minutes, setMinutes] = useState(60);
  const [samples, setSamples] = useState<MetricSample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const next = await servicesApi.getServiceMetrics(serviceId, minutes);
        if (stopped) return;
        setSamples(next);
        setNow(Date.now());
        setError(null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Could not load metrics.");
      }
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [serviceId, minutes]);

  const points = (samples ?? []).map((s) => ({ t: new Date(s.takenAt).getTime(), s }));
  const limit = samples?.at(-1)?.memoryLimit;
  const from = now - minutes * 60_000;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          How much of the server's CPU and memory your app is using, recorded every 15 seconds.
        </p>
        <div
          className="inline-flex rounded-md border p-1"
          role="radiogroup"
          aria-label="Time range"
        >
          {ranges.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={minutes === value}
              onClick={() => setMinutes(value)}
              className={cn(
                "h-7 rounded px-3 text-sm",
                minutes === value
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-fail text-sm">{error}</p>}
      {!samples && !error && <Loader2 className="text-muted-foreground size-5 animate-spin" />}
      {samples?.length === 0 && (
        <p className="bg-card text-muted-foreground rounded-lg border px-5 py-10 text-center text-sm">
          No usage recorded yet. ForgeOps records it every 15 seconds while your app is live.
        </p>
      )}
      {!!samples?.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Chart
            title="CPU"
            unit="%"
            floor={1}
            from={from}
            to={now}
            points={points.map(({ t, s }) => ({ t, v: s.cpuPercent }))}
            note="100% is one full core"
          />
          <Chart
            title="Memory"
            unit="MB"
            floor={10}
            from={from}
            to={now}
            points={points.map(({ t, s }) => ({ t, v: mb(s.memoryBytes) }))}
            note={
              limit
                ? `No limit set; the server has ${(limit / 1024 ** 3).toFixed(1)} GB`
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
