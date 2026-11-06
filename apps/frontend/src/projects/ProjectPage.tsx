import { GitBranch, Loader2, Plus } from "lucide-react";
import { Link, useParams } from "react-router";
import { api } from "@/api";
import { DeleteSection } from "@/components/DeleteSection";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { serviceState } from "@/lib/deploys";
import { shortSha, timeAgo } from "@/lib/format";
import { useCrumbs } from "@/stores/crumbs";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const project = useLoad(async () => {
    const detail = await api.getProject(projectId);
    const deployments = await Promise.all(detail.services.map((s) => api.listDeployments(s.id)));
    return { ...detail, deployments };
  }, [projectId]);
  useCrumbs(project.data ? [{ label: project.data.name, to: `/app/projects/${projectId}` }] : []);

  if (project.error) return <p className="text-fail text-sm">{project.error}</p>;
  if (!project.data) return <Loader2 className="text-muted-foreground size-5 animate-spin" />;
  const { name, services, deployments } = project.data;
  const addService = `/app/projects/${projectId}/services/new`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.03em]">{name}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {services.length} {services.length === 1 ? "service" : "services"},{" "}
            {deployments.filter((h) => serviceState(h) === "live").length} live
          </p>
        </div>
        <Button asChild className="h-9">
          <Link to={addService}>
            <Plus />
            Add service
          </Link>
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-lg border px-6 py-20 text-center">
          <p className="text-lg font-medium">Add your first service</p>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            A service is one thing to deploy: a repository, a branch and the folder with its
            Dockerfile.
          </p>
          <Button asChild className="mt-6 h-9">
            <Link to={addService}>
              <Plus />
              Add service
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const history = deployments[index] ?? [];
            const latest = history[0];
            const status = serviceState(history);
            return (
              <li key={service.id}>
                <Link
                  to={`/app/services/${service.id}`}
                  className="bg-card hover:border-foreground/25 flex h-full flex-col rounded-lg border p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{service.name}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {service.name}.{name}.localhost
                      </p>
                    </div>
                    {status ? (
                      <StatusBadge status={status} />
                    ) : (
                      <span className="text-muted-foreground text-xs">Not deployed</span>
                    )}
                  </div>
                  <p className="bg-secondary mt-5 flex w-fit max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 font-mono text-xs">
                    <GitBranch className="size-3 shrink-0" />
                    {service.repository}
                  </p>
                  <p className="text-muted-foreground mt-auto pt-5 text-sm">
                    {latest
                      ? `${shortSha(latest.commitSha) ?? "Deploy"} on ${service.branch}, ${timeAgo(latest.createdAt)}`
                      : `Branch ${service.branch}`}
                  </p>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              to={addService}
              className="text-muted-foreground border-foreground/30 hover:border-primary hover:bg-primary/5 hover:text-primary flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors"
            >
              <Plus className="size-5" />
              <span className="text-sm">Add service</span>
            </Link>
          </li>
        </ul>
      )}

      <div className="max-w-4xl pt-8">
        <DeleteSection
          what="project"
          name={name}
          text="Takes every service in this project offline and removes them with their deploy history. This cannot be undone."
          remove={() => api.deleteProject(projectId)}
          then="/app"
        />
      </div>
    </div>
  );
}
