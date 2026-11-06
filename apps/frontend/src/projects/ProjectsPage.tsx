import { useState, type FormEvent } from "react";
import { GitBranch, Loader2, Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { timeAgo } from "@/lib/format";
import { GitHubPanel } from "./GitHubPanel";

export function ProjectsPage({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const projects = useLoad(
    async () =>
      Promise.all((await api.listProjects(organizationId)).map((p) => api.getProject(p.id))),
    [organizationId],
  );
  const github = useLoad(() => api.getGitHubStatus(organizationId), [organizationId]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = useRequest(api.createProject, {
    onSuccess: (project) => navigate(`/app/projects/${project.id}`),
  });
  const shown = (projects.data ?? []).filter((p) => p.name.includes(query.trim().toLowerCase()));

  function submit(event: FormEvent) {
    event.preventDefault();
    create.send(organizationId, name.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="bg-card h-10 pl-9"
          />
        </div>
        <Button className="h-10" onClick={() => setCreating(!creating)}>
          <Plus />
          Add new
        </Button>
      </div>

      {creating && (
        <form onSubmit={submit} className="bg-card space-y-3 rounded-lg border p-5">
          <p className="font-medium">New project</p>
          <div className="flex flex-wrap gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="sample-shop"
              aria-label="Project name"
              className="h-9 max-w-xs font-mono"
              required
            />
            <Button type="submit" className="h-9" disabled={create.isLoading || !name.trim()}>
              {create.isLoading && <Loader2 className="animate-spin" />}
              Create project
            </Button>
          </div>
          <p className={create.error ? "text-fail text-sm" : "text-muted-foreground text-xs"}>
            {create.error ?? "Lowercase letters, numbers and dashes. It becomes part of each URL."}
          </p>
        </form>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[19rem_1fr]">
        <GitHubPanel organizationId={organizationId} status={github.data} error={github.error} />

        <section>
          {projects.error && <p className="text-fail text-sm">{projects.error}</p>}
          {!projects.data && !projects.error && (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="bg-card h-36 animate-pulse rounded-lg border" />
              ))}
            </div>
          )}
          {projects.data?.length === 0 && (
            <div className="bg-card flex flex-col items-center rounded-lg border px-6 py-20 text-center">
              <p className="text-lg font-medium">Deploy your first project</p>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                A project groups the services of one app, like a frontend and an API.
              </p>
              <Button className="mt-6 h-9" onClick={() => setCreating(true)}>
                <Plus />
                Add new project
              </Button>
            </div>
          )}
          {projects.data && projects.data.length > 0 && shown.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No projects match "{query}".
            </p>
          )}
          <ul className="grid gap-4 md:grid-cols-2">
            {shown.map((project) => {
              const first = project.services[0];
              return (
                <li key={project.id}>
                  <Link
                    to={`/app/projects/${project.id}`}
                    className="bg-card hover:border-foreground/25 flex h-full flex-col rounded-lg border p-5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full border bg-black text-sm font-semibold uppercase">
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.name}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {first ? `${first.name}.${project.name}.localhost` : "No services yet"}
                        </p>
                      </div>
                    </div>
                    {first && (
                      <p className="bg-secondary mt-5 flex w-fit max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 font-mono text-xs">
                        <GitBranch className="size-3 shrink-0" />
                        {first.repository}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-auto pt-5 text-sm">
                      {project.services.length}{" "}
                      {project.services.length === 1 ? "service" : "services"}, created{" "}
                      {timeAgo(project.createdAt)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
