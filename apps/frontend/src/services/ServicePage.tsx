import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, GitBranch, GitCommitHorizontal, Loader2 } from "lucide-react";
import { useParams } from "react-router";
import { api } from "@/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { duration, shortSha, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCrumbs } from "@/stores/crumbs";
import type { Deployment, Service } from "@/types";
import { DeploymentSteps } from "./DeploymentSteps";

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

function Preview({ live, latest }: { live?: Deployment; latest?: Deployment }) {
  const deploying = active(latest);
  return (
    <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border bg-black">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:28px_28px]"
      />
      <div className="relative text-center">
        <span
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full border",
            deploying ? "border-heat/40" : live ? "border-ok/40" : "border-border",
          )}
        >
          {deploying ? (
            <span className="border-heat size-6 animate-spin rounded-full border-2 border-t-transparent" />
          ) : (
            <span className={cn("size-3 rounded-full", live ? "bg-ok" : "bg-steel")} />
          )}
        </span>
        <p className="mt-4 font-mono text-sm">
          {live?.url?.replace("http://", "") ?? "Not deployed yet"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {deploying
            ? `Deploying ${shortSha(latest?.commitSha ?? null) ?? "the latest commit"}`
            : live
              ? `Serving ${shortSha(live.commitSha)}`
              : "Press Deploy to build and run it"}
        </p>
      </div>
    </div>
  );
}

function Settings({ s }: { s: Service }) {
  const items: [string, string][] = [
    ["Repository", s.repository],
    ["Source directory", s.sourceDirectory ? `${s.sourceDirectory}/` : "Repository root"],
    ["Port", String(s.port)],
    ["Env vars", s.envVarNames.length ? s.envVarNames.join(", ") : "None"],
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
        <h1 className="text-3xl font-medium tracking-[-0.03em]">{s.name}</h1>
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

      <section className="bg-card overflow-hidden rounded-lg border">
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_1.1fr]">
          <Preview live={live} latest={latest} />
          <div className="flex flex-col">
            <h2 className="text-lg font-medium">Production deployment</h2>
            <p className="text-muted-foreground text-sm">
              The version serving traffic at this service's URL.
            </p>
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
              <Detail label="Status">
                {live ? (
                  <StatusBadge status="live" />
                ) : (
                  <span className="text-muted-foreground">Not live</span>
                )}
              </Detail>
              <Detail label="Created">
                {live ? timeAgo(live.createdAt) : <span className="text-muted-foreground">-</span>}
              </Detail>
              <Detail label="Source">
                <span className="flex items-center gap-1.5 font-mono">
                  <GitBranch className="size-3.5" />
                  {s.branch}
                </span>
                {live?.commitSha && (
                  <span className="text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
                    <GitCommitHorizontal className="size-3.5" />
                    {shortSha(live.commitSha)}
                  </span>
                )}
              </Detail>
              <Detail label="Image">
                <span className="font-mono">{live?.image?.split("@")[1]?.slice(0, 19) ?? "-"}</span>
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
            {list.map((d) => {
              const open = expanded === d.id;
              const shown = open && detail?.id === d.id ? detail : null;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : d.id)}
                    aria-expanded={open}
                    className="hover:bg-secondary/40 grid w-full grid-cols-[7.5rem_1fr_auto] items-center gap-4 px-5 py-4 text-left text-sm sm:grid-cols-[7.5rem_1fr_6rem_7rem_1rem]"
                  >
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
                    <div className="border-t bg-black/40">
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
    </div>
  );
}
