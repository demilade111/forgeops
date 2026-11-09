import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { servicesApi } from "@/features/services/api/services.api";
import type { ServiceLogs as Logs } from "@/features/services/services.types";

const timeOf = (line: string) => {
  const [stamp, ...rest] = line.split(" ");
  const date = new Date(stamp ?? "");
  return Number.isNaN(date.getTime())
    ? ["", line]
    : [date.toLocaleTimeString([], { hour12: false }), rest.join(" ")];
};

export function ServiceLogs({ serviceId }: { serviceId: string }) {
  const [logs, setLogs] = useState<Logs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await servicesApi.getServiceLogs(serviceId);
        if (stopped) return;
        setLogs(next);
        setError(null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Could not load logs.");
      }
      if (!stopped) timer = setTimeout(poll, 3000);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [serviceId]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [logs, follow]);

  const lines = logs?.log.split("\n").filter(Boolean) ?? [];

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="font-medium">Logs</h2>
          <p className="text-muted-foreground text-sm">
            What your live app prints, newest at the bottom.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {logs?.running && (
            <span className="text-ok flex items-center gap-1.5">
              <span className="bg-ok size-1.5 animate-pulse rounded-full" />
              Live
            </span>
          )}
          <label className="text-muted-foreground flex items-center gap-2">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
              className="accent-primary"
            />
            Follow
          </label>
        </div>
      </div>
      {error && <p className="text-fail border-b px-5 py-3 text-sm">{error}</p>}
      <div
        ref={box}
        className="h-[28rem] overflow-auto bg-[#0f0d1a] px-5 py-4 font-mono text-xs leading-6 text-[#e7e4f2]"
      >
        {!logs && !error && <Loader2 className="size-4 animate-spin text-[#8b85a8]" />}
        {logs && lines.length === 0 && (
          <p className="text-[#8b85a8]">
            {logs.deploymentId
              ? logs.running
                ? "Your app has not printed anything yet."
                : "Your app is not running. Deploy to start it again."
              : "No logs yet. Deploy this service to start it."}
          </p>
        )}
        {lines.map((line, index) => {
          const [time, text] = timeOf(line);
          return (
            <div key={index} className="flex gap-4 whitespace-pre-wrap break-all">
              <span className="shrink-0 text-[#8b85a8] select-none">{time}</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
