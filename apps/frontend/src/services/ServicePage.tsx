import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, GitBranch, GitCommitHorizontal, Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "react-router";
import { api } from "@/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { serviceState } from "@/lib/deploys";
import { duration, shortSha, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCrumbs } from "@/stores/crumbs";
import type { Deployment, Service } from "@/types";
import { DeploymentSteps } from "./DeploymentSteps";
import { ServiceSettings } from "./ServiceSettings";

const active = (d: Deployment | null | undefined) =>
  d?.status === "queued" || d?.status === "running";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1.5 truncate text-sm">{children}</dd>
    </div>
  );
}

function LivePreview({ live, latest }: { live?: Deployment; latest?: Deployment }) {
  const deploying = active(latest);
  const host = live?.url?.replace("http://", "");
  return (
    <div className="flex flex-col overflow-hidden rounded-md border bg-white">
      <div className="bg-muted/60 flex items-center gap-2 border-b px-3 py-2">
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-[#dcdcdc]" />
          <span className="size-2 rounded-full bg-[#dcdcdc]" />
          <span className="size-2 rounded-full bg-[#dcdcdc]" />
        </span>
        <span className="text-muted-foreground flex-1 truncate rounded bg-white px-2 py-0.5 text-center font-mono text-xs">
          {host ?? "Not live yet"}
        </span>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden">
        {live?.url ? (
          <>
            <iframe
              src={live.url}
              title={`Preview of ${host}`}
              sandbox="allow-scripts allow-same-origin"
              tabIndex={-1}
              className="pointer-events-none absolute top-0 left-0 h-[133.4%] w-[133.4%] origin-top-left scale-75 border-0 bg-white"
            />
            <a
              href={live.url}
              target="_blank"
              rel="noreferrer"
              className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md border bg-white/95 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-white"
            >
              Open
              <ExternalLink className="size-3" />
            </a>
          </>
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            {deploying ? (
              <>
                <span className="border-heat size-5 animate-spin rounded-full border-2 border-t-transparent" />
                Building your first version
              </>
            ) : (
              "Press Deploy to put this service online."
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ s }: { s: Service }) {
  const items: [string, string][] = [
    ["Repository", s.repository],
    ["Root directory", s.sourceDirectory ? `${s.sourceDirectory}/` : "Repository root"],
    ["Port", String(s.port)],
    ["Environment variables", s.envVarNames.length ? s.envVarNames.join(", ") : "None"],
  ];
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <Detail key={label} label={label}>
          <span className="font-mono">{value}</span>
        </Detail>
      ))}
    </dl>
  );
}

export function ServicePage() {
  const { serviceId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "settings" ? "settings" : "overview";
  const service = useLoad(() => api.getService(serviceId), [serviceId]);
  const deployments = useLoad(() => api.listDeployments(serviceId), [serviceId]);
  const projectId = service.data?.projectId;
  const project = useLoad(
    () => (projectId ? api.getProject(projectId) : Promise.resolve(null)),
    [projectId],
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Deployment | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useCrumbs(
    project.data && service.data
      ? [
          { label: project.data.name, to: `/app/projects/${project.data.id}` },
          { label: service.data.name, to: `/app/services/${serviceId}` },
        ]
      : [],
  );

  const list = deployments.data ?? [];
  const latest = list[0];
  const live = list.find((d) => d.status === "succeeded");
  const reloadList = deployments.reload;
  const busy = active(latest);
  const headline = serviceState(list);

  const deploy = useRequest(() => api.deploy(serviceId, key), {
    onSuccess: (deployment) => {
      setKey(crypto.randomUUID());
      setExpanded(deployment.id);
      setDetail(deployment);
      reloadList();
    },
  });

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(reloadList, 1500);
    return () => clearInterval(timer);
  }, [busy, reloadList]);

  useEffect(() => {
    if (!expanded) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.getDeployment(expanded);
        if (stopped) return;
        setDetail(next);
        if (active(next)) timer = setTimeout(poll, 1500);
      } catch {
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [expanded]);

  if (service.error) return <p className="text-fail text-sm">{service.error}</p>;
  if (!service.data) return <Loader2 className="text-muted-foreground size-5 animate-spin" />;
  const s = service.data;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden size-12 shrink-0 items-center justify-center rounded-full border bg-card text-lg font-semibold uppercase sm:flex">
            {s.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-medium tracking-[-0.03em]">{s.name}</h1>
              {headline && <StatusBadge status={headline} />}
            </div>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {live?.url && (
                <a
                  href={live.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground font-mono"
                >
                  {live.url.replace("http://", "")}
                </a>
              )}
              <span className="flex items-center gap-1.5 font-mono">
                <GitBranch className="size-3.5" />
                {s.repository}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {live?.url && (
            <Button asChild variant="outline" className="h-9 bg-transparent">
              <a href={live.url} target="_blank" rel="noreferrer">
                Visit
                <ExternalLink />
              </a>
            </Button>
          )}
          <Button className="h-9" onClick={() => deploy.send()} disabled={deploy.isLoading || busy}>
            {(deploy.isLoading || busy) && <Loader2 className="animate-spin" />}
            {busy ? "Deploying" : "Deploy"}
          </Button>
        </div>
      </div>
      {deploy.error && <p className="text-fail -mt-6 text-sm">{deploy.error}</p>}

      <nav className="-mt-4 flex gap-6 border-b text-sm">
        {(["overview", "settings"] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setParams(name === "settings" ? { tab: "settings" } : {})}
            className={cn(
              "-mb-px border-b-2 pb-3 capitalize transition-colors",
              tab === name
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === "settings" ? (
        <ServiceSettings service={s} onSaved={service.reload} />
      ) : (
        <>
          <section className="bg-card overflow-hidden rounded-lg border">
            <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1.1fr]">
              <LivePreview live={live} latest={latest} />
              <div className="flex flex-col">
                <h2 className="text-lg font-medium">Production</h2>
                <p className="text-muted-foreground text-sm">What visitors see right now.</p>
                <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5">
                  <div className="col-span-2">
                    <Detail label="URL">
                      {live?.url ? (
                        <a
                          href={live.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono underline-offset-4 hover:underline"
                        >
                          {live.url.replace("http://", "")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">None yet</span>
                      )}
                    </Detail>
                  </div>
                  <Detail label="Build time">
                    <span className="font-mono">
                      {(live && duration(live.startedAt, live.finishedAt)) ?? "-"}
                    </span>
                  </Detail>
                  <Detail label="Deployed">
                    {live ? (
                      timeAgo(live.createdAt)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </Detail>
                  <Detail label="Branch">
                    <span className="flex items-center gap-1.5 font-mono">
                      <GitBranch className="size-3.5" />
                      {s.branch}
                    </span>
                  </Detail>
                  <Detail label="Commit">
                    <span className="flex items-center gap-1.5 font-mono">
                      <GitCommitHorizontal className="size-3.5" />
                      {shortSha(live?.commitSha ?? null) ?? "-"}
                    </span>
                  </Detail>
                </dl>
              </div>
            </div>
            <div className="border-t px-6 py-5">
              <Settings s={s} />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium">Deployments</h2>
            {list.length === 0 ? (
              <p className="text-muted-foreground bg-card rounded-lg border px-5 py-12 text-center text-sm">
                No deployments yet. Deploy builds the latest commit on {s.branch}.
              </p>
            ) : (
              <ul className="bg-card divide-y overflow-hidden rounded-lg border">
                <li className="text-muted-foreground hidden grid-cols-[2.5rem_7.5rem_1fr_6rem_7rem_1rem] gap-4 px-5 py-2.5 text-xs sm:grid">
                  <span>#</span>
                  <span>Status</span>
                  <span>Commit</span>
                  <span>Duration</span>
                  <span>Created</span>
                  <span />
                </li>
                {list.map((d, index) => {
                  const open = expanded === d.id;
                  const shown = open && detail?.id === d.id ? detail : null;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : d.id)}
                        aria-expanded={open}
                        className="hover:bg-secondary/40 grid w-full grid-cols-[7.5rem_1fr_auto] items-center gap-4 px-5 py-4 text-left text-sm sm:grid-cols-[2.5rem_7.5rem_1fr_6rem_7rem_1rem]"
                      >
                        <span className="text-muted-foreground hidden font-mono text-xs sm:block">
                          {list.length - index}
                        </span>
                        <StatusBadge status={d.id === live?.id ? "live" : d.status} />
                        <span className="flex min-w-0 items-center gap-3 font-mono text-xs">
                          <span>
                            {shortSha(d.commitSha) ?? (active(d) ? "resolving" : "no commit")}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1 truncate">
                            <GitBranch className="size-3" />
                            {s.branch}
                          </span>
                        </span>
                        <span className="text-muted-foreground hidden font-mono text-xs sm:block">
                          {duration(d.startedAt, d.finishedAt) ?? (active(d) ? "running" : "")}
                        </span>
                        <span className="text-muted-foreground text-right text-xs sm:text-left">
                          {timeAgo(d.createdAt)}
                        </span>
                        <ChevronDown
                          className={cn(
                            "text-muted-foreground hidden size-4 transition-transform sm:block",
                            open && "rotate-180",
                          )}
                        />
                      </button>
                      {open && (
                        <div className="border-t bg-muted/40">
                          {!shown ? (
                            <Loader2 className="text-muted-foreground m-5 size-5 animate-spin" />
                          ) : (
                            <>
                              {shown.error && (
                                <p className="bg-fail/10 text-fail border-b px-5 py-3 text-sm">
                                  {shown.error}
                                </p>
                              )}
                              <DeploymentSteps deployment={shown} />
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
