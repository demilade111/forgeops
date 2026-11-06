import { useState, type FormEvent } from "react";
import { GitBranch, GitCommitHorizontal, Loader2, Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { api } from "@/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serviceState } from "@/lib/deploys";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { shortSha, timeAgo } from "@/lib/format";
import { GitHubPanel } from "./GitHubPanel";

async function loadProjects(organizationId: string) {
  const projects = await api.listProjects(organizationId);
  return Promise.all(
    projects.map(async (p) => {
      const detail = await api.getProject(p.id);
      const histories = await Promise.all(detail.services.map((s) => api.listDeployments(s.id)));
      const states = histories.map(serviceState);
      const latest = histories.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return { ...detail, states, latest };
    }),
  );
}

export function ProjectsPage({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const projects = useLoad(() => loadProjects(organizationId), [organizationId]);
  const github = useLoad(() => api.getGitHubStatus(organizationId), [organizationId]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = useRequest(api.createProject, {
    onSuccess: (project) => navigate(`/app/projects/${project.id}`),
  });
  const all = projects.data ?? [];
  const shown = all.filter((p) => p.name.includes(query.trim().toLowerCase()));
  const liveCount = all.reduce((n, p) => n + p.states.filter((s) => s === "live").length, 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    create.send(organizationId, name.trim());
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.03em]">Projects</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {projects.data
              ? `${all.length} ${all.length === 1 ? "project" : "projects"}, ${liveCount} live ${liveCount === 1 ? "service" : "services"}`
              : "Loading..."}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="bg-card h-9 pl-9"
            />
          </div>
          <Button className="h-9" onClick={() => setCreating(!creating)}>
            <Plus />
            New project
          </Button>
        </div>
      </div>

      <GitHubPanel organizationId={organizationId} status={github.data} error={github.error} />

      {creating && (
        <form onSubmit={submit} className="bg-card rounded-lg border p-5">
          <label htmlFor="project-name" className="font-medium">
            Name your project
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="sample-shop"
              className="h-9 max-w-xs font-mono"
              required
            />
            <Button type="submit" className="h-9" disabled={create.isLoading || !name.trim()}>
              {create.isLoading && <Loader2 className="animate-spin" />}
              Create project
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
          <p
            className={
              create.error ? "text-fail mt-3 text-sm" : "text-muted-foreground mt-3 text-xs"
            }
          >
            {create.error ??
              "Lowercase letters, numbers and dashes. It becomes part of each service's URL."}
          </p>
        </form>
      )}

      {projects.error && <p className="text-fail text-sm">{projects.error}</p>}
      {!projects.data && !projects.error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card h-44 animate-pulse rounded-lg border" />
          ))}
        </div>
      )}
      {projects.data && all.length > 0 && shown.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">
          No projects match "{query}".
        </p>
      )}

      {projects.data && (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => {
            const first = project.services[0];
            const state = project.states.includes("running")
              ? "running"
              : project.states.includes("failed")
                ? "failed"
                : project.states.includes("live")
                  ? "live"
                  : null;
            return (
              <li key={project.id}>
                <Link
                  to={`/app/projects/${project.id}`}
                  className="bg-card hover:border-foreground/25 group flex h-44 flex-col rounded-lg border p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold uppercase">
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.name}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {first ? `${first.name}.${project.name}.localhost` : "No services yet"}
                        </p>
                      </div>
                    </div>
                    {state && <StatusBadge status={state} />}
                  </div>
                  {first && (
                    <p className="bg-secondary mt-4 flex w-fit max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 font-mono text-xs">
                      <GitBranch className="size-3 shrink-0" />
                      {first.repository}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-auto flex items-center justify-between gap-3 text-sm">
                    {project.latest ? (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <GitCommitHorizontal className="size-4 shrink-0" />
                        <span className="font-mono text-xs">
                          {shortSha(project.latest.commitSha) ?? "deploy"}
                        </span>
                        <span className="truncate">{timeAgo(project.latest.createdAt)}</span>
                      </span>
                    ) : (
                      <span>Created {timeAgo(project.createdAt)}</span>
                    )}
                    <span className="shrink-0">
                      {project.services.length}{" "}
                      {project.services.length === 1 ? "service" : "services"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
          {!query && (
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="text-muted-foreground hover:text-foreground hover:border-foreground/25 flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors"
              >
                <Plus className="size-5" />
                <span className="text-sm">New project</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
